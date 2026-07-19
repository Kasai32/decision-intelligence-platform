# 0002. Core technology stack

Date: 2026-07-19

## Status

Accepted

## Context

Phase 1 requires defining the architecture before any business feature work. Phases 2–6 (Auth/RBAC/Tenant Management, Executive Dashboards, a Decision Intelligence Engine with a Recommendation Engine and Confidence Model, Reporting, and ~10 Enterprise Integrations) impose real requirements on whatever stack is chosen now: it must support strong module boundaries (for per-tenant RBAC and per-integration isolation), a multi-view dashboard frontend, and a relational system of record capable of representing audit/evidence trails. No stack was specified by the user; this had to be decided to make any further progress, and is recorded here because reversing it later (mid-Phase-3+) would be expensive.

## Decision

- **Language:** TypeScript across the whole stack.
- **Backend:** NestJS (`apps/api`).
- **Frontend:** Next.js, App Router (`apps/web`).
- **Shared code:** `packages/shared` for cross-cutting TS types/DTOs.
- **Database:** PostgreSQL (ORM choice deferred to Phase 2, when the first schema is actually written).
- **Package manager / monorepo tool:** npm workspaces (no pnpm/Turborepo layer for now).
- **Test runner:** Jest, uniformly.

## Consequences

- One language end-to-end means `packages/shared` types are consumed directly by both apps with no codegen step — faster iteration, less drift.
- NestJS's DI/module system gives Phase 2 (RBAC guards, tenant-scoping) and Phase 6 (per-integration modules) a natural home without restructuring.
- Commits the project to a Node/TS runtime for the backend. If Phase 4's Confidence Model / Recommendation Engine later needs heavier ML tooling, the likely path is a dedicated Python microservice behind the API Gateway module, not a rewrite of `apps/api` — this is deferred, not precluded.
- npm workspaces is the simplest correct choice today but has weaker caching/task-graph capabilities than Turborepo; acceptable at current scale (2 apps + 1 shared package), revisit if CI build times grow.

## Alternatives considered

- **Python (FastAPI/Django) backend** — better fit for Phase 4's ML-flavored modules, but no Phase 1–3 requirement needs it, and splitting the stack this early adds operational cost (two languages, two CI pipelines, two deploy targets) for no near-term benefit.
- **Express/Fastify instead of NestJS** — less boilerplate for a trivial API, but far weaker structure for the RBAC/tenant/integration module boundaries Phases 2 and 6 explicitly require.
- **Plain Vite+React SPA instead of Next.js** — simpler, but Next's App Router better fits a multi-section "Executive Command Center" with nested layouts, and SSR helps the Phase 5 report-generation views.
- **pnpm/Turborepo instead of npm workspaces** — pnpm wasn't preinstalled on the target machine and activating Corepack unattended was judged an unnecessary risk; can be layered in later without changing the directory structure.
