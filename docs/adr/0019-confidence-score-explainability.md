# 0019. Confidence score explainability: "show your work" in the API and UI

Date: 2026-07-20

## Status

Accepted

## Context

ADR-0010 designed the four confidence dimensions to be auditable rather than a black box — every score is computed from real, countable facts about an incident's evidence, never a trained model's opaque output. But that auditability only existed in the code and the API's persisted numeric fields. After using the live app, the user reported the confidence numbers were "misunderstood" — a bare percentage like `aiCertainty: 44%` is, to the person looking at it, indistinguishable from a black-box score unless the reasoning behind it is actually visible in the product. Theoretical auditability (an engineer could read the source) is not the same as experienced auditability (an analyst looking at the screen can see why).

## Decision

Each of the four scoring functions (`apps/api/src/decision-intelligence/scoring/*.ts`) gained a parallel `explainXxx()` function alongside the existing `computeXxx()`, returning a structured breakdown of every intermediate value the score was built from, not just the final number:

- `explainEvidenceCompleteness` — which required sources are present vs. missing, by name.
- `explainSourceReliability` — every evidence item that contributed, its source name, category, and individual reliability weight.
- `explainDataFreshness` — which evidence was "most recent," how many minutes old, and the severity-specific decay rate applied.
- `explainAiCertainty` — the volume/diversity/conflict terms that summed to the final number, including where a cap was hit.

`computeXxx()` is now a thin wrapper (`explainXxx(...).score`) — one source of truth, so a displayed explanation can never numerically disagree with the score it explains. A new `buildConfidenceBreakdown()` (`apps/api/src/decision-intelligence/confidence-breakdown.ts`) composes all four into one `ConfidenceBreakdown` object from one shared evidence set.

**`POST /incidents/:id/analyze` and `GET /incidents/:id/analyses` both now return `confidenceBreakdown` alongside the existing flat numeric fields.** It's never persisted as its own column — recomputed on every read from the same immutable inputs (the incident's type/severity, and the exact evidence rows an analysis's `evidenceUsed` already references). `list()` passes each analysis's own `createdAt` as `now` when rebuilding its `dataFreshness` breakdown, not the live clock — the persisted freshness score was frozen at that instant, and the breakdown must always reproduce that exact same number, not a lower one that keeps silently dropping every time an old analysis is reopened.

`apps/web`'s `ConfidenceMeter` gained an optional `explanation` prop, rendered as a native `<details>/<summary>` disclosure ("Why this score?") — no new UI dependency, free keyboard/accessibility behavior. `IntelligenceAnalysisPanel` renders plain-language prose per dimension from the real breakdown data (e.g. _"2 of 3 required sources present for this incident type — required: Monitoring, Log aggregator, Human. Present: Monitoring, Log aggregator. Missing: Human."_), never a re-statement of raw JSON.

## Consequences

- Every confidence number in the product is now one click away from its own audit trail, in the same place it's shown — closing the actual gap the user identified, not just the one ADR-0010 assumed was already closed by API-level auditability.
- `list()` does one batched `evidence.findMany` (all `evidenceUsed` ids across every returned analysis, deduplicated) instead of N+1 — cheap at this stage's scale, and avoids a query-per-analysis pattern that wouldn't scale to an incident with a long analysis history.
- No migration, no new persisted column — the breakdown is exactly as fresh as the data it's built from, and can never drift from a cached copy because there is no cached copy.
- `IntelligenceAnalysis` (the `@dip/shared` frontend type) now requires `confidenceBreakdown` — a real, if small, wire-contract change; every test fixture constructing a literal `IntelligenceAnalysis` needed updating (caught immediately by the TypeScript build, not silently).
- This is scoped to the Decision Intelligence Engine's confidence dimensions only. Calibration's aggregate report (ADR-0016) and Reporting's factual templates (ADR-0011) are unaffected — `ConfidenceMeter`'s `explanation` prop is optional specifically so the calibration page's existing usage (no per-analysis breakdown available there) keeps working unchanged.

## Alternatives considered

- **A separate `GET .../confidence-breakdown` endpoint, fetched on demand.** Rejected — an extra round trip for something that should be visible immediately, and the breakdown is cheap enough (pure computation over already-fetched or batch-fetched rows) that there's no real cost to always including it.
- **Persisting the breakdown as a JSON column alongside the score.** Rejected — the whole point is that it's mechanically derived from data that's already permanent (evidence rows, incident type) and already-frozen numbers (`createdAt`); persisting a second copy risks the exact kind of drift (stored breakdown vs. recomputed score disagreeing after a future algorithm change) this design specifically avoids.
- **A single flat "explanation" string per dimension instead of structured breakdown data.** Rejected — structured data lets the frontend render it as real UI (lists, formatted numbers) rather than pre-baked prose, and keeps the option open for a future non-English locale or a different presentation without touching the backend.
