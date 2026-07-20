# Standing Context

Last updated: 2026-07-20.

## Mission pivot (2026-07-20) — read this before assuming the project is "done"

The user set new direction beyond the original incident-response roadmap: this platform's actual mission is **government intelligence analysis** — pulling together data from many sources, finding hidden connections between people/organizations/locations/events, visualizing those relationships, and helping analysts make faster, better decisions. Explicitly compared to Palantir Gotham in _capability_ (data integration, link analysis, geospatial analysis, secure analyst collaboration), but the stated core mission is the opposite of Gotham's real-world reputation: make analysts faster and smarter **while protecting civil liberties by keeping a human analyst in control, not automated surveillance**.

This is not a scrapped direction — it's additive. Every principle already built here (Principle 1 — no automation decides alone, ADR-0007; the confidence-explainability standard, ADR-0019; RLS-based tenant isolation, ADR-0015) is exactly the discipline this mission needs, just extended from incident response to intelligence analysis. See [ADR-0021](../docs/adr/0021-entity-relationship-graph-and-audit-log.md) (entity-relationship graph + analyst-activity audit log) and [ADR-0022](../docs/adr/0022-geospatial-entity-search.md) (geospatial entity search — real `latitude`/`longitude` on `Entity`, `GET /entities/nearby`/`GET /entities/map`) for the concrete steps so far. Of the four capability pillars named by the user (data integration / link analysis / geospatial analysis / secure collaboration): link analysis and geospatial analysis are underway; data integration and secure collaboration are not started.

The user also raised using an **open-weight (self-hostable) LLM** instead of / alongside the Anthropic API — motivated by data sovereignty for sensitive government data, not just cost. `LlmClient` (ADR-0018) was deliberately built provider-agnostic for exactly this kind of swap; a self-hosted model served via Ollama/vLLM is the natural next `LlmClient` implementation, not yet built.

## Current phase

**All six PREREQUIS.md phases are complete**, per [PREREQUIS.md](../PREREQUIS.md). Phases 1–5 (`e197079`, `5599746`, `a826545`, `cccc655`, `29c7e55`) and Phase 6 — Enterprise Integrations (resilience engine + per-tenant encrypted configuration, [ADR-0012](../docs/adr/0012-integration-resilience-and-tenant-config.md)) form the working MVP. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record.

