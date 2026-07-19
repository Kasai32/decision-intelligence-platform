# Standing Context

Last updated: 2026-07-20.

## Current phase

**All six PREREQUIS.md phases are complete**, per [PREREQUIS.md](../PREREQUIS.md). Phases 1–5 (`e197079`, `5599746`, `a826545`, `cccc655`, `29c7e55`) and Phase 6 — Enterprise Integrations (resilience engine + per-tenant encrypted configuration, [ADR-0012](../docs/adr/0012-integration-resilience-and-tenant-config.md)) form the working MVP. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record.

**Post-roadmap: user validation test-session prep is complete** (see [ADR-0013](../docs/adr/0013-simulation-scenario-architecture.md)). `SimulationScenarioService` (`apps/api/src/simulation`) lets a tenant ADMIN instantly instantiate two disposable, `[SIMULATION]`-prefixed test scenarios via `POST /simulation/trigger` — a ransomware incident with two simultaneously open decisions, and a cloud-outage incident with genuinely incomplete evidence (it actually trips the tenant's Datadog integration circuit breaker). Building this surfaced and fixed a real pre-existing gap: the Command Center only ever returned one `openDecision`, silently hiding any second simultaneously open decision — amended in-place to `openDecisions: Decision[]` (ADR-0009 amendment, documented in ADR-0013). `apps/web` gained a matching `/simulation` facilitator panel. 175 tests in `apps/api`, 11 in `apps/web`.

**Post-roadmap: frontend design system (user-named "Phase 4: Command Center UI & Decision Log UI") is complete** (see [ADR-0014](../docs/adr/0014-frontend-design-system.md)). The Dry Run validated the backend but the user judged the unstyled frontend unacceptable for an enterprise demo and explicitly halted all backend work to focus on it. `apps/web` now runs Tailwind CSS v4 + hand-authored shadcn-style primitives (`src/components/ui/`) in a single dark "command center" theme (no toggle), with severity color-coding (`src/lib/severity.ts`) applied consistently across the incident list and decision cards, a live ticking `CountdownTimer` on every open decision (deadline computed client-side from a deterministic, disclosed per-severity SLA table — `src/lib/sla-policy.ts` — not stored, not fabricated, not a backend change), and a new Decision Log tab rendering the existing timeline feed. Zero `apps/api` behavior changed; `packages/shared` gained one additive `TimelineEvent` type. 175 tests in `apps/api` (unchanged), 16 in `apps/web` (was 11).

**In progress: closing the apps/web coverage gap for already-built Phase 4/5/6 backends.** The user asked to prioritize this over supplying real credentials (which they'll add later), driven via a self-paced `/loop`, one commit per surface. First surface done — Decision Intelligence Engine (Phase 4): a new "Decision Intelligence" Command Center tab (`IntelligenceAnalysisPanel` + `IntelligenceAnalysisForm`) reusing ADR-0014's design system, no backend change. Surfaced a real, unfixed API inconsistency: `POST /incidents/:id/analyze` nests the four confidence dimensions under `confidenceDimensions`, but `GET /incidents/:id/analyses` returns them as flat Prisma columns — worked around in the frontend (normalized on submit), not fixed in `apps/api` (out of scope for this task; tracked below). 198 tests total (175 `apps/api` + 22 `apps/web` + 1 `packages/shared`). Reporting (Phase 5) and Integrations management (Phase 6) UI are next.

**What remains otherwise is filling in real-world specifics this environment cannot provide (see constraints below), not new phases.**

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

## Decisions made in user-validation test-session prep (see DECISION_LOG.md / ADR-0013 for full rationale)

- `SimulationScenarioService` has zero new persistence paths — both scenarios are built entirely from existing tenant-scoped service calls (`IncidentsService`, `DecisionsService`, `EvidenceService`, `IntegrationConfigService`, `IntegrationsRegistryService`, `DecisionIntelligenceEngineService`), so any bug they surface is a bug in a real product code path, not a simulation-specific one.
- Scenario B's "not enough evidence" state is never hand-typed: it's produced by actually starving `evidenceCompleteness` of `MONITORING` evidence and actually driving three broadcasts to trip the Datadog circuit breaker, then calling the real `DecisionIntelligenceEngineService.analyze()`.
- `POST /simulation/trigger` is `@Roles(Role.ADMIN)`-gated; `apps/web`'s `/simulation` page has no client-side role check (the backend 403 is the only enforcement, consistent with every other admin-only action in this codebase).
- The referenced `incident-commander-validation-guide.md` does not exist in this repository (checked, not on disk) — as with earlier gaps of this kind (`PREREQUIS.md`, Phase 3), the user's chat message contained enough of a spec to proceed; the discrepancy is noted in ADR-0013 rather than blocking work.

## Decisions made in the frontend design system phase (see DECISION_LOG.md / ADR-0014 for full rationale)

- Tailwind v4 + hand-authored shadcn-style primitives, not the interactive shadcn CLI (this environment can't drive it non-interactively) and not Tremor (better fit for a future charts/metrics dashboard, not this composition-of-cards/badges surface).
- Dark theme only, no light/dark toggle — the product's identity, not a preference; avoids FOUC/hydration-mismatch risk entirely since there's exactly one theme.
- The SLA countdown table (CRITICAL 15m / HIGH 1h / MEDIUM 4h / LOW 24h) is a **new, disclosed UI-only assumption** this task introduced — not a real product/ops-specified policy. Flagged in ADR-0014 and below, not silently presented as authoritative.
- `Decision` still has no deadline field and none was added — the countdown is computed, never stored, specifically to honor "stop all backend work."

## Open questions for later work

- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
- Email delivery provider (needed for real invite/password-reset flows).
- Multi-tenant login/tenant-selection flow (a user with >1 tenant membership still cannot log in — Phase 2 limitation, unchanged since).
- Real LLM integration for AI Output Contract / brief narrative content — needs an API key/credential and a product decision on which provider.
- Real integration credentials per Phase 6 system, see constraint above — the seam (`NetworkSimulator`) is ready.
- Circuit-breaker state is in-process memory only — would need a shared store (Redis) for a multi-replica deployment (see ADR-0012, explicitly out of scope for this single-instance MVP).
- Frontend refresh-token handling (access token expiry currently just breaks API calls with no silent refresh) — worth hardening before real usage.
- No `apps/web` UI exists yet for Reporting (Phase 5: Executive Briefs / Decision Reports / Lessons Learned / Knowledge Base) or Integrations management (Phase 6) — only backend + tests. Decision Intelligence Engine (Phase 4) UI is now done (see above); it, the Command Center + Decision Log (ADR-0014), login, and the `/simulation` facilitator panel (ADR-0013) are the only frontend surfaces built so far.
- **`apps/api` response-shape bug found while building the Decision Intelligence UI:** `POST /incidents/:id/analyze` nests the four confidence dimensions under a `confidenceDimensions` object; `GET /incidents/:id/analyses` returns the same four dimensions as flat top-level columns (the raw Prisma row shape). The two should agree — worth fixing (most likely: flatten the POST response) next time `DecisionIntelligenceEngineService` is touched. `apps/web` currently normalizes around it client-side.
- The SLA countdown policy (ADR-0014) needs a real product decision: configurable per-tenant response windows stored server-side (admin-editable), replacing the current hardcoded frontend table.
- Knowledge Base search is keyword/ILIKE-based; revisit with semantic/embedding search if Lessons Learned volume grows large (see ADR-0011).
