# 0003. ORM: Prisma

Date: 2026-07-19

## Status

Accepted

## Context

ADR-0002 committed to PostgreSQL but deferred ORM choice to Phase 2, when a real schema was needed. Phase 2 requires a Core Database with Tenant, User, Membership, and RefreshToken models, plus migrations that can run in CI/CD and in Docker.

## Decision

Use Prisma (`@prisma/client` + `prisma` CLI) as the ORM and migration tool for `apps/api`, with `apps/api/prisma/schema.prisma` as the single source of truth for the schema.

## Consequences

- Type-safe query client generated from the schema — matches the "TypeScript everywhere" decision in ADR-0002, no hand-written SQL type definitions to keep in sync.
- Migrations are file-based (`prisma/migrations/`) and reviewable in PRs, and `prisma migrate deploy` is scriptable in Docker/CI.
- Adds a codegen step (`prisma generate`) to the build pipeline — every Dockerfile/CI step that builds `apps/api` must run it first.
- Prisma's relational-query API is less flexible than raw SQL for very complex queries; acceptable now, and Prisma supports raw SQL escape hatches (`$queryRaw`) if Phase 4's evidence/analytics queries need them later.

## Alternatives considered

- TypeORM — more flexible/lower-level, but weaker type inference and a more verbose migration workflow.
- Drizzle ORM — lighter weight, SQL-like, growing fast, but less mature migration tooling than Prisma at time of writing.
- Raw `pg` + hand-written SQL — maximum control, but no type safety and a lot more boilerplate for a schema that will grow substantially over Phases 2–5.
