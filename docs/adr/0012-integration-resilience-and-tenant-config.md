# 0012. Integration resilience engine + per-tenant encrypted configuration

Date: 2026-07-19

## Status

Accepted

## Context

Phase 6's user-supplied spec asks for three things: (A) a circuit-breaker + exponential-backoff retry engine wrapping `IntegrationProvider` so a real enterprise system's outage (ServiceNow, Slack, ...) during our own incident degrades gracefully instead of cascading; (B) per-tenant encrypted credentials stored in the database, driving a `STUB_MODE` fallback when a tenant hasn't configured (or has broken) an integration; (C) a generic inbound webhook endpoint with HMAC signature validation, so Splunk/Jira-style alerts can't be spoofed during a crisis. No real OAuth tokens are available in this environment — the instruction is explicit: use encrypted fixtures and simulated network failures to prove the resilience engine, not real API calls.

This required re-architecting the Phase 3 integration layer (ADR-0008: one global, tenant-unaware `MockIntegrationProvider` per system, holding no state) into something tenant-aware, stateful (circuit breaker state must persist across calls to matter at all), and configurable at runtime.

## Decision

### A. Resilience: `CircuitBreaker` + `withRetry` (`apps/api/src/common/resilience/`)

Two small, generic, independently-testable primitives, not integration-specific:

- `CircuitBreaker` — CLOSED → OPEN after `failureThreshold` (3) consecutive failed `execute()` calls; OPEN calls fail fast (`CircuitOpenError`, no underlying call attempted) until `resetTimeoutMs` elapses, then one HALF_OPEN probe call is allowed — success closes the circuit, failure reopens it (restarting the cooldown). The clock is an injectable `now: () => number` (defaults to `Date.now`), so state transitions are exactly reproducible in tests, the same pattern already used for `computeDataFreshness` (ADR-0010).
- `withRetry` — up to `maxAttempts` (3) attempts with exponential backoff (`baseDelayMs * factor^(attempt-1)`) before giving up. `sleep` is injectable (defaults to a real `setTimeout`-based delay), so tests never actually wait.
- Composition: each `CircuitBreaker.execute()` call wraps one full `withRetry()` sequence. A "failed request" for circuit-breaking purposes means all retries within one attempt were exhausted — so 3 consecutive circuit-level failures (each having already retried) trips the breaker, matching the spec's "3 échecs consécutifs" against a realistic definition of "one request" that already includes its own retry policy.

### B. Provider layer evolution

- `IntegrationProvider.notifyIncidentCreated`/`notifyDecisionDecided` now return `Promise<IntegrationCallResult>` (`{ delivered, mode: 'LIVE' | 'STUB_MODE' | 'DEGRADED', freshness: number, reliability: 'LIVE' | 'MOCK', message }`) instead of `Promise<void>` — a breaking change from ADR-0008, necessary because "return the last cached result or a clean degraded response" requires the interface to actually carry a result to cache/degrade.
- `ConfigurableIntegrationProvider` (replaces `MockIntegrationProvider`): holds a tenant's decrypted credentials (or `null`). No credentials, or `IntegrationConfig.status = BROKEN`, or a decrypt failure → `STUB_MODE` immediately: `{ delivered: true, mode: 'STUB_MODE', freshness: 0, reliability: 'MOCK', ... }`, exactly the fields the spec calls out. Credentials present → delegates to an injected `NetworkSimulator.call()`. Production's default `NetworkSimulator` always succeeds (there is nothing real to call yet — see `memory/context.md`); tests inject a failing/flaky simulator to exercise the breaker, per the explicit instruction to simulate failures rather than hit real endpoints.
- `ResilientIntegrationProvider` wraps a `ConfigurableIntegrationProvider` with one `CircuitBreaker` + retry policy, caches the last successful `IntegrationCallResult`, and on `CircuitOpenError` or exhausted retries returns that cached result marked `mode: 'DEGRADED', delivered: false` (or, if nothing ever succeeded, a clean zero-state degraded response) — this is "dernière version en cache ou une réponse dégradée propre" implemented literally.

### C. Per-tenant encrypted configuration

