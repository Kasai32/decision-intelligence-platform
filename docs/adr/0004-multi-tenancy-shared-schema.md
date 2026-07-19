# 0004. Multi-tenancy: shared schema with `tenantId` scoping

Date: 2026-07-19

## Status

Accepted

## Context

Phase 2 requires Tenant Management, and every subsequent phase (Incident/Decision Timelines, Evidence Collection, Reports) produces per-tenant data. The isolation strategy has to be picked before the first migration is written, because it shapes every table from here on — this is exactly the kind of decision `memory/context.md` flagged as needing an ADR before Phase 2 schema work started.

Three standard strategies exist: database-per-tenant, schema-per-tenant, and shared-schema with a `tenantId` discriminator column (optionally backed by Postgres Row-Level Security).

## Decision

Shared schema: every tenant-owned table carries a `tenantId` column (FK to `Tenant.id`), and all queries are scoped by it at the application layer (Prisma queries always include `tenantId` in their `where` clause, enforced via a request-scoped tenant context derived from the authenticated JWT). Postgres Row-Level Security is noted as a defense-in-depth layer to add once the schema stabilizes, not required for Phase 2's initial cut.

## Consequences

- Single database, single connection pool, single migration path — operationally simple at the current stage (unknown tenant count, unknown scale).
- Every new table and every new query from Phase 2 onward must include tenant scoping; this is a discipline burden enforced by code review / a lint rule to be added, not by the database engine alone (until RLS is layered in).
- Cross-tenant analytics (if ever needed) are simpler than with database-per-tenant, since all data lives in one place.
- Onboarding/offboarding a tenant is a row-level operation, not a database-provisioning operation — much cheaper at low-to-moderate tenant counts.
- Weakest isolation of the three options at the infrastructure level until RLS is added — acceptable given no compliance requirement (SOC2/HIPAA) has been specified yet (see `memory/context.md`); revisit if/when one is.

## Alternatives considered

- **Database-per-tenant** — strongest isolation, but operationally expensive (migrations must run N times, connection pooling per tenant) at a stage where tenant count and compliance requirements are both unknown. Overkill for Phase 2.
- **Schema-per-tenant** — a middle ground, but Prisma's support for dynamic schema selection per request is awkward, and it still doesn't remove the need for the app layer to route to the right schema per request — most of the discipline burden of shared-schema without the operational simplicity.
