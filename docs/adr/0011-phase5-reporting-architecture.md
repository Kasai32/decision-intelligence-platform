# 0011. Phase 5 Reporting: immutable generated artifacts, factual auto-assembly, no fabricated narrative

Date: 2026-07-19

## Status

Accepted

## Context

Phase 5's roadmap entry (`PREREQUIS.md`) lists four items with no further detail: Executive Brief Generator, Decision Reports, Lessons Learned, Knowledge Base — unlike Phase 3/4, the user did not supply an explicit technical spec this time, just "continue the autonomous loop on Phase 5." Design judgment calls had to be made and are recorded here rather than silently assumed.

Three questions needed resolving before writing code:

1. **Computed view or persisted artifact?** A "brief" or "report" could be computed fresh on every request (like the Phase 3 Command Center summary, ADR-0009) or generated once and stored immutably (like the Phase 4 `IntelligenceAnalysis`, ADR-0010).
2. **Who writes the narrative content?** Phase 4 (ADR-0010) established a hard rule: never fabricate qualitative judgment via an algorithm dressed up as intelligence, because no LLM integration exists in this environment. Does that constraint carry over to "Executive Brief" text?
3. **What is a "Knowledge Base" here, concretely?** The term implies search/browse, but over what, and with what search technology?

## Decision

1. **Executive Briefs and Decision Reports are immutable, timestamped, persisted artifacts** (`ExecutiveBrief`, `DecisionReport` Prisma models), generated on `POST`, not recomputed on every read — consistent with `IntelligenceAnalysis` (ADR-0010) and with real-world semantics ("the brief we sent to the board on 2026-07-19" must not silently change later). Every fact field (`incidentStatus`, `keyDecisions`, `evidenceSummary`, etc.) is a snapshot computed server-side from real rows at generation time; the only caller-supplied field is an optional free-text `additionalNotes`.
2. **No fabricated narrative.** The `summary` field on an `ExecutiveBrief` is built from a small, deterministic, factual template (e.g. "Incident '{title}' is {status} ({severity}). {decidedCount} of {totalCount} decisions made.") — real counts and real field values, not invented reasoning. This is the same constraint from ADR-0010 applied consistently: assembling real facts is honest; generating plausible-sounding prose about them is not, absent a real LLM integration (still not present in this environment — see `memory/context.md`). Any actual narrative/judgment a human wants to add belongs in `additionalNotes`.
3. **Lessons Learned are entirely human-authored** (`title`, `whatHappened`, `whatWentWell[]`, `whatToImprove[]`, `actionItems[]`, `tags[]`) — genuine retrospective insight cannot be computed from structured incident data by any algorithm this system has. Creating one requires the target `Incident.status = CLOSED` (checked in `LessonsLearnedService.create()`, `BadRequestException` otherwise) — a retrospective before the incident is actually closed isn't a retrospective.
4. **Knowledge Base = search over `LessonLearned`**, not a new, separate content type or a full-text-search engine. `GET /knowledge-base/search?query=&tags=` runs a Postgres `ILIKE` match against `title`/`whatHappened` plus an array-contains filter on `tags`, scoped to the tenant. No Elasticsearch/pgvector/embedding search — Phase 5's data volume doesn't justify it, and it can be layered in later without changing the endpoint contract.

## Consequences

- Three new Prisma models, each `tenantId`-scoped and indexed, following the exact pattern established in ADR-0006. `TimelineEventType` gains `EXECUTIVE_BRIEF_GENERATED`, `DECISION_REPORT_GENERATED`, `LESSON_LEARNED_CREATED`.
- Generating a new brief/report after an incident's state changes produces a NEW row rather than mutating the old one — history is preserved, consistent with the platform's auditability posture (`docs/architecture/ARCHITECTURE.md` §5).
- The Knowledge Base's search is intentionally simple (ILIKE, not semantic search) — acceptable now, a known scaling limit to revisit if/when Lessons Learned volume grows large enough for keyword search to miss relevant results.
- Nothing here required a new "AI Output Contract"-style validation layer (ADR-0010) because nothing here claims to be AI output — briefs/reports are explicitly factual summaries, and Lessons Learned are explicitly human-authored. This distinction is the throughline from Phase 4: label generated content honestly for what it is.

## Alternatives considered

- Recompute briefs/reports on every `GET`, no persistence — rejected: loses the point-in-time "this is what we told the board" record, and drifts silently as the underlying incident continues to change after the brief was meant to be final.
- Auto-generate Lessons Learned content from timeline data (e.g. "what happened" from `TimelineEvent` descriptions) — rejected: a mechanically concatenated event log is not a lesson; genuine retrospective insight requires human reflection, and presenting the former as the latter would mislead readers about what they're looking at.
- A unified `Report` model with a `type` discriminator instead of three separate models — rejected: `ExecutiveBrief`, `DecisionReport`, and `LessonLearned` have materially different shapes (aggregate-incident vs. single-decision vs. free-form retrospective); a discriminated union model would need most fields nullable, losing the schema-level guarantees the separate-models approach gives for free.