- `IntegrationConfig` (new Prisma model): `tenantId`, `providerType` (`IntegrationKey` — moved from a hand-written TS enum into the Prisma schema, so `@prisma/client` is now the single source of truth and `integration-provider.interface.ts` imports it rather than redeclaring it), `encryptedCredentials` (opaque string), `status` (`ACTIVE` | `BROKEN`), unique on `(tenantId, providerType)`.
- `CredentialsEncryptionService`: AES-256-GCM via Node's built-in `crypto` (no new dependency), key derived by SHA-256 from `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` (a new required env var, same pattern as `JWT_ACCESS_SECRET`). Ciphertext is `iv.authTag.data`, each base64. A tampered ciphertext fails GCM's auth-tag check and throws — decrypt failures are treated as "not configured" (`STUB_MODE`), never as a crash.
- `IntegrationsRegistryService` is no longer `@Global()`-singleton-of-mocks; it now lazily builds and caches one `ResilientIntegrationProvider` per `(tenantId, providerKey)` pair (an in-memory `Map`, so circuit-breaker state actually persists across the many `broadcast()` calls made over an incident's lifetime — a fresh `CircuitBreaker` per call would make the "3 consecutive failures" rule meaningless). `broadcast(event, payload)`'s public signature is unchanged from ADR-0008 (it already carried `tenantId`/`incidentId` in `payload`), so `IncidentsService`/`DecisionsService` call sites did not need to change.
- **`TimelineEventType.INTEGRATION_BLOCKED`**: written exactly once per circuit CLOSED/HALF_OPEN → OPEN transition (not on every subsequent blocked call — that would flood the timeline for the remainder of the outage), with `metadata: { providerKey, result }`. This is the literal "statut BLOCKED automatique" from the spec, implemented as a `TimelineEventType` value rather than a new generic status field, consistent with how every other cross-cutting event in this system (decisions, evidence, actions) is represented as a typed timeline entry, not a bolt-on status column.

### D. Webhook HMAC validation

- `POST /webhooks/:tenantId/:providerType` — deliberately **not** behind `JwtAuthGuard`: the caller is an external system (Splunk, Jira) with no user session, so the security boundary is a per-tenant-per-provider HMAC secret (stored inside the same encrypted `IntegrationConfig.encryptedCredentials` blob, under a `webhookSecret` key), not a bearer token.
- `WebhookSignatureGuard` reads the raw request body (captured via an `express.json({ verify })` hook wired in `main.ts`, since HMAC must be computed over the exact bytes received, not a re-serialized JSON object) and the `X-Signature` header, computes `HMAC-SHA256(rawBody, webhookSecret)`, and compares with `crypto.timingSafeEqual` (not `===`, to avoid a timing side-channel). Any mismatch, missing header, or missing/broken config → `401`, and the payload is never parsed or persisted.
- A valid webhook creates an `Evidence` row via the existing `EvidenceService` (reusing ADR-0006's already-nullable `submittedByUserId` for system-originated evidence — no new persistence path needed) plus the usual `EVIDENCE_ADDED` timeline entry.

## Consequences

- Every one of the ten Phase 6 integrations gets resilience, per-tenant config, and STUB_MODE for free from this shared layer — a real `ServiceNowNetworkSimulator`-style implementation later only needs to implement `NetworkSimulator`, nothing else in this stack changes.
- `IntegrationProvider`'s return-type change is breaking versus ADR-0008; both call sites (`IncidentsService.create`, `DecisionsService.decide`) already only used `broadcast()` (not the per-method return value directly), so no caller changes were needed beyond the registry rewrite itself.
- Circuit-breaker state lives in-process memory (the `providerCache` Map), not the database — it resets on deploy/restart. Acceptable for this MVP (a fresh start after a restart correctly re-probes rather than staying falsely OPEN forever); a future multi-instance deployment would need a shared store (Redis) for consistent breaker state across replicas — explicitly out of scope here, noted for later.
- The webhook endpoint trusts whatever `incidentId` is in the payload (it must belong to the same tenant, checked via the normal `EvidenceService` tenant-scoping) — there's no separate "webhook registration" step mapping external alert IDs to incidents; an external system operator would need to be told which `incidentId` to include when configuring the alert. A real Phase 6+ integration would likely need an incident-matching/creation step; out of scope for this MVP per the "no real endpoints" constraint.

## Alternatives considered

- Keep `IntegrationProvider` methods returning `void` and track circuit state purely as a side-effect / separate health-check API — rejected: the spec explicitly wants a cached/degraded _response_, which requires the interface to carry a result.
- Store the webhook secret in a dedicated column instead of inside the encrypted credentials blob — considered, but credentials are already an arbitrary encrypted JSON object per provider, and a webhook secret is conceptually just another credential; a separate column would be redundant plumbing for no real benefit at this scale.
- Persist circuit-breaker state in Postgres for cross-instance consistency — rejected for now: adds write load on every single call (defeating some of the point of fast-failing) for a property (multi-instance consistency) this single-instance `docker-compose` deployment doesn't need yet.
