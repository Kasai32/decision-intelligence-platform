# Standing Context

Last updated: 2026-07-19.

## Current phase

**Phase 6 — Enterprise Integrations (resilience engine + per-tenant encrypted configuration) is complete**, per [PREREQUIS.md](../PREREQUIS.md). The user supplied a detailed three-part spec (circuit breaker + retry, per-tenant encrypted `IntegrationConfig` with `STUB_MODE` fallback, HMAC-validated webhooks) and explicitly authorized using encrypted fixtures + simulated network failures instead of real OAuth tokens (see [ADR-0012](../docs/adr/0012-integration-resilience-and-tenant-config.md)). Phases 1–5 (`e197079`, `5599746`, `a826545`, `cccc655`, `29c7e55`) were completed first. All six roadmap phases now have a working MVP; 157 tests in `apps/api` alone. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record.

**All six PREREQUIS.md phases are now built.** What remains is filling in real-world specifics this environment cannot provide (see constraints below), not new phases.

## Operating mode

This repository is being built by an AI agent (Claude Code) operating autonomously end-to-end, per explicit user instruction: no per-decision human approval, errors handled inline, every technical decision logged to `DECISION_LOG.md` as it was made. If you are a human picking this up: read `DECISION_LOG.md` top to bottom before assuming any stack/structure/business-logic choice was discussed with you — most weren't, by design.

## Known constraints at time of writing

- No git remote configured — repository is local-only until one is added.
- No cloud provider, hosting target, or deployment environment specified anywhere in the source roadmap.
- No specific compliance/regulatory requirement (SOC2, HIPAA, etc.) was specified, despite the enterprise-integration surface (Sentinel, Splunk, etc.) suggesting one may eventually apply.
- **No real integration credentials exist for any of the ten Phase 6 systems.** The resilience/config/webhook architecture (ADR-0012) is real and fully tested against encrypted fixtures and a simulated network layer (`NetworkSimulator`); actual ServiceNow/Slack/etc. API calls are not. A real implementation only needs to implement the `NetworkSimulator` interface for that provider — nothing else changes.
- **No LLM integration exists in this environment.** Neither the Decision Intelligence Engine (Phase 4) nor Reporting (Phase 5) generate narrative/judgment content via any algorithm. Qualitative content is always either human-supplied or a factual template over real data — never fabricated.

## Decisions made in Phase 6 (see DECISION_LOG.md / ADR-0012 for full rationale)

- `CircuitBreaker` (CLOSED → OPEN after 3 consecutive failures, HALF_OPEN probe after a cooldown) and `withRetry` (exponential backoff) are generic, clock/sleep-injectable primitives in `apps/api/src/common/resilience/` — not integration-specific.
- `IntegrationProvider.notifyX` methods now return `IntegrationCallResult` (`delivered`/`mode`/`freshness`/`reliability`) instead of `void` — a breaking change from ADR-0008, necessary so there's something to cache/degrade.
- `ConfigurableIntegrationProvider`: no tenant credentials (or `status: BROKEN`) → `STUB_MODE` (`freshness: 0, reliability: 'MOCK'`), exactly as specified, no network attempt. Credentials present → delegates to an injectable `NetworkSimulator` (production default always succeeds — nothing real exists to call yet; tests inject failures).
- `ResilientIntegrationProvider` wraps the above with the circuit breaker, caching the last successful result so a `DEGRADED` response returns real last-known-good data, not a fake one.
- `IntegrationsRegistryService` rewritten: no longer a global singleton of tenant-unaware mocks (ADR-0008) — now lazily builds and **caches one resilient provider per `(tenantId, providerKey)`** so circuit-breaker state actually persists across calls. `broadcast()`'s public signature is unchanged (still just `(event, payload)`), so `IncidentsService`/`DecisionsService` needed no changes.
- `TimelineEventType.INTEGRATION_BLOCKED` is written exactly once per CLOSED/HALF_OPEN → OPEN transition, not on every subsequent blocked call.
- Credentials: AES-256-GCM via Node's built-in `crypto` (no new dependency), key derived from a new required env var `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY`. A tampered ciphertext fails the GCM auth-tag check and is treated as "not configured" (`STUB_MODE`), never a crash.
- `IntegrationKey` moved from a hand-written TS enum into the Prisma schema — `@prisma/client` is now the single source of truth.
- Webhook endpoint (`POST /webhooks/:tenantId/:providerType`) is deliberately outside `/api/v1` and NOT behind `JwtAuthGuard` — its security boundary is an HMAC-SHA256 signature over the **raw** request body (captured via an `express.json({ verify })` hook in `main.ts`, since Nest's default body parser doesn't expose raw bytes), checked with `crypto.timingSafeEqual`. A valid webhook creates system-originated `Evidence` (reusing ADR-0006's already-nullable `submittedByUserId`) — no new persistence path was needed.

## Open questions for later work

- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
- Email delivery provider (needed for real invite/password-reset flows).
- Multi-tenant login/tenant-selection flow (a user with >1 tenant membership still cannot log in — Phase 2 limitation, unchanged since).
- Real LLM integration for AI Output Contract / brief narrative content — needs an API key/credential and a product decision on which provider.
- Real integration credentials per Phase 6 system, see constraint above — the seam (`NetworkSimulator`) is ready.
- Circuit-breaker state is in-process memory only — would need a shared store (Redis) for a multi-replica deployment (see ADR-0012, explicitly out of scope for this single-instance MVP).
- Frontend refresh-token handling (access token expiry currently just breaks API calls with no silent refresh) — worth hardening before real usage.
- No `apps/web` UI exists yet for Decision Intelligence Engine (Phase 4), Reporting (Phase 5), or Integrations management (Phase 6) — only backend + tests. The Executive Command Center UI (Phase 3) is the only frontend surface built so far.
- Knowledge Base search is keyword/ILIKE-based; revisit with semantic/embedding search if Lessons Learned volume grows large (see ADR-0011).
