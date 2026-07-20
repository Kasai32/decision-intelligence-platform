# 0021. Entity-relationship intelligence graph + analyst-activity audit log

Date: 2026-07-20

## Status

Accepted

## Context

The user set a new direction for the platform's mission: government intelligence analysis, in the mold of Palantir Gotham's actual capabilities — data integration across sources, link analysis (who is connected to whom), geospatial analysis, and secure analyst collaboration. But the explicit core mission is the opposite of Gotham's real-world reputation for opacity: make analysts faster and better, while protecting civil liberties by keeping a human analyst in control of every judgment, never automated surveillance acting on its own.

Everything built in this platform up to now (Principle 1 — ADR-0007, the confidence-explainability work — ADR-0019, RLS-based tenant isolation — ADR-0015) is philosophically the same discipline this mission needs, just applied to incident response instead of intelligence analysis. This ADR is the first step of extending it: a real entity-relationship data model (not a UI mockup) and — the piece that makes "protect civil liberties" a mechanism instead of a slogan — an audit log of what analysts _do_ with the system, not just what the system finds.

## Decision

### Entities and relationships — a real graph, never a bare assertion

`Entity` (person / organization / location / event) and `Relationship` (a directed, typed edge between two entities) are new first-class models, tenant-scoped like everything else (RLS + `FORCE ROW LEVEL SECURITY`, same as ADR-0015). Every entity requires an `EntityEvidenceLink` at creation — it must cite the real `Evidence` row it was identified from; every relationship requires a `RelationshipEvidenceLink` the same way. Neither can exist as a floating, unsourced claim.

**A relationship always starts `SUGGESTED`, never `CONFIRMED`, regardless of who creates it or what evidence they cite.** This is Principle 1 (ADR-0007) extended from decisions to connections: citing evidence when proposing a link is not the same act as a human explicitly confirming it, and `RelationshipsService.confirm()` enforces both — a real state-machine transition (`relationship.state-machine.ts`, mirroring `decision.state-machine.ts`) and a hard requirement of at least one evidence citation, checked in code, not just documented. A rejected relationship is kept, not deleted (`RelationshipStatus.REJECTED`) — Principle 3, "never hidden by omission": a hypothesis a human explicitly ruled out is still part of the record.

Entity resolution ("is J. Smith the same person as John Smith?") gets the identical treatment via `EntityMergeSuggestion` — the system can propose a merge with a stated `reason`, a human accepts or rejects it, nothing auto-merges silently. Auto-merging two people's records without review is exactly the kind of unaccountable behavior the civil-liberties mission exists to prevent.

### The audit log — logging the analyst, not just the system

`AuditLogEntry` is a new, append-only table (no update/delete method exists, matching `TimelineEvent`'s existing immutability) recording every read and write against the graph: who (`actorUserId`), what action, against what target, when, and — for `SEARCH`/`VIEW_ENTITY`/`VIEW_GRAPH` specifically — _why_. That `reason` field is enforced, not optional, at the DTO layer (`SearchEntitiesDto`, `ViewReasonDto` both require a non-empty string); a search or view request with no stated purpose is rejected with `400`, before it ever touches the graph. `GET /audit-log` (the review surface) is gated `@Roles(Role.ADMIN)` — the point of an audit log is that the people being audited don't get to decide who reviews it.

This is the concrete answer to "how do you protect civil liberties without full automation": Palantir's real-world criticism has never really been about the technology finding connections — it's that nobody outside the tool can see what got cross-referenced, by whom, or why. Logging analyst activity with enforced purpose statements, reviewable by a role the analyst doesn't control, is the mechanism that makes oversight real instead of aspirational.

## Consequences

- Six new tenant-scoped tables (`entities`, `relationships`, `entity_evidence_links`, `relationship_evidence_links`, `entity_merge_suggestions`, `audit_log_entries`), each with its own RLS policy (`entity_relationship_rls` migration) — verified live against a real Postgres, including a genuine cross-tenant isolation proof (`test/entities-and-audit-log.e2e-spec.ts`), not just unit-mocked.
- Every entity/relationship read now carries a real cost: the caller must state a reason. This is a deliberate friction, not an oversight — purpose limitation only means something if it's enforced at the point of access, not requested as a courtesy.
- No frontend surface exists yet for any of this — no graph visualization, no search UI, no audit-log review page. This ADR is the data model and API layer only; `packages/shared`'s new types (`Entity`, `Relationship`, `EntityGraph`, `AuditLogEntry`) document the wire contract ahead of the UI, the same pattern ADR-0019's confidence-breakdown types followed.
- `getGraph()` returns only the direct (one-hop) relationships of a single entity, not a recursive N-hop traversal — a reasonable v1 scope; multi-hop graph queries are a natural follow-up once there's a UI to actually explore them.
- Data integration (pulling from real external sources), geospatial analysis, and secure collaboration — the other three pillars named alongside link analysis — are not addressed here. This ADR is scoped to the graph data model and the audit log specifically, per the user's explicit "build the audit log next."

## Alternatives considered

- **Auto-confirming a relationship the moment evidence is cited.** Rejected — collapses "here's a candidate connection with support" and "a human judged this to be true" into one step, which is exactly the automated-surveillance failure mode the mission rejects.
- **Making the audit log's `reason` field optional, or a soft UI nudge rather than a validated requirement.** Rejected — an optional purpose statement is decoration; the entire value of purpose limitation is that it can't be skipped.
- **Silent, confidence-scored auto-merging of likely-duplicate entities.** Rejected — the same reasoning as never auto-confirming a relationship: a merge is an identity claim ("these records are the same person"), which is squarely a human judgment call, not something to automate away.
- **A generic "role can see everything" model for audit log access, no dedicated gate.** Rejected in favor of reusing the existing `ADMIN` role rather than inventing a new one — a dedicated "auditor/compliance officer" role (distinct from ADMIN, so a compliance reviewer isn't also a data-modifying admin) is a real refinement worth making later, once real usage shows whether that separation of duties actually matters in practice; not invented speculatively here.
