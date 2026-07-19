# Architecture Overview

Status: Living document. Reflects Phase 1 (Foundation), Phase 2 (Platform core), Phase 3 (Executive Command Center / Incident & Decision domain model), and Phase 4 (Decision Intelligence Engine — multidimensional confidence model), all complete; will be extended as each subsequent phase in [PREREQUIS.md](../../PREREQUIS.md) lands. Stack decisions here are recorded with full rationale in [DECISION_LOG.md](../../DECISION_LOG.md) and, where architecturally significant, in an [ADR](../adr/README.md).

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
                         │  Executive Command Center│
                         │  Dashboards, Timelines   │
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
                         │  ── Integrations registry │  <- Phase 3 mocks (done, ADR-0008),
                         │     (10 mock providers)   │     Phase 6 fills in real ones
                         │  ── Decision Intelligence │  <- Phase 4 (done — ADR-0010)
                         │     Engine (4-dim scoring)│     confidence model, AI Output Contract
                         │  ── Reporting module      │  <- Phase 5
                         └────────────┬─────────────┘
                                      │ Prisma
                         ┌────────────▼─────────────┐
                         │       PostgreSQL          │
                         │  Tenant / User /          │
                         │  Membership / RefreshToken│
                         │  Incident / Decision /    │
                         │  Evidence / TimelineEvent │
                         │  / Action /               │
                         │  IntelligenceAnalysis     │
                         └───────────────────────────┘

           packages/shared  — TS types/DTOs/contracts shared by web + api
                              (now includes Incident/Decision/CommandCenterSummary)
```

Full endpoint reference: [docs/api/README.md](../api/README.md). Design rationale: ADR-0003 (Prisma), ADR-0004 (shared-schema multi-tenancy), ADR-0005 (self-hosted JWT auth), ADR-0006 (Incident/Decision/Evidence/TimelineEvent/Action domain model), ADR-0007 (state transition guards + Principle 1), ADR-0008 (Phase 6 integration mocks), ADR-0009 (Command Center no-blank-state contract), ADR-0010 (Decision Intelligence Engine confidence model).

External integrations (Phase 6: ServiceNow, Jira, Slack, Teams, AWS/Azure/GCP, Splunk, Datadog, Microsoft Sentinel) are, as of Phase 3, ten `MockIntegrationProvider` instances behind `IntegrationsRegistryService` (see ADR-0008) — `IncidentsService`/`DecisionsService` already broadcast to all of them on incident-created/decision-decided; Phase 6 swaps mocks for real implementations one at a time without touching either service.

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

| Concern           | Choice                                       | Why (full rationale in DECISION_LOG.md / ADRs)                          |
| ----------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Language          | TypeScript everywhere                        | One language across api/web/shared, shared types with no codegen        |
| Package manager   | npm workspaces                               | Zero extra tooling given the target machine's baseline                  |
| Backend           | NestJS                                       | Modular DI maps to RBAC guards, tenant scoping, per-integration modules |
| Frontend          | Next.js (App Router)                         | Multi-view dashboard/timeline UI, SSR for report views                  |
| Database          | PostgreSQL                                   | Relational, strong multi-tenant + audit/evidence data support           |
| ORM               | Prisma (6.x — see ADR-0003)                  | Type-safe client + file-based migrations                                |
| Multi-tenancy     | Shared schema, `tenantId` scoping (ADR-0004) | Operationally simple at current stage; RLS deferred                     |
| Auth              | Self-hosted JWT (ADR-0005)                   | No external account/vendor available to an autonomous build             |
| Testing           | Jest                                         | One runner across the whole monorepo                                    |
| Lint/format       | ESLint (flat config) + Prettier              | Current ESLint standard, single shared config                           |
| CI/CD             | GitHub Actions                               | No-cost, zero-setup once pushed to GitHub                               |
| Security scanning | CodeQL, npm audit, Dependabot, gitleaks      | Baseline SAST + dependency CVEs + secret scanning, all free             |
| Containers        | Docker (multi-stage) + docker-compose        | Reproducible local dev, deployable images                               |

## 5. Cross-cutting concerns

- **Multi-tenancy:** every tenant-owned Prisma model carries `tenantId`; all `apps/api` queries scope by it via the authenticated request's JWT claims (`AuthenticatedUser.tenantId`), never a client-supplied tenant ID. See ADR-0004.
- **AuthN/AuthZ:** `JwtAuthGuard` (authentication) and `RolesGuard` + `@Roles(...)` (authorization, `OWNER > ADMIN > MEMBER` rank) are applied at the controller/route level, not inside handler bodies. See `apps/api/src/auth/guards/`.
- **API Gateway concerns:** global `ValidationPipe` (whitelist + transform), global `AllExceptionsFilter` (consistent JSON error shape), versioned `/api/v1` prefix, OpenAPI/Swagger at `/api/v1/docs`. See `apps/api/src/main.ts`.
- **Auditability:** every `Incident`/`Decision`/`Evidence`/`Action` mutation writes a `TimelineEvent` row in the same operation (see ADR-0006) — `TimelineEvent` is not directly writable via the API, so the timeline can be trusted to reflect what services actually did.
- **State transition integrity:** `apps/api/src/common/state-machine` provides a single, reusable `assertValidTransition` guard; every legal transition (including same-state) must be explicitly listed per entity — there is no implicit no-op (see ADR-0007 and the bug this caught, in DECISION_LOG.md).
- **Principle 1 — the AI decides nothing alone:** `DecisionsService.decide()` is the only code path that can set a `Decision` to `DECIDED`, and it hard-requires a non-empty `humanDecision` plus a `decidedByUserId` that resolves to a real member of the tenant. See ADR-0007.
- **Integration isolation:** each Phase 6 integration is a `MockIntegrationProvider` (real implementations later) behind `IntegrationsRegistryService`; a provider that throws is caught and logged per-provider, never allowed to fail the triggering request. See ADR-0008.
- **No blank state:** the Executive Command Center's "what to show" logic is computed once, server-side (`GET /incidents/:id/command-center`), not reimplemented per frontend surface. See ADR-0009.
- **No black-box confidence:** the Decision Intelligence Engine reports four independent, auditable dimensions (`evidenceCompleteness`, `sourceReliability`, `dataFreshness`, `aiCertainty`) — never merged into a single score, and never accepted from a client. Each is a deterministic function of real `Evidence` rows; `aiCertainty` is explicitly documented as a heuristic, not a trained-model output, since no model or historical corpus exists. See ADR-0010.

## 6. What's not built yet

No reporting (Executive Brief Generator, Decision Reports, Lessons Learned, Knowledge Base — Phase 5), no real external integrations (Phase 6 — the mocks exist, see above). Phases 1–4 are complete: Foundation, Platform core, the Incident/Decision domain model with its guards and Command Center, and the Decision Intelligence Engine's confidence model. The Decision Intelligence Engine does not itself generate the qualitative analysis (situation summary, recommended decision, risks, etc.) — no LLM integration exists in this environment; those fields are supplied by whoever calls `POST /incidents/:id/analyze` (today: a human analyst) and validated, not fabricated by an algorithm. See [PREREQUIS.md](../../PREREQUIS.md) for what Phases 5–6 add, and `memory/context.md` for what's explicitly blocked pending user input.

## 7. Change process

Any change to this document that reflects a genuinely new architectural decision (not a wording fix) should be paired with an entry in [DECISION_LOG.md](../../DECISION_LOG.md) and, if it's a significant/hard-to-reverse choice, an [ADR](../adr/README.md).
