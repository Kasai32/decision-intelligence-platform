# Standing Context

Last updated: 2026-07-19.

## Current phase

**Phase 4 — Decision Intelligence Engine (multidimensional confidence model) is complete**, per [PREREQUIS.md](../PREREQUIS.md). The user supplied the exact scoring algorithms and the `AIOutputContract` shape directly in chat (see [ADR-0010](../docs/adr/0010-decision-intelligence-confidence-model.md)). Phases 1–3 (`e197079`, `5599746`, `a826545`) were completed first. All four phases are verified end-to-end: lint/format/test/build all green, 96 tests in `apps/api` alone. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record.

**Next up per the roadmap: Phase 5 — Reporting (Executive Brief Generator, Decision Reports, Lessons Learned, Knowledge Base).** Not started.

## Operating mode

This repository is being built by an AI agent (Claude Code) operating autonomously end-to-end, per explicit user instruction: no per-decision human approval, errors handled inline, every technical decision logged to `DECISION_LOG.md` as it was made. If you are a human picking this up: read `DECISION_LOG.md` top to bottom before assuming any stack/structure/business-logic choice was discussed with you — most weren't, by design.

## Known constraints at time of writing

- No git remote configured — repository is local-only until one is added.
- No cloud provider, hosting target, or deployment environment specified anywhere in the source roadmap.
- No specific compliance/regulatory requirement (SOC2, HIPAA, etc.) was specified, despite the enterprise-integration surface (Sentinel, Splunk, etc.) suggesting one may eventually apply. Revisit before Phase 6.
- **Phase 6 (Enterprise Integrations) cannot be built for real without credentials/OAuth app registrations for each of the ten systems — none exist in this environment. The abstraction (ADR-0008) is built; the real implementations are not.**
- **No LLM integration exists in this environment.** The Decision Intelligence Engine (Phase 4) computes its four confidence dimensions for real from `Evidence` data, but the qualitative narrative fields of the AI Output Contract (`situationSummary`, `criticalRisks`, `recommendedDecision`, etc.) are supplied by whoever calls `POST /incidents/:id/analyze` — today, a human analyst. Wiring a real LLM to auto-populate those fields would need an API key/credential that doesn't exist here; the contract (`AIOutputContractDto`) is already the right shape to validate whatever a real LLM integration produces later.

## Decisions made in Phase 4 (see DECISION_LOG.md / ADR-0010 for full rationale)

- Four independent confidence dimensions, never merged into one score: `evidenceCompleteness`, `sourceReliability`, `dataFreshness`, `aiCertainty` — each a pure, unit-tested function in `apps/api/src/decision-intelligence/scoring/`.
- Two new schema fields to make the algorithms computable: `Incident.type` (`IncidentType` enum) and `Evidence.sourceCategory` (`EvidenceSourceCategory` enum) — both default to a neutral value (`OTHER`) so unclassified data isn't penalized.
- `aiCertainty` is an explicit, documented **heuristic** (evidence volume + source diversity − conflict count), not a trained-model output — this system has no model or historical corpus. Stated in code and in ADR-0010, not hidden.
- **`confidenceDimensions`, `evidenceUsed`, and the evidence-gap portion of `missingInformation` can never be supplied by a client** — `DecisionIntelligenceEngineService.analyze()` always computes them from real `Evidence` rows, even if a caller bypasses the controller's `ValidationPipe` (a second, internal `class-validator` pass on the fully-assembled contract catches this — proven by a dedicated test).
- `IntelligenceAnalysis` is persisted with the four dimensions as separate integer columns (not merged even at the DB layer), plus the qualitative fields (mostly `Json` columns for the variably-shaped nested objects), linked to `Incident` + `TimelineEvent`.
- The ADR is numbered **0010**, not "0007" as the user's message suggested (0007 already belongs to Phase 3's state-transition-guards ADR) — noted transparently rather than silently renumbered or overwritten.
- Fixed two pre-existing gaps found while wiring this up: `CreateIncidentDto` didn't expose `type` and `CreateEvidenceDto` didn't expose `sourceCategory` — without these, every incident/evidence would default to `OTHER` and `evidenceCompleteness` would always read 100%, silently defeating the scoring model. Both fixed before commit.

## Open questions for later phases

- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
- Email delivery provider (needed for real invite/password-reset flows).
- Multi-tenant login/tenant-selection flow (a user with >1 tenant membership still cannot log in — Phase 2 limitation, unchanged since).
- Real LLM integration for the AI Output Contract's qualitative fields — needs an API key/credential and a product decision on which provider.
- Phase 5 (Reporting) — likely consumes `IntelligenceAnalysis` + `Decision` data; not yet scoped.
- Phase 6 — needs real credentials per integration, see constraint above.
- Frontend refresh-token handling (access token expiry currently just breaks API calls with no silent refresh) — worth hardening before real usage.
- The Decision Intelligence Engine's endpoints (`/incidents/:id/analyze`, `/incidents/:id/analyses`) have no `apps/web` UI yet — only the backend and its tests exist.
