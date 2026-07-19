# 0010. Decision Intelligence Engine: multidimensional confidence model + AI Output Contract

Date: 2026-07-19

## Status

Accepted

> Note: the user's Phase 4 instructions referred to this as "ADR-0007" — that number is already taken by the Phase 3 state-transition-guards ADR. Following the numbering rule in `docs/adr/README.md` ("next number after the highest existing one"), this is ADR-0010. Flagged here rather than silently renumbered or silently overwriting ADR-0007.

## Context

Phase 4 (Decision Intelligence Engine) requires a confidence model. The user's explicit directive: **no single opaque "94% confident" score** — the market (and this platform's own CISO/incident-commander audience) has rejected black-box aggregate confidence numbers. The model must be multidimensional, deterministic, and auditable, with four named dimensions that are never merged into one figure: `evidenceCompleteness`, `sourceReliability`, `dataFreshness`, `aiCertainty`. The user supplied exact algorithms for the first three and a general description for the fourth, plus a strict `AIOutputContract` shape that must be validated, not assumed.

Two things had to be resolved that the spec didn't fully pin down:

1. **What does "required evidence sources for CLOUD_OUTAGE" mean in terms of actual schema fields?** The existing `Evidence` model (Phase 3) has a free-text `source` (tool name, e.g. "Datadog") and an `EvidenceType` (LOG/METRIC/HUMAN_INPUT/EXTERNAL_LINK/OTHER — what _kind_ of artifact it is). Neither captures "which category of system did this come from" (monitoring vs. cloud-provider-native vs. chat vs. ticketing), which is what the completeness algorithm needs.
2. **`aiCertainty` has no algorithm in the spec, only a description** ("variance of the analysis... clarity of patterns... vs. historical knowledge base"). This platform has no trained model and no historical knowledge base yet — Phase 4 is building the first version of this system. Inventing a fake "ML confidence" here would be exactly the black-box behavior the user is rejecting.

## Decision

### Schema additions (see `apps/api/prisma/schema.prisma`)

- `Incident.type: IncidentType` (new enum: `CLOUD_OUTAGE`, `SECURITY_BREACH`, `DATA_LOSS`, `PERFORMANCE_DEGRADATION`, `OTHER`; defaults to `OTHER`).
- `Evidence.sourceCategory: EvidenceSourceCategory` (new enum: `MONITORING`, `CLOUD_PROVIDER`, `LOG_AGGREGATOR`, `TICKETING`, `CHAT`, `HUMAN`, `OTHER`; defaults to `OTHER`) — distinct from the existing `Evidence.type` (artifact kind) and `Evidence.source` (specific tool name). `sourceCategory` is what the completeness and reliability algorithms key off of.

### The four dimensions (`apps/api/src/decision-intelligence/scoring/`), each a pure, independently testable function returning an integer 0–100, never combined:

- **`evidenceCompleteness(incidentType, presentCategories)`** — `REQUIRED_EVIDENCE_SOURCES: Record<IncidentType, EvidenceSourceCategory[]>` is an explicit, readable lookup table (e.g. `CLOUD_OUTAGE → [MONITORING, CLOUD_PROVIDER]`, matching the user's example exactly: one of two present → 50%). `OTHER` requires nothing (returns 100 — an unclassified incident isn't penalized for a checklist that doesn't apply to it).
- **`sourceReliability(evidenceList)`** — `RELIABILITY_BY_SOURCE_CATEGORY: Record<EvidenceSourceCategory, number>` (e.g. `CLOUD_PROVIDER: 95`, `CHAT: 40`, matching the user's CloudTrail/Slack examples), averaged per the spec ("sum divided by count"). Zero evidence → `0`, not a fabricated default.
- **`dataFreshness(evidenceList, severity, now)`** — `max(0, 100 - Δt × k)`, `Δt` = minutes since the _most recent_ evidence (interpreted as "freshest available signal"; the alternative reading — evidence tagged with an importance/criticality field — isn't supported by the current schema and would need a new field with no clear source of truth for who sets it; revisit if that reading turns out to be what's actually wanted). `k` varies by `IncidentStatus` severity (`CRITICAL: 5`, `HIGH: 2`, `MEDIUM: 1`, `LOW: 0.3`) so a critical incident's information goes stale far faster than a low-severity one — matching "drops drastically" for the cases that matter most. `now` is an explicit parameter (defaults to `new Date()` at the call site), not read from the system clock inside the function, so decay is exactly reproducible in tests.
- **`aiCertainty(evidenceCount, uniqueSourceCategoryCount, conflictCount)`** — a deterministic heuristic, explicitly documented as such, not a trained-model output: `base = min(70, evidenceCount × 15)` (more evidence raises certainty, capped), `+ diversityBonus = min(20, uniqueCategories × 7)` (corroboration across distinct source types raises certainty further, capped), `− conflictPenalty = conflictCount × 15` (flagged contradictions lower certainty), clamped to `[0, 100]`. Every input is a real, countable fact about the evidence actually attached to the incident — there is no black-box model behind this number, and the code comment says so explicitly.

### AI Output Contract: computed fields can never be supplied by the caller

`AIOutputContractDto` (`apps/api/src/decision-intelligence/dto/ai-output-contract.dto.ts`) validates the _full, assembled_ contract via `class-validator`, with every field required (including `missingInformation`/`conflictingInformation` as required arrays — present, even if empty, never omitted — this is the literal implementation of the user's "Principle 3: never hidden"). The controller endpoint (`POST /incidents/:id/analyze`) only accepts a narrower `SubmitIntelligenceAnalysisDto` from the caller — the qualitative/judgment fields (`situationSummary`, `businessImpact`, `criticalRisks`, `recommendedDecision`, `alternativeDecisions`, `expectedConsequences`, `immediateNextActions`, `executiveSummary`, `conflictingInformation`). **`confidenceDimensions`, `evidenceUsed`, and the evidence-completeness portion of `missingInformation` are always computed server-side from the incident's real `Evidence` rows and can never be supplied or overridden by the request body.** `DecisionIntelligenceEngineService.analyze()` assembles the two halves, validates the _result_ against `AIOutputContractDto` (throwing `BadRequestException` on any structural violation), persists it as an `IntelligenceAnalysis` row, and writes a `TimelineEvent`.

## Consequences

- No caller — human, script, or a future real LLM integration — can self-report a confidence number; the platform always computes it independently from the same `Evidence` rows a human could audit by hand. This is the core trust property the user asked for.
- `aiCertainty` is honestly a heuristic proxy, not a model-derived certainty, because no trained model or historical corpus exists yet. This is stated in code comments and here, not hidden. If/when a real historical-pattern-matching capability is built, only this one function's internals need to change — its signature and role in the contract stay the same.
- The qualitative narrative fields (`situationSummary`, `criticalRisks`, `recommendedDecision`, etc.) are **not generated by any algorithm in this codebase** — there is no LLM integration wired up (same constraint as Phase 6: no credentials/API key exists in this environment for a real LLM call). They are supplied by whoever calls the endpoint (today: a human analyst; later: a real LLM integration producing structured output that must still pass the same `AIOutputContractDto` validation). This is a deliberate scope boundary, not an oversight — fabricating plausible-sounding recommendation text via hardcoded rules would itself be exactly the kind of unaudited black box the user is rejecting.
- Two new required-with-default enum fields (`Incident.type`, `Evidence.sourceCategory`) mean every existing/future `Incident`/`Evidence` row needs a `type`/`sourceCategory` to get a meaningful completeness/reliability score; rows left at the `OTHER` default will read as fully-complete/neutral-reliability rather than incomplete — a conservative default (never penalizes an unclassified incident) rather than a silently wrong one.

## Alternatives considered

- A single blended confidence score (weighted average of the four dimensions) — explicitly rejected per the user's directive and the stated market rejection of single-number confidence claims.
- Faking `aiCertainty` via a hardcoded incident-type-based constant — rejected: indistinguishable from a black box, and dishonest about there being no real pattern-matching behind it.
- Letting the request body supply `confidenceDimensions` directly (simpler endpoint, less code) — rejected: defeats the entire point of an auditable, non-self-reported confidence model.
