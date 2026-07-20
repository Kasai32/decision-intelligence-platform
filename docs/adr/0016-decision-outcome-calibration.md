# 0016. Decision outcome calibration: closing the loop on the confidence model

Date: 2026-07-20

## Status

Accepted

## Context

A critical review of the whole platform flagged the Decision Intelligence Engine's central weakness (ADR-0010): its four confidence dimensions are deterministic, hand-tuned linear heuristics (a hardcoded reliability-by-source-category table, a linear time-decay formula, fixed weights) — honestly disclosed as such in code and docs, but never validated against a real outcome. Nothing in the system checks whether "high `evidenceCompleteness`" actually correlates with a good decision. The user was offered three options — reframe the branding honestly, leave it as-is, or build real calibration — and chose real calibration, explicitly accepting that this is substantially more work than a documentation pass, given no historical decision/outcome corpus exists in this environment.

## Decision

### `DecisionOutcome` — always human-attested, never computed

A new model, one row per `Decision`, recordable only once its incident is `CLOSED` (mirrors `LessonLearned`'s gate — a retrospective before closure isn't one) and only for a `Decision` that reached `DECIDED` (Principle 1: only a real, human-made decision has an outcome to judge). `outcomeQuality` (`GOOD`/`BAD`/`MIXED`/`UNKNOWN`) and free-text `notes` are supplied entirely by a named human via `POST /decisions/:id/outcome` — **the system never grades its own recommendation**. `intelligenceAnalysisId` is the one server-computed field: the most recent `IntelligenceAnalysis` for the incident that existed _at `decision.decidedAt`_ (not whatever's most recent when the outcome is recorded later) — the analysis that could actually have informed the human, not a lucky/unlucky later one.

### `CalibrationService` — a real, small statistic, not a trained model

`GET /decision-intelligence/calibration-report` computes, per confidence dimension, the mean value among `GOOD`-outcome decisions vs. `BAD`-outcome decisions (excluding `MIXED`/`UNKNOWN` as ambiguous, and outcomes with no linked analysis), and their difference. Below `MIN_SAMPLE_SIZE` (5, combined `GOOD`+`BAD` — a disclosed placeholder, not derived from a real power analysis, since no effect-size estimate exists yet either), a dimension is marked `sufficientData: false` and the frontend shows "not enough data yet" instead of a falsely precise number. This is genuinely computed from whatever real data exists — including zero — never fabricated to look more mature than the sample supports.

### Frontend

`DecisionOutcomePanel` (Command Center → Reports tab, alongside `DecisionReportsPanel`) — one row per decision, a record form once the incident is `CLOSED`, the recorded outcome shown once one exists. A standalone `/calibration` page renders the report: total labeled outcomes, and per-dimension mean-when-GOOD / mean-when-BAD (via the existing `ConfidenceMeter`) with an explicit "not enough data yet (n of threshold)" badge when applicable.

## Consequences

- **This is a cold-start feature.** With zero real usage, the calibration report will show "not enough data yet" for every dimension indefinitely — that's the correct, honest behavior, not a bug to paper over. It becomes useful once real decisions accumulate real outcomes.
- **A difference in means is not causation, and this doesn't claim to be.** A dimension correlating with `GOOD` outcomes doesn't prove that dimension _causes_ good decisions (confounders are entirely possible — e.g. more experienced responders might both gather more evidence and make better calls independently). The report is a real, disclosed, first-order signal, not a validated causal model.
- **The confidence-scoring formulas themselves (ADR-0010) are unchanged.** This ADR adds a measurement/feedback layer on top; it does not (yet) feed the calibration result back into the scoring weights. Closing that second loop — actually adjusting `RELIABILITY_BY_SOURCE_CATEGORY`/`FRESHNESS_DEGRADATION_FACTOR`/etc. from real calibration data — is a natural next step once enough labeled outcomes exist to justify it, not done here.
- `MIXED`/`UNKNOWN` outcomes and outcomes with no linked analysis are recorded (real audit trail) but excluded from calibration math — a smaller usable sample than total outcomes recorded, disclosed via `totalLabeledOutcomes` vs. each dimension's own sample size.
- One outcome per decision, immutable (no update endpoint) — consistent with `LessonLearned` and every other "human retrospective judgment" record in this codebase; a wrong initial judgment needs a new decision/incident to correct, not a silent edit to history.

## Alternatives considered

- **Skip calibration, just fix the branding** (the "reframe honestly" option) — rejected by explicit user choice; the heuristic-vs-learned gap was judged worth real investment, not just better labeling.
- **Auto-infer outcome quality** (e.g., "the incident closed within SLA" ⇒ `GOOD`) — rejected: this would silently replace human judgment with another heuristic, undermining the entire point of validating heuristics against ground truth. `GOOD`/`BAD` must mean "a human looked at what happened and said so."
- **A larger `MIN_SAMPLE_SIZE`** (e.g. 30, a common rule-of-thumb) — considered, but with zero real corpus today, a threshold that large makes the feature practically invisible for a very long time in this environment; 5 is disclosed as a placeholder specifically so it's revisited once real usage volume is known, not presented as statistically rigorous.