**Post-roadmap: user validation test-session prep is complete** (see [ADR-0013](../docs/adr/0013-simulation-scenario-architecture.md)). `SimulationScenarioService` (`apps/api/src/simulation`) lets a tenant ADMIN instantly instantiate two disposable, `[SIMULATION]`-prefixed test scenarios via `POST /simulation/trigger` — a ransomware incident with two simultaneously open decisions, and a cloud-outage incident with genuinely incomplete evidence (it actually trips the tenant's Datadog integration circuit breaker). Building this surfaced and fixed a real pre-existing gap: the Command Center only ever returned one `openDecision`, silently hiding any second simultaneously open decision — amended in-place to `openDecisions: Decision[]` (ADR-0009 amendment, documented in ADR-0013). `apps/web` gained a matching `/simulation` facilitator panel. 175 tests in `apps/api`, 11 in `apps/web`.

**Post-roadmap: frontend design system (user-named "Phase 4: Command Center UI & Decision Log UI") is complete** (see [ADR-0014](../docs/adr/0014-frontend-design-system.md)). The Dry Run validated the backend but the user judged the unstyled frontend unacceptable for an enterprise demo and explicitly halted all backend work to focus on it. `apps/web` now runs Tailwind CSS v4 + hand-authored shadcn-style primitives (`src/components/ui/`) in a single dark "command center" theme (no toggle), with severity color-coding (`src/lib/severity.ts`) applied consistently across the incident list and decision cards, a live ticking `CountdownTimer` on every open decision (deadline computed client-side from a deterministic, disclosed per-severity SLA table — `src/lib/sla-policy.ts` — not stored, not fabricated, not a backend change), and a new Decision Log tab rendering the existing timeline feed. Zero `apps/api` behavior changed; `packages/shared` gained one additive `TimelineEvent` type. 175 tests in `apps/api` (unchanged), 16 in `apps/web` (was 11).

**Post-roadmap: apps/web coverage gap for Phase 4/5/6 backends is now closed.** The user asked to prioritize this over supplying real credentials (which they'll add later), driven via a self-paced `/loop`, one commit per surface. All three surfaces are done:

- Surface 1 — Decision Intelligence Engine (Phase 4): a new "Decision Intelligence" Command Center tab (`IntelligenceAnalysisPanel` + `IntelligenceAnalysisForm`) reusing ADR-0014's design system, no backend change. Surfaced a real API inconsistency (`POST /incidents/:id/analyze` nested the four confidence dimensions under `confidenceDimensions`; `GET /incidents/:id/analyses` returned them as flat Prisma columns) — the user asked for it fixed properly afterward: `analyze()` now returns the persisted row directly, same flat shape as `list()`; the frontend's normalization workaround was deleted. See DECISION_LOG.md's 2026-07-20 fix entry.
- Surface 2 — Reporting (Phase 5): a new "Reports" Command Center tab composing `ExecutiveBriefsPanel` + `DecisionReportsPanel` + `LessonsLearnedPanel` (each self-fetches its own data), plus a standalone `/knowledge-base` search page. `DecisionReportsPanel` derives its decision list from the incident timeline's `DECISION_OPENED` events (parsing the question back out of the event description) rather than adding a new "list decisions" `apps/api` endpoint.
- Surface 3 — Integrations management (Phase 6): a standalone `/integrations` page (`IntegrationCard`) listing all ten providers with configure/status/remove admin actions, no client-side role check (matches `/simulation`'s precedent — backend 403 is the only enforcement). `apiClient` gained a `delete` method, the one HTTP verb it was missing.
- 216 tests total (175 `apps/api` + 40 `apps/web` + 1 `packages/shared`), all green. Every roadmap phase (1–6) now has a reachable `apps/web` surface, not just a tested backend.

**Post-roadmap: critical-review remediation pass is complete.** The user asked for an honest critical review of the whole platform, then asked to fix everything it flagged, in priority order, with the Decision Intelligence Engine's heuristic-vs-learned honesty question tackled last as a design decision. All 5 items done:

1. Rate limiting (`@nestjs/throttler`, 5/min on login/register) + Helmet security headers.
2. Structured logging via `nestjs-pino`, redacting auth headers/passwords/integration credentials.
3. E2E tests against a real Postgres (testcontainers, `apps/api/test/*.e2e-spec.ts`, new CI `e2e` job).
4. Postgres RLS as tenant-isolation defense-in-depth (ADR-0015) — see below, the new e2e suite (item 3) caught a real superuser-bypass bug the same day it was built.
5. Decision outcome calibration (ADR-0016) — the user chose "add real calibration" over "reframe the branding honestly," with full `apps/web` UI. A new `DecisionOutcome` model (human-attested `GOOD`/`BAD`/`MIXED`/`UNKNOWN`, recordable once a decision is `DECIDED` and its incident `CLOSED`) feeds a `CalibrationService` that computes real per-dimension mean-when-GOOD vs. mean-when-BAD statistics — explicitly `sufficientData: false` below a disclosed placeholder threshold (5) rather than a fabricated precise number. `apps/web` gained `DecisionOutcomePanel` (Reports tab) and a standalone `/calibration` page. Verified live via a new e2e spec driving 3 full decision lifecycles and confirming the report's computed means exactly match the real evidence submitted. 236 unit tests + 9 e2e tests, all green.

**RLS's first version was a complete no-op — the new e2e suite (item 3) is what caught it, the same day it was built.** The migration-running Postgres role is a superuser (the official `postgres` image's bootstrap `POSTGRES_USER`), and superusers unconditionally bypass RLS regardless of `FORCE ROW LEVEL SECURITY`. Fixed with a second, genuinely unprivileged `dip_app` role the running app now connects as via a new `APP_DATABASE_URL` env var (`PrismaService` falls back to `DATABASE_URL` with a loud startup warning, never silently, if unset — see `.env.example`/`docker-compose.yml`). Closing this loop also surfaced and fixed two unrelated bugs: `bootstrapTestApp()` was missing the raw-body-capturing middleware `WebhookSignatureGuard` needs (only visible once a webhook e2e test existed), and adding `test/*.ts` files had silently changed `nest build`'s output path from `dist/main.js` to `dist/src/main.js`, breaking the Dockerfile's `CMD` (fixed with an explicit `rootDir` in `apps/api/tsconfig.json`). The `decision_outcomes` table added for item 5 confirmed the least-privilege grant mechanism (`ALTER DEFAULT PRIVILEGES`) genuinely covers tables created by later migrations, not just a one-off fix.

**What remains otherwise is filling in real-world specifics this environment cannot provide (see constraints below), not new phases.**

## Operating mode

This repository is being built by an AI agent (Claude Code) operating autonomously end-to-end, per explicit user instruction: no per-decision human approval, errors handled inline, every technical decision logged to `DECISION_LOG.md` as it was made. If you are a human picking this up: read `DECISION_LOG.md` top to bottom before assuming any stack/structure/business-logic choice was discussed with you — most weren't, by design.

## Known constraints at time of writing

- No git remote configured — repository is local-only until one is added.
- No cloud provider, hosting target, or deployment environment specified anywhere in the source roadmap.
- No specific compliance/regulatory requirement (SOC2, HIPAA, etc.) was specified, despite the enterprise-integration surface (Sentinel, Splunk, etc.) suggesting one may eventually apply.
- **No real integration credentials exist for any of the ten Phase 6 systems.** The resilience/config/webhook architecture (ADR-0012) is real and fully tested against encrypted fixtures and a simulated network layer (`NetworkSimulator`); actual ServiceNow/Slack/etc. API calls are not. A real implementation only needs to implement the `NetworkSimulator` interface for that provider — nothing else changes.
- **The Decision Intelligence Engine (Phase 4) drafts via a real LLM (ADR-0018, Anthropic Claude)** — only as an editable draft; a human still submits every analysis, unchanged. Verified live end-to-end with a real API key for the first time on 2026-07-20 (see DECISION_LOG.md) — that run surfaced and fixed a real bug: RLS's per-request Prisma transaction (ADR-0015) had a 5s default timeout that didn't survive the ~14s real LLM call, now raised to 30s in `tenant-rls.context.ts`. The user's real key lives only in a local, gitignored `apps/api/.env` — never committed. Reporting (Phase 5) is unaffected and still uses factual templates only, never fabricated narrative — extending AI drafting there was deliberately deferred, not done in the same pass (see ADR-0018's alternatives).

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

## Decisions made in the Postgres RLS phase (see DECISION_LOG.md / ADR-0015 for full rationale)

- RLS + `FORCE ROW LEVEL SECURITY` on the ten core tenant-scoped tables, keyed to a `SELECT set_config('app.tenant_id', $1, true)` session variable — a fail-closed policy (`current_setting(..., true)` returns `NULL`, not an error, when unset, so an unscoped connection sees zero rows).
- The app connects as a new least-privilege `dip_app` role (`APP_DATABASE_URL`), not the migration-running superuser role (`DATABASE_URL`) — RLS is a no-op for superusers no matter what, confirmed the hard way (see above).
- `TenantRlsInterceptor` (global `APP_INTERCEPTOR`) + a `Proxy` around `PrismaService` (`AsyncLocalStorage`-based) means every existing service's `this.prisma.X` call is transparently RLS-scoped with zero code changes to any of the ~10 services that inject it.
- The webhook route (HMAC-authenticated, not JWT) sets its own tenant context directly in `WebhookSignatureGuard`/`WebhooksController`, since it runs before any JWT-based interceptor could apply.

## Decisions made in the decision-outcome calibration phase (see DECISION_LOG.md / ADR-0016 for full rationale)

- `DecisionOutcome.outcomeQuality` is always human-supplied, never inferred (e.g. never auto-derived from "closed within SLA") — the system must not grade its own recommendation.
- `intelligenceAnalysisId` links to whichever analysis existed _at `decision.decidedAt`_, not whatever's newest when the outcome is recorded (often much later, after incident closure).
- `MIN_SAMPLE_SIZE = 5` (combined GOOD+BAD per dimension) is a disclosed placeholder, not a real power-analysis result — chosen to be reachable without a large historical corpus in this environment; revisit once real usage volume is known.
- Calibration is a measurement/feedback layer only — it does not (yet) feed back into ADR-0010's actual scoring weights (`RELIABILITY_BY_SOURCE_CATEGORY` etc.). That's a natural next step once enough labeled outcomes exist to justify it.

## Decisions made in the multi-tenant login fix (see DECISION_LOG.md / ADR-0017 for full rationale)

- An account with >1 tenant membership now gets a `tenantSelectionRequired` response from `POST /auth/login` instead of an unconditional 401 — 0 or 1 memberships behave exactly as before.
- The tenant-selection token is a separate, short-lived (5 min), unpersisted JWT carrying only `{ sub, purpose: 'tenant-selection' }` — `JwtStrategy` explicitly rejects any token missing `tenantId`/`role`, so it can never work as a normal bearer token.
- `POST /auth/select-tenant` never re-checks the password — the selection token is the proof that already happened.

## Design system + product-critique pass (2026-07-20, after watching the live app in a browser)

- The dark-console theme (ADR-0014) was refined toward a "top notch platform" elevation ladder (never near-black — background/card/border/muted-foreground all lifted a step, modeled on GitHub/Linear/Vercel) after live-browser feedback that the original pass was too dark and small badge text was illegible. Palette/geometry/typography choices are in `apps/web/src/app/globals.css`, not a separate ADR — a UI-polish iteration, not an architectural decision.
- The user raised three real product critiques after using the app live: (1) copy/microcopy isn't enterprise-grade, (2) the confidence/probability numbers were "misunderstood" — no visible reasoning behind them, (3) no sense of live progress anywhere. Prioritized order, confirmed by the user: #2 first (done, ADR-0019), then #3 (done, ADR-0020), then #1 (copy pass) — #1 is the only one still open.

## Decisions made in the confidence-explainability phase (see DECISION_LOG.md / ADR-0019 for full rationale)

- `explainXxx()` functions (one per scoring dimension) are the single source of truth; `computeXxx()` is now a thin wrapper returning just `.score` — a displayed explanation can never numerically disagree with the score it explains.
- `confidenceBreakdown` is never persisted — always recomputed from already-immutable inputs (incident type/severity, the exact evidence rows an analysis's `evidenceUsed` references). `list()` uses each analysis's own frozen `createdAt` for the freshness recalculation, so reopening an old analysis always shows the same breakdown that matches its originally-persisted score.
- Scoped to Decision Intelligence Engine only — Reporting's factual templates (ADR-0011) and Calibration's aggregate report (ADR-0016) are untouched.

## Decisions made in the live-progress phase (see DECISION_LOG.md / ADR-0020 for full rationale)

- AI drafts stream token-by-token via SSE (`POST /incidents/:id/analyze/draft/stream`) — real model output, not a fabricated progress indicator. Validation is identical to the non-streaming endpoint, just deferred until the full text has streamed in.
- **A new `@SkipTenantRls()` decorator exists specifically because the global `TenantRlsInterceptor` would otherwise silently collapse a multi-emission SSE Observable down to just its last value** (via `lastValueFrom`) — worth knowing before adding any other streaming/multi-emission route: it needs this decorator too, or it will silently break the same way.
- The streaming endpoint's HTTP status is only a reliable failure signal for the zero-I/O `available` check (a clean 503) — any failure requiring a DB read first (e.g. incident not found) reliably loses Nest's SSE header-commit race and reports via an in-stream `error` event instead of a 404. Both work correctly from the frontend's perspective; only the exact status code differs.
- The Command Center polls the selected incident every 8s in the background (`LIVE_REFRESH_INTERVAL_MS` in `page.tsx`) — no websockets yet, deferred until real scale justifies it.

## Decisions made in the entity-relationship graph + audit log phase (see DECISION_LOG.md / ADR-0021 for full rationale)

- Every `Entity` and `Relationship` must cite the real `Evidence` it came from at creation — enforced in `EntitiesService`/`RelationshipsService`, not just documented.
- A `Relationship` always starts `SUGGESTED`; reaching `CONFIRMED` requires both a real state transition (`relationship.state-machine.ts`) and at least one evidence citation — citing evidence when _proposing_ a link is not the same act as a human _confirming_ it.
- `AuditLogEntry` is append-only (no update/delete anywhere) and requires a stated `reason` for `SEARCH`/`VIEW_ENTITY`/`VIEW_GRAPH` — enforced at the DTO layer (400 without one), not optional. `GET /audit-log` is `@Roles(Role.ADMIN)`-gated.
- No frontend exists yet for entities/relationships/audit-log review — `packages/shared` has the types, `apps/web` has no pages. Next natural step once UI work resumes on this track.

## Decisions made in the geospatial entity search phase (see DECISION_LOG.md / ADR-0022 for full rationale)

- `Entity.latitude`/`Entity.longitude` are real Float columns (not buried in `attributes` JSON) — both-or-neither, range-validated in `CreateEntityDto`. Any entity type can carry coordinates, not just `LOCATION`.
- Distance is computed via Haversine in application code (`entities/geospatial.ts`), not PostGIS — deliberately deferred; fine at current scale since there's no spatial index either way, revisit if a tenant's located-entity count grows large.
- `GET /entities/nearby` (radius search) and `GET /entities/map` (all located entities) both require the same enforced `reason` purpose-limitation rule as every other entity read.

## Open questions for later work

- **The four intelligence-mission pillars beyond link analysis + geospatial (data integration, secure collaboration) have no architecture yet** — link analysis (ADR-0021) and geospatial search (ADR-0022) are the two started so far.
- **An open-weight/self-hosted `LlmClient` implementation** (Ollama/vLLM) — motivated by data sovereignty for sensitive government data, not yet built; the seam (ADR-0018) is ready for it.
- **No frontend for the entity-relationship graph, geospatial map, or the audit log review page** — graph visualization (nodes/edges), a map view, an entity search UI, and an ADMIN-facing audit-log viewer are all unbuilt.
- **`getGraph()` is one-hop only** — no recursive N-hop traversal yet; fine for a v1 with no UI to explore deeper graphs anyway.
- **No dedicated "auditor/compliance" role** — audit-log review currently reuses the existing `ADMIN` role rather than a role that can review but not modify data (separation of duties); deferred until real usage shows whether that distinction matters in practice.
- **No PostGIS / spatial index** — `nearby`/`map` fetch every located entity and filter in memory; the migration path (PostGIS `geography` column + GiST index + `ST_DWithin`) is disclosed in ADR-0022 but not implemented, since current scale doesn't need it.

- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
- Email delivery provider (needed for real invite/password-reset flows).
- AI drafting (ADR-0018) is now verified live against the real Anthropic API — the open question is whether to extend it to Executive Brief/Decision Report narrative (Reporting, ADR-0011) now that it's proven out for Decision Intelligence Engine.
- Real integration credentials per Phase 6 system, see constraint above — the seam (`NetworkSimulator`) is ready.
- Circuit-breaker state is in-process memory only — would need a shared store (Redis) for a multi-replica deployment (see ADR-0012, explicitly out of scope for this single-instance MVP).
- Frontend refresh-token handling (access token expiry currently just breaks API calls with no silent refresh) — worth hardening before real usage.
- Every roadmap phase now has an `apps/web` surface (see above) — no remaining "backend without a UI" gap. Frontend surfaces: Command Center + Decision Log + Decision Intelligence + Reports (ADR-0014, plus the two 2026-07-20 entries), login, `/simulation` (ADR-0013), `/knowledge-base`, `/integrations`.
- The SLA countdown policy (ADR-0014) needs a real product decision: configurable per-tenant response windows stored server-side (admin-editable), replacing the current hardcoded frontend table.
- Knowledge Base search is keyword/ILIKE-based; revisit with semantic/embedding search if Lessons Learned volume grows large (see ADR-0011).
- **RLS (ADR-0015) doesn't cover `memberships`/`refresh_tokens`** — both are read during login/refresh, before any tenant context can exist; a user-scoped (not tenant-scoped) policy is the natural next step if this matters more later.
- **`CREATE ROLE` for `dip_app` runs inside a migration** (ADR-0015), which assumes the migration role has that privilege — true of `docker-compose.yml` and testcontainers today, not necessarily true of a managed cloud Postgres a future hosting decision might pick.
- Every authenticated request now holds one Postgres connection for its full duration (ADR-0015's `TenantRlsInterceptor` wraps the whole request in one transaction) — fine at this stage's single-instance scale, worth revisiting if connection-pool exhaustion becomes real.
- **The calibration report (ADR-0016) will show "not enough data yet" indefinitely without real usage** — it's a cold-start feature by design, not a bug; becomes useful once real decisions accumulate real human-recorded outcomes.
- **Calibration doesn't feed back into the scoring weights yet** (see above) — an actual second loop (adjusting ADR-0010's heuristic constants from real calibration data) is the natural follow-up once there's enough labeled data to justify it.
