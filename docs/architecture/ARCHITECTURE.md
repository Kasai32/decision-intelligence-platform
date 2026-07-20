# Architecture Overview

Status: Living document. Reflects Phase 1 (Foundation), Phase 2 (Platform core), Phase 3 (Executive Command Center / Incident & Decision domain model), Phase 4 (Decision Intelligence Engine — multidimensional confidence model), Phase 5 (Reporting — Executive Briefs, Decision Reports, Lessons Learned, Knowledge Base), and Phase 6 (Integration resilience engine + per-tenant encrypted configuration), all complete; will be extended as the roadmap in [PREREQUIS.md](../../PREREQUIS.md) grows. Stack decisions here are recorded with full rationale in [DECISION_LOG.md](../../DECISION_LOG.md) and, where architecturally significant, in an [ADR](../adr/README.md).

## 1. System purpose

The Decision Intelligence Platform is an enterprise SaaS system that helps organizations track incidents and decisions, generate evidence-backed recommendations, and produce executive-level reporting, integrating with the tools enterprises already run (ITSM, chat, cloud, observability, SIEM).

The roadmap is phased (see [PREREQUIS.md](../../PREREQUIS.md)):

1. **Foundation** — this document's scope: repo, tooling, CI/CD, no business logic yet.
2. **Platform core** — Auth, RBAC, Tenant Management, API Gateway, Core Database.
3. **Executive surfaces** — Command Center, Incident Timeline, Decision Timeline, Dashboard.
4. **Decision Intelligence Engine** — Evidence Collection, Recommendation Engine, Confidence Model, Business Impact Analysis.
5. **Reporting** — Executive Brief Generator, Decision Reports, Lessons Learned, Knowledge Base.
6. **Enterprise Integrations** — ServiceNow, Jira, Slack, Teams, AWS, Azure, GCP, Splunk, Datadog, Microsoft Sentinel.

Everything below is designed so Phases 2–6 are additive (new modules/packages), not restructuring.

## 2. High-level component map

```
                         ┌─────────────────────────┐
                         │        apps/web         │
                         │  Next.js (TS, App Router)│
                         │  Tailwind v4 + CVA/Radix │  <- Post-roadmap (done — ADR-0014)
                         │  dark command-center UI  │     dark theme, severity colors,
                         │  Executive Command Center│     live SLA countdowns
                         │  + Decision Log tab      │
                         └────────────┬─────────────┘
                                      │ HTTPS (REST/JSON, later: WS for live updates)
                         ┌────────────▼─────────────┐
                         │        apps/api          │
                         │   NestJS (TS)             │
                         │  ── ValidationPipe +      │  <- Phase 2 (API Gateway concerns,
                         │     AllExceptionsFilter   │     see src/main.ts)
                         │     + /api/v1 prefix      │
                         │  ── Auth module (JWT)     │  <- Phase 2 (done)
                         │  ── RBAC (guards/roles)   │  <- Phase 2 (done)
                         │  ── Tenants module        │  <- Phase 2 (done)
                         │  ── Incidents module      │  <- Phase 3 (done)
                         │  ── Decisions module      │  <- Phase 3 (done — Principle 1 guard)
                         │  ── Evidence module       │  <- Phase 3 (done)
                         │  ── Actions module        │  <- Phase 3 (done)
                         │  ── Integrations registry │  <- Phase 6 (done — ADR-0012)
                         │     (10 resilient,        │     circuit breaker + retry,
                         │     per-tenant providers)  │     per-tenant encrypted config
                         │  ── Webhooks (HMAC)       │  <- Phase 6 (done — ADR-0012)
                         │  ── Decision Intelligence │  <- Phase 4 (done — ADR-0010)
                         │     Engine (4-dim scoring)│     confidence model, AI Output Contract
                         │  ── Executive Briefs /    │  <- Phase 5 (done — ADR-0011)
                         │     Decision Reports /    │     immutable snapshots, factual only
                         │     Lessons Learned /     │
                         │     Knowledge Base        │
                         │  ── Simulation module     │  <- Post-roadmap (done — ADR-0013)
                         │     (ADMIN-only test       │     validation-test scenario injector
                         │     scenario injector)     │
                         └────────────┬─────────────┘
                                      │ Prisma
                         ┌────────────▼─────────────┐
                         │       PostgreSQL          │
                         │  Tenant / User /          │
                         │  Membership / RefreshToken│
                         │  Incident / Decision /    │
                         │  Evidence / TimelineEvent │
                         │  / Action /               │
                         │  IntelligenceAnalysis /   │
                         │  ExecutiveBrief /         │
                         │  DecisionReport /         │
                         │  LessonLearned /          │
                         │  IntegrationConfig        │
                         └───────────────────────────┘

           packages/shared  — TS types/DTOs/contracts shared by web + api
                              (now includes Incident/Decision/CommandCenterSummary)
```

