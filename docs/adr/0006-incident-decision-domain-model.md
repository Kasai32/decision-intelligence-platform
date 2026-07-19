# 0006. Incident/Decision/Evidence/TimelineEvent/Action domain model

Date: 2026-07-19

## Status

Accepted

## Context

Phase 3 requires an Executive Command Center, Incident Timeline, and Decision Timeline. The user's Phase 3 spec (see `PREREQUIS.md` §2 — Domain Model) names five entities strictly required: `Incident`, `Decision`, `Evidence`, `TimelineEvent`, `Action`, each carrying an `organization_id`-equivalent field for tenant isolation.

Two naming questions had to be resolved before writing the schema:

1. The spec says `organization_id`; this codebase's existing multi-tenancy concept (ADR-0004, Phase 2) is `tenantId` on a `Tenant` model. Introducing a parallel `Organization` concept would fragment the tenancy model this system already enforces (auth, RBAC, and every existing table are keyed on `Tenant`/`tenantId`).
2. The spec's field names (`organization_id`, `human_decision`) are snake_case; this codebase's established convention (`CODING_STANDARDS.md`) is camelCase.

## Decision

- **`organization_id` → `tenantId`**: every new model gets a required `tenantId String` field, a `@relation` to the existing `Tenant` model, and an `@@index([tenantId])` — identical pattern to every Phase 2 model. "Organization" and "Tenant" are the same concept in this codebase; no new `Organization` model is introduced.
- **snake_case → camelCase**: field names follow the existing TypeScript/Prisma convention (e.g. the spec's `human_decision` becomes `humanDecision` on `Decision`). The underlying requirement (a human-authored decision text, attributable to a named person) is preserved exactly; only surface naming is normalized.
- **Domain model** (`apps/api/prisma/schema.prisma`):
  - `Incident` — `status` (OPEN/MITIGATED/RESOLVED/CLOSED), `severity` (LOW/MEDIUM/HIGH/CRITICAL), owns `Decision[]`, `Evidence[]`, `TimelineEvent[]`, `Action[]`.
  - `Decision` — belongs to an `Incident`; `status` (OPEN/DECIDED/CANCELLED); `humanDecision` + `rationale` (nullable until decided); `decidedByUserId` (nullable FK to `User` — the named human stakeholder, required to be filled in the same transaction that sets `status = DECIDED`, enforced in the service layer, not just the schema — see ADR-0007).
  - `Evidence` — belongs to an `Incident`, optionally linked to a `Decision`; `type` (LOG/METRIC/HUMAN_INPUT/EXTERNAL_LINK/OTHER); `submittedByUserId` nullable (evidence may originate from an automated integration, see ADR-0008, not only a human).
  - `TimelineEvent` — append-only audit trail per `Incident` (optionally linked to a `Decision`); `type` enum covering incident/decision/evidence/action lifecycle events; `actorUserId` nullable (system-generated events have no human actor); `metadata Json?` for event-specific payloads. Not directly writable via the API — every service that mutates domain state writes its own `TimelineEvent` row in the same operation (see ADR-0007).
  - `Action` — a follow-up task belonging to an `Incident`, optionally linked to a `Decision`; `status` (PENDING/IN_PROGRESS/DONE/CANCELLED); `assignedToUserId` nullable.

## Consequences

- No fragmentation of the multi-tenancy model — every Phase 3 table is provably tenant-isolated by the same mechanism already validated in Phase 2 (ADR-0004), just extended to five new tables.
- `TimelineEvent` being system-managed (not directly POSTable) means the Incident/Decision Timeline UI is guaranteed to reflect what services actually did, not what a client claims happened — important given this is meant to be an audit trail.
- Multiple named relations to `User` (creator, decider, submitter, actor, assignee) make the Prisma schema longer, but give the Executive Command Center genuine "who did what" attribution from day one, consistent with the auditability cross-cutting concern already recorded in `docs/architecture/ARCHITECTURE.md`.

## Alternatives considered

- Introduce a separate `Organization` model distinct from `Tenant` to match the spec's literal wording — rejected: would create two competing tenancy concepts in the same system for no functional benefit, directly contradicting ADR-0004.
- Make `TimelineEvent` a freely POSTable resource — rejected: undermines its value as an audit trail if any client can insert arbitrary history.
