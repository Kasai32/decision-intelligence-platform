# Architecture Overview

Status: Living document. Reflects the Phase 1 foundation; will be extended as each subsequent phase in [PREREQUIS.md](../../PREREQUIS.md) lands. Stack decisions here are recorded with full rationale in [DECISION_LOG.md](../../DECISION_LOG.md) and, where architecturally significant, in an [ADR](../adr/README.md).

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
                         │  ── API Gateway module    │  <- Phase 2
                         │  ── Auth / RBAC module    │  <- Phase 2
                         │  ── Tenant module         │  <- Phase 2
                         │  ── Decision Intel module │  <- Phase 4
                         │  ── Reporting module      │  <- Phase 5
                         │  ── Integrations modules  │  <- Phase 6
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │       PostgreSQL          │
                         │  (core system of record)  │
                         └───────────────────────────┘

           packages/shared  — TS types/DTOs/contracts shared by web + api
```

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

## 4. Technology stack (Phase 1 decisions)

| Concern           | Choice                                  | Why (full rationale in DECISION_LOG.md)                                 |
| ----------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| Language          | TypeScript everywhere                   | One language across api/web/shared, shared types with no codegen        |
| Package manager   | npm workspaces                          | Zero extra tooling given the target machine's baseline                  |
| Backend           | NestJS                                  | Modular DI maps to RBAC guards, tenant scoping, per-integration modules |
| Frontend          | Next.js (App Router)                    | Multi-view dashboard/timeline UI, SSR for report views                  |
| Database          | PostgreSQL                              | Relational, strong multi-tenant + audit/evidence data support           |
| Testing           | Jest                                    | One runner across the whole monorepo                                    |
| Lint/format       | ESLint (flat config) + Prettier         | Current ESLint standard, single shared config                           |
| CI/CD             | GitHub Actions                          | No-cost, zero-setup once pushed to GitHub                               |
| Security scanning | CodeQL, npm audit, Dependabot, gitleaks | Baseline SAST + dependency CVEs + secret scanning, all free             |
| Containers        | Docker (multi-stage) + docker-compose   | Reproducible local dev, deployable images                               |

## 5. Cross-cutting concerns (established now, used from Phase 2 onward)

- **Multi-tenancy:** the Core Database and API Gateway are designed from Phase 2 to scope every request/row by `tenant_id`; no tenant-unaware code paths should be added once Phase 2 starts.
- **AuthN/AuthZ:** NestJS Guards will enforce authentication and RBAC at the module boundary, not inside individual handlers.
- **Auditability:** because Phase 4/5 (Evidence Collection, Decision Reports, Lessons Learned) require traceability, every mutating API action should be designed to be attributable to a user + tenant + timestamp from the moment persistence is introduced in Phase 2.
- **Integration isolation:** each Phase 6 integration is its own NestJS module with its own credentials/config namespace, so one integration's outage/misconfiguration cannot cascade.

## 6. What Phase 1 deliberately does not include

No business logic, no auth, no database schema, no UI beyond a health-check/placeholder page. Phase 1's deliverable is the scaffolding itself — see [PREREQUIS.md](../../PREREQUIS.md).

## 7. Change process

Any change to this document that reflects a genuinely new architectural decision (not a wording fix) should be paired with an entry in [DECISION_LOG.md](../../DECISION_LOG.md) and, if it's a significant/hard-to-reverse choice, an [ADR](../adr/README.md).