Full endpoint reference: [docs/api/README.md](../api/README.md). Design rationale: ADR-0003 (Prisma), ADR-0004 (shared-schema multi-tenancy), ADR-0005 (self-hosted JWT auth), ADR-0006 (Incident/Decision/Evidence/TimelineEvent/Action domain model), ADR-0007 (state transition guards + Principle 1), ADR-0008 (Phase 6 integration abstraction), ADR-0009 (Command Center no-blank-state contract, amended by ADR-0013), ADR-0010 (Decision Intelligence Engine confidence model), ADR-0011 (Phase 5 Reporting architecture), ADR-0012 (integration resilience + per-tenant encrypted config), ADR-0013 (user validation test scenarios / `SimulationScenarioService`), ADR-0014 (frontend design system: Tailwind v4 + CVA/Radix primitives, dark theme, SLA countdowns), ADR-0015 (Postgres RLS as tenant-isolation defense-in-depth), ADR-0016 (decision outcome calibration).

External integrations (ServiceNow, Jira, Slack, Teams, AWS/Azure/GCP, Splunk, Datadog, Microsoft Sentinel) are ten `ResilientIntegrationProvider` instances (circuit breaker + retry wrapping a `ConfigurableIntegrationProvider`), one lazily built and cached per `(tenantId, providerKey)` by `IntegrationsRegistryService` (see ADR-0012, evolved from Phase 3's tenant-unaware mocks, ADR-0008). No real OAuth credentials exist in this environment (see `memory/context.md`) — a tenant configures a provider via `POST /integrations/:providerType/config` with AES-256-GCM-encrypted (fixture) credentials; unconfigured providers run in `STUB_MODE`. `IncidentsService`/`DecisionsService` broadcast to all of them on incident-created/decision-decided; three consecutive failures open a provider's circuit breaker (degraded responses, one `INTEGRATION_BLOCKED` `TimelineEvent`), recovering automatically after a cooldown probe succeeds.

`SimulationScenarioService` (`apps/api/src/simulation`, ADR-0013) is a post-roadmap, ADMIN-only addition built entirely by composing the services above — it creates real, `[SIMULATION]`-prefixed `Incident`/`Decision`/`Evidence` rows (never a synthetic bypass path) so user-validation test sessions can instantly stand up a ransomware scenario (two simultaneously open decisions) or a cloud-outage scenario with genuinely incomplete evidence (it configures the tenant's Datadog integration with a `simulateFailure` fixture credential and drives real broadcasts to trip its circuit breaker `OPEN`, then seeds a real `IntelligenceAnalysis`). `POST /simulation/trigger` is gated `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.ADMIN)`; `apps/web`'s `/simulation` page is a minimal facilitator panel with one button per scenario.

**Frontend design system (ADR-0014, post-roadmap, frontend-only).** `apps/web` uses Tailwind CSS v4 plus hand-authored shadcn-style primitives (`src/components/ui/`: Button, Badge, Card, Tabs, Input, Label, Separator, Textarea, Select — CVA variants + Radix Tabs/Slot/Label) in a single dark "command center" theme (no light/dark toggle — see ADR-0014). Incident severity (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`) is color-coded via one shared token map (`src/lib/severity.ts`) used consistently across the incident list, badges, and decision cards. Each open `Decision` renders a live, ticking `CountdownTimer` against a deadline computed client-side — never stored — from `decision.createdAt + SLA_MINUTES[incident.severity]` (`src/lib/sla-policy.ts`): a deterministic, disclosed placeholder policy (CRITICAL 15m / HIGH 1h / MEDIUM 4h / LOW 24h), not fabricated data, and not a backend change. The Command Center gained a "Decision Log" tab (`DecisionLog` component) rendering the existing `GET /incidents/:id/timeline` feed — `TimelineEvent` got one additive, type-only entry in `packages/shared/src/types.ts` for it, with zero `apps/api` behavior change.

**Decision Intelligence Engine frontend surface (2026-07-20, frontend-only, see DECISION_LOG.md).** The Command Center gained a fourth tab, "Decision Intelligence," rendering Phase 4's `IntelligenceAnalysisPanel` (read-only history — the four confidence dimensions always shown as separate bars via `ConfidenceMeter`, never merged; `missingInformation` always surfaced when non-empty per Principle 3) and `IntelligenceAnalysisForm` (submits the qualitative half of the AI Output Contract to `POST /incidents/:id/analyze`). `packages/shared` gained additive-only types mirroring the Prisma `IntelligenceAnalysis` model. Building this surfaced a real `apps/api` inconsistency — `POST /incidents/:id/analyze` used to nest the confidence dimensions under `confidenceDimensions` while `GET /incidents/:id/analyses` returned them as flat columns — fixed the same day (`DecisionIntelligenceEngineService.analyze()` now returns the persisted row directly, matching `list()`); see DECISION_LOG.md.

**Reporting frontend surface (2026-07-20, frontend-only, see DECISION_LOG.md).** The Command Center gained a fifth tab, "Reports," composing three self-contained Phase 5 panels: `ExecutiveBriefsPanel`, `DecisionReportsPanel` (needs a decision list per incident, which no `apps/api` endpoint provides — derives it from the `DECISION_OPENED` events already in the incident's timeline instead), and `LessonsLearnedPanel` (shows the CLOSED-incident gate explicitly rather than hiding the form). A standalone `/knowledge-base` page renders Phase 5's tenant-wide search. `packages/shared` gained additive-only types mirroring the `ExecutiveBrief`/`DecisionReport`/`LessonLearned` Prisma models.

**Integrations management frontend surface (2026-07-20, frontend-only, see DECISION_LOG.md).** A standalone `/integrations` page (tenant-wide, not per-incident, so not a Command Center tab) lists all ten Phase 6 providers via `IntegrationCard`: status/circuit-state badges and admin actions (configure with a raw JSON credentials textarea — matching `ConfigureIntegrationDto`'s own provider-agnostic shape, since this environment only has fixture credentials; set active/broken; remove). No client-side role check, same precedent as `/simulation` (ADR-0013) — the backend's `@Roles(Role.ADMIN)` 403 is the only enforcement. `apps/web/src/lib/api-client.ts` gained a `delete` method (the one HTTP verb it was missing). `packages/shared` gained additive-only `IntegrationKey`/`IntegrationConfigStatus`/`IntegrationStatusSummary` types. This closes the `apps/web` coverage gap across all six roadmap phases.

## 3. Monorepo layout

```
apps/
  api/        NestJS backend — all server-side business logic
  web/        Next.js frontend — all user-facing UI
packages/
  shared/     Shared TS types, DTOs, constants used by both api and web
docs/
  architecture/  This file + future deep-dives per module
  adr/           Architecture Decision Records (see docs/adr/README.md)
  guides/        Developer/operator how-tos
  api/            API reference docs (generated or hand-written, added in Phase 2)
memory/       Project institutional memory (glossary, standing context) — see memory/README.md
infra/
  docker/     Dockerfiles, compose files, container-related config
.github/
  workflows/  CI/CD (test/lint/build), CodeQL, dependency updates
```

## 4. Technology stack

| Concern           | Choice                                                                 | Why (full rationale in DECISION_LOG.md / ADRs)                          |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Language          | TypeScript everywhere                                                  | One language across api/web/shared, shared types with no codegen        |
| Package manager   | npm workspaces                                                         | Zero extra tooling given the target machine's baseline                  |
| Backend           | NestJS                                                                 | Modular DI maps to RBAC guards, tenant scoping, per-integration modules |
| Frontend          | Next.js (App Router)                                                   | Multi-view dashboard/timeline UI, SSR for report views                  |
| Frontend styling  | Tailwind CSS v4 + CVA/Radix (ADR-0014)                                 | shadcn-style primitives, dark command-center theme, no runtime CSS cost |
| Database          | PostgreSQL                                                             | Relational, strong multi-tenant + audit/evidence data support           |
| ORM               | Prisma (6.x — see ADR-0003)                                            | Type-safe client + file-based migrations                                |
| Multi-tenancy     | Shared schema, `tenantId` scoping (ADR-0004) + Postgres RLS (ADR-0015) | App-code scoping plus database-enforced defense-in-depth                |
| Auth              | Self-hosted JWT (ADR-0005)                                             | No external account/vendor available to an autonomous build             |
| Testing           | Jest (unit) + Jest/supertest/testcontainers (e2e, `apps/api/test/`)    | One runner; e2e hits a real, disposable Postgres — see DECISION_LOG.md  |
| Lint/format       | ESLint (flat config) + Prettier                                        | Current ESLint standard, single shared config                           |
| CI/CD             | GitHub Actions                                                         | No-cost, zero-setup once pushed to GitHub                               |
| Security scanning | CodeQL, npm audit, Dependabot, gitleaks                                | Baseline SAST + dependency CVEs + secret scanning, all free             |
| Containers        | Docker (multi-stage) + docker-compose                                  | Reproducible local dev, deployable images                               |

## 5. Cross-cutting concerns

- **Multi-tenancy:** every tenant-owned Prisma model carries `tenantId`; all `apps/api` queries scope by it via the authenticated request's JWT claims (`AuthenticatedUser.tenantId`), never a client-supplied tenant ID. See ADR-0004. Backed by a second layer of defense: Postgres Row-Level Security on the ten core tenant-scoped tables, enforced against a genuinely non-superuser `dip_app` role (`APP_DATABASE_URL`) — a query with no app-level `WHERE tenantId` at all still returns/writes zero rows for another tenant. See ADR-0015.
- **AuthN/AuthZ:** `JwtAuthGuard` (authentication) and `RolesGuard` + `@Roles(...)` (authorization, `OWNER > ADMIN > MEMBER` rank) are applied at the controller/route level, not inside handler bodies. See `apps/api/src/auth/guards/`.
- **API Gateway concerns:** global `ValidationPipe` (whitelist + transform), global `AllExceptionsFilter` (consistent JSON error shape), versioned `/api/v1` prefix, OpenAPI/Swagger at `/api/v1/docs`. See `apps/api/src/main.ts`.
- **Auditability:** every `Incident`/`Decision`/`Evidence`/`Action` mutation writes a `TimelineEvent` row in the same operation (see ADR-0006) — `TimelineEvent` is not directly writable via the API, so the timeline can be trusted to reflect what services actually did.
- **State transition integrity:** `apps/api/src/common/state-machine` provides a single, reusable `assertValidTransition` guard; every legal transition (including same-state) must be explicitly listed per entity — there is no implicit no-op (see ADR-0007 and the bug this caught, in DECISION_LOG.md).
- **Principle 1 — the AI decides nothing alone:** `DecisionsService.decide()` is the only code path that can set a `Decision` to `DECIDED`, and it hard-requires a non-empty `humanDecision` plus a `decidedByUserId` that resolves to a real member of the tenant. See ADR-0007.
- **Integration isolation + graceful degradation:** each of the ten integrations is independently circuit-breaker-protected (3 consecutive failures → fail fast, no network saturation during an outage) and never allowed to fail the triggering request — `broadcast()` catches any unexpected throw per-provider. See ADR-0008, ADR-0012.
- **No self-attested integration health:** a tenant's integration credentials are AES-256-GCM encrypted at rest and only ever decrypted server-side inside `IntegrationsRegistryService`; no endpoint returns them. An unconfigured or broken integration is never silently treated as healthy — it reports an explicit `STUB_MODE`/`DEGRADED` mode with `freshness: 0, reliability: "MOCK"`. See ADR-0012.
- **Webhook authenticity:** the inbound webhook endpoint's security boundary is an HMAC-SHA256 signature over the raw request body (`crypto.timingSafeEqual`, not `JwtAuthGuard` — the caller is an external system), rejecting anything unsigned/mis-signed before the payload is ever parsed. See ADR-0012.
- **No blank state:** the Executive Command Center's "what to show" logic is computed once, server-side (`GET /incidents/:id/command-center`), not reimplemented per frontend surface. See ADR-0009.
- **No black-box confidence:** the Decision Intelligence Engine reports four independent, auditable dimensions (`evidenceCompleteness`, `sourceReliability`, `dataFreshness`, `aiCertainty`) — never merged into a single score, and never accepted from a client. Each is a deterministic function of real `Evidence` rows; `aiCertainty` is explicitly documented as a heuristic, not a trained-model output, since no model or historical corpus exists. See ADR-0010.
- **Calibration, not just disclosure:** `DecisionOutcome` (see ADR-0016) records a human's retrospective GOOD/BAD/MIXED/UNKNOWN judgment of a `DECIDED` decision — never computed by the system itself — once its incident is `CLOSED`, linked to whichever `IntelligenceAnalysis` existed at decision time. `CalibrationService` (`GET /decision-intelligence/calibration-report`, `apps/web`'s `/calibration`) computes the real, empirical mean of each confidence dimension conditioned on outcome quality, explicitly reporting "not enough data yet" below a disclosed sample-size threshold rather than a falsely precise number.
- **No fabricated narrative in reports:** `ExecutiveBrief`/`DecisionReport` are immutable point-in-time snapshots generated on `POST`; every field except an optional `additionalNotes` is a real value assembled from `Incident`/`Decision`/`Evidence`/`IntelligenceAnalysis` rows via a small deterministic template — never invented prose. `LessonLearned` content is entirely human-authored and gated to `Incident.status = CLOSED`. See ADR-0011.

## 6. What's not built yet

All six roadmap phases have a complete MVP. What's explicitly still missing, by design, given constraints of this environment (see `memory/context.md`):

- **Real integration credentials.** All ten Phase 6 providers are exercised with encrypted fixtures and a simulated network layer (`NetworkSimulator`), not real ServiceNow/Slack/etc. API calls — no OAuth app registrations exist here. A real implementation only needs to implement `NetworkSimulator`; nothing else in the resilience/config stack changes.
- **Real AI/LLM-generated narrative.** Neither the Decision Intelligence Engine (Phase 4) nor Reporting (Phase 5) generate qualitative narrative via any algorithm. Qualitative content is either supplied by a human caller (`POST /incidents/:id/analyze`'s judgment fields, `additionalNotes` on briefs/reports, all of a Lesson Learned) or assembled from real facts via deterministic templates — never fabricated.
- **Cross-instance circuit-breaker state.** Breaker state lives in-process memory; a multi-replica deployment would need a shared store (e.g. Redis) for consistent breaker state across instances — noted in ADR-0012, not built.

See [PREREQUIS.md](../../PREREQUIS.md) for the full roadmap and `memory/context.md` for what's explicitly blocked pending user input (real credentials, a real LLM provider decision).

## 7. Change process

Any change to this document that reflects a genuinely new architectural decision (not a wording fix) should be paired with an entry in [DECISION_LOG.md](../../DECISION_LOG.md) and, if it's a significant/hard-to-reverse choice, an [ADR](../adr/README.md).
