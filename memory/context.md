# Standing Context

Last updated: 2026-07-19.

## Current phase

**Phase 5 — Reporting (Executive Briefs, Decision Reports, Lessons Learned, Knowledge Base) is complete**, per [PREREQUIS.md](../PREREQUIS.md). Unlike Phase 3/4, the user gave no technical spec this time — only the four roadmap bullet items — so the design (immutable snapshots, factual-only content, human-authored Lessons Learned, ILIKE-based Knowledge Base search) is this agent's own judgment, recorded in [ADR-0011](../docs/adr/0011-phase5-reporting-architecture.md). Phases 1–4 (`e197079`, `5599746`, `a826545`, `cccc655`) were completed first. All five phases are verified end-to-end: 112 tests in `apps/api` alone. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record.

**Next up per the roadmap: Phase 6 — Enterprise Integrations (ServiceNow, Jira, Slack, Teams, AWS, Azure, GCP, Splunk, Datadog, Microsoft Sentinel).** The abstraction layer (`IntegrationProvider`, `MockIntegrationProvider`, ADR-0008) is already built; real implementations need actual credentials/OAuth app registrations for each of the ten systems, none of which exist in this environment — this phase cannot be completed for real without the user providing them.

## Operating mode

This repository is being built by an AI agent (Claude Code) operating autonomously end-to-end, per explicit user instruction: no per-decision human approval, errors handled inline, every technical decision logged to `DECISION_LOG.md` as it was made. If you are a human picking this up: read `DECISION_LOG.md` top to bottom before assuming any stack/structure/business-logic choice was discussed with you — most weren't, by design.

## Known constraints at time of writing

- No git remote configured — repository is local-only until one is added.
- No cloud provider, hosting target, or deployment environment specified anywhere in the source roadmap.
- No specific compliance/regulatory requirement (SOC2, HIPAA, etc.) was specified, despite the enterprise-integration surface (Sentinel, Splunk, etc.) suggesting one may eventually apply. Revisit before Phase 6 goes further than mocks.
- **Phase 6 (Enterprise Integrations) cannot be built for real without credentials/OAuth app registrations for each of the ten systems — none exist in this environment. The abstraction (ADR-0008) is built; the real implementations are not. This is the next roadmap item and is expected to stall on this exact constraint.**
- **No LLM integration exists in this environment.** Neither the Decision Intelligence Engine (Phase 4) nor Reporting (Phase 5) generate narrative/judgment content via any algorithm. Qualitative content is always either human-supplied (`POST /incidents/:id/analyze`'s judgment fields, `additionalNotes` on briefs/reports, all of a `LessonLearned`) or a factual template over real data (brief `summary`) — never fabricated.

## Decisions made in Phase 5 (see DECISION_LOG.md / ADR-0011 for full rationale)

- `ExecutiveBrief` and `DecisionReport`: immutable, persisted, point-in-time snapshots (generated on `POST`, new row each time) — same pattern as `IntelligenceAnalysis` (Phase 4), not recomputed views like the Phase 3 Command Center summary.
- Brief `summary` is a small deterministic factual template ("N of M decisions made", etc.) over real counts — not generated prose. `businessImpact`/`openRisks` are pulled from the latest `IntelligenceAnalysis` when one exists.
- `DecisionReport`'s `evidenceSummary`/`timelineSummary` are scoped strictly to the decision (`decisionId` match), not the whole incident.
- `LessonLearned` is entirely human-authored (`title`, `whatHappened`, `whatWentWell[]`, `whatToImprove[]`, `actionItems[]`, `tags[]`) and can only be created when `Incident.status = CLOSED` — a retrospective before closure isn't a retrospective.
- Knowledge Base = `GET /knowledge-base/search?query=&tags=` over `LessonLearned` only, using Postgres `ILIKE` (`contains`, `mode: insensitive`) + array `hasSome` for tags — not a new content type, not a search engine. Documented as a known scaling limit if Lessons Learned volume grows large.
- Three new Prisma models (`ExecutiveBrief`, `DecisionReport`, `LessonLearned`), all `tenantId`-scoped and indexed, following the ADR-0006 pattern exactly.

## Open questions for later phases

- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
- Email delivery provider (needed for real invite/password-reset flows).
- Multi-tenant login/tenant-selection flow (a user with >1 tenant membership still cannot log in — Phase 2 limitation, unchanged since).
- Real LLM integration for AI Output Contract / brief narrative content — needs an API key/credential and a product decision on which provider.
- Phase 6 — needs real credentials per integration, see constraint above.
- Frontend refresh-token handling (access token expiry currently just breaks API calls with no silent refresh) — worth hardening before real usage.
- No `apps/web` UI exists yet for Decision Intelligence Engine (Phase 4) or Reporting (Phase 5) — only backend + tests. The Executive Command Center UI (Phase 3) is the only frontend surface built so far.
- Knowledge Base search is keyword/ILIKE-based; revisit with semantic/embedding search if Lessons Learned volume grows large enough for keyword search to miss relevant results (see ADR-0011).
