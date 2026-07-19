# Architecture Decision Records

An ADR captures a single significant, hard-to-reverse architectural decision: the context that forced it, the decision itself, and the consequences. Not every technical decision needs one — day-to-day choices go in [DECISION_LOG.md](../../DECISION_LOG.md) instead. Write an ADR when the decision is expensive to reverse later (a framework, a data model shape, a security boundary, an integration pattern).

## Process

1. Copy `template.md` to `NNNN-short-title.md` (zero-padded, sequential, next number after the highest existing one).
2. Fill it in. Status starts as `Proposed`, moves to `Accepted` once acted on (in this autonomous-build context, decisions are logged as `Accepted` directly, since there is no separate review step — see [DECISION_LOG.md](../../DECISION_LOG.md) entry on autonomous operation).
3. Link the ADR from the relevant section of `docs/architecture/ARCHITECTURE.md` if it affects the system diagram or stack table.
4. An ADR is never deleted. If superseded, mark it `Superseded by ADR-NNNN` and link forward; the old one stays as historical record.

## Index

| ADR                                           | Title                                                                       | Status   |
| --------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions as ADRs                                       | Accepted |
| [0002](0002-core-technology-stack.md)         | Core technology stack (TypeScript/NestJS/Next.js/PostgreSQL/npm workspaces) | Accepted |
| [0003](0003-orm-prisma.md)                    | ORM: Prisma                                                                 | Accepted |
| [0004](0004-multi-tenancy-shared-schema.md)   | Multi-tenancy: shared schema with `tenantId` scoping                        | Accepted |
| [0005](0005-self-hosted-jwt-auth.md)          | Authentication: self-hosted email/password + JWT                            | Accepted |
