# 0007. State transition guard engine + Principle 1 (AI decides nothing alone)

Date: 2026-07-19

## Status

Accepted

## Context

Phase 3's spec (see `PREREQUIS.md` §2 — State Transition Guards) requires two distinct things that are related but not identical:

1. **Generic state-machine integrity**: an `Incident` or `Decision` must not jump between states arbitrarily (e.g. `OPEN` straight to `CLOSED`, skipping `MITIGATED`/`RESOLVED`) — a structural guard, independent of what the states represent.
2. **A specific business rule for `Decision → DECIDED`**: this transition additionally requires a named, real, tenant-member human (`decidedByUserId`) and their decision text (`humanDecision`) — not just a structurally valid transition. This is "Principle 1" from the spec: the system must never let a `Decision` become `DECIDED` through automation alone.

These are different concerns (generic FSM integrity vs. one domain-specific authorization rule) and are implemented as two separate, composable layers rather than one entangled check.

## Decision

- **Generic engine**: `apps/api/src/common/state-machine/state-machine.ts` exports `assertValidTransition(entityName, transitionMap, from, to)`, throwing `BadRequestException` on any transition not explicitly listed in the map. Per-entity transition tables live next to their module (`incidents/incident.state-machine.ts`, `decisions/decision.state-machine.ts`, `actions/action.state-machine.ts`) — e.g. `Incident`: `OPEN → MITIGATED → RESOLVED → CLOSED` only, no skipping, no going backward (a `REOPENED` path is intentionally not modeled yet — out of scope for this Phase 3 cut).
- **Principle 1 enforcement**: `DecisionsService.decide()` runs the generic transition check first (`OPEN → DECIDED` must be structurally legal), then performs a second, business-specific check: `decidedByUserId` must be supplied and must resolve to an actual `Membership` row in the same tenant (a real, verified person — not a free-text name, not the calling service, not an unauthenticated string). Both `humanDecision` (non-empty, enforced by the DTO's `class-validator` rules — the request boundary) and `decidedByUserId` (existence, enforced by a DB lookup — not expressible as a DTO decorator) are required; failing either throws `BadRequestException` and the `Decision` row is not modified.
- The human named in `decidedByUserId` does not have to be the same person as the authenticated API caller (`request.user`) — an assistant may record a decision made by an executive in a meeting. What's enforced is that _some_ real, tenant-scoped human is named and attributed, not that the caller and the decider are identical. The API caller is separately recorded as the `actorUserId` on the resulting `TimelineEvent`, so both facts (who called the API, who actually decided) are preserved.

## Consequences

- The two-layer design means adding a new guarded entity (e.g. `Action` status) only needs a transition table, not a reimplementation of the guard mechanism.
- Because the human-stakeholder check is a DB lookup, it cannot be expressed as a pure DTO validator — it correctly lives in `DecisionsService`, consistent with `CODING_STANDARDS.md`'s "business logic lives in services, not controllers" rule.
- No transition — structural or the human-stakeholder rule — can be bypassed by calling Prisma directly from anywhere except `DecisionsService`/`IncidentsService`/`ActionsService`; this is a code-review/discipline requirement (no DB-level enforcement of the human-stakeholder rule) and is explicitly noted here as a known limitation, not a guarantee. A Postgres trigger/check-constraint could add DB-level enforcement later if that gap matters more (e.g. once Phase 6 integrations write to the same tables); not needed for the current single-writer (`apps/api`) architecture.

## Alternatives considered

- Enforce state transitions purely via Prisma/Postgres constraints (e.g. a check constraint per status column) — rejected for the human-stakeholder rule specifically, since "does this user ID belong to this tenant" is a relational check Postgres check-constraints can't express directly without triggers; application-layer enforcement is simpler and the standard pattern for this kind of business rule.
- Fold the human-stakeholder check into a DTO validator — rejected, DTO validators run at the request boundary with no DB access; the tenant-membership check is inherently a data lookup, not a shape check.
