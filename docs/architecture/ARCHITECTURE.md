# Architecture Overview

Status: Living document. Reflects Phase 1 (Foundation) and Phase 2 (Platform core — Auth, RBAC, Tenant Management, API Gateway, Core Database), both complete; will be extended as each subsequent phase in [PREREQUIS.md](../../PREREQUIS.md) lands. Stack decisions here are recorded with full rationale in [DECISION_LOG.md](../../DECISION_LOG.md) and, where architecturally significant, in an [ADR](../adr/README.md).

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
                         │  ── Decision Intel module │  <- Phase 4
                         │  ── Reporting module      │  <- Phase 5
                         │  ── Integrations modules  │  <- Phase 6
                         └────────────┬─────────────┘
                                      │ Prisma
                         ┌────────────▼─────────────┐
                         │       PostgreSQL          │
                         │  Tenant / User /          │
                         │  Membership / RefreshToken│
                         └───────────────────────────┘

           packages/shared  — TS types/DTOs/contracts shared by web + api
```

Full endpoint reference: [docs/api/README.md](../api/README.md). Auth/tenancy design rationale: ADR-0003 (Prisma), ADR-0004 (shared-schema multi-tenancy), ADR-0005 (self-hosted JWT auth).

External integrations (Phase 6: ServiceNow, Jira, Slack, Teams, AWS/Azure/GCP, Splunk, Datadog, Microsoft Sentinel) attach as dedicated NestJS modules behind the API Gateway module — each integration is isolated so a failure or credential issue in one does not affect others.

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
- **Auditability:** `createdAt`/`updatedAt` exist on every model now; richer per-action attribution (who did what, when) is still open for Phase 4/5 (Evidence Collection, Decision Reports, Lessons Learned) and should be designed before those phases add mutating endpoints beyond auth/tenant management.
- **Integration isolation:** each Phase 6 integration is its own NestJS module with its own credentials/config namespace, so one integration's outage/misconfiguration cannot cascade.

## 6. What's not built yet

No business/incident/decision data model, no dashboards, no Decision Intelligence Engine, no reporting, no external integrations. Phase 2's deliverable is Auth + RBAC + Tenant Management + API Gateway + Core Database only — see [PREREQUIS.md](../../PREREQUIS.md) for what Phases 3–6 add, and `memory/context.md` for what's explicitly blocked pending user input (Phase 4 algorithm design, Phase 6 credentials).

## 7. Change process

Any change to this document that reflects a genuinely new architectural decision (not a wording fix) should be paired with an entry in [DECISION_LOG.md](../../DECISION_LOG.md) and, if it's a significant/hard-to-reverse choice, an [ADR](../adr/README.md).
