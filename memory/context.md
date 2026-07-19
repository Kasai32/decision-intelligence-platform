# Standing Context

Last updated: 2026-07-19.

## Current phase

**Phase 3 — Executive Command Center / Incident & Decision domain model is complete**, per [PREREQUIS.md](../PREREQUIS.md) (the detailed §2 spec — domain model, state transition guards, interface contract — was supplied by the user directly in chat and transcribed into `PREREQUIS.md`; it was not actually on disk when the user referred to it, same gap as the original roadmap capture). Phases 1 (Foundation) and 2 (Platform core) were completed and committed first (`e197079`, `5599746`). All three phases are verified end-to-end: lint/format/test/build all green (99 tests total: 71 in `apps/api`, 6 in `apps/web`, plus `packages/shared`), and the live guard behavior was exercised for real, not just unit-tested. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record.

**Next up per the roadmap: Phase 4 — Decision Intelligence Engine (Evidence Collection, Recommendation Engine, Confidence Model, Business Impact Analysis).** Not started. Flagged in the constraints below: the confidence-scoring methodology is a product/algorithmic decision, not a technical one, and should not be guessed wholesale.

## Operating mode

This repository is being built by an AI agent (Claude Code) operating autonomously end-to-end, per explicit user instruction: no per-decision human approval, errors handled inline, every technical decision logged to `DECISION_LOG.md` as it was made. If you are a human picking this up: read `DECISION_LOG.md` top to bottom before assuming any stack/structure/business-logic choice was discussed with you — most weren't, by design.

## Known constraints at time of writing

- No git remote configured — repository is local-only until one is added; "push" was requested for Phase 3 but there is nowhere to push to yet.
- No cloud provider, hosting target, or deployment environment specified anywhere in the source roadmap.
- No specific compliance/regulatory requirement (SOC2, HIPAA, etc.) was specified, despite the enterprise-integration surface (Sentinel, Splunk, etc.) suggesting one may eventually apply. Revisit before Phase 6.
- **Phase 6 (Enterprise Integrations) cannot be built for real without credentials/OAuth app registrations for each of the ten systems — none exist in this environment. The abstraction (ADR-0008) is built; the real implementations are not.**
- **Phase 4 (Decision Intelligence Engine — Recommendation Engine, Confidence Model, Business Impact Analysis) requires actual business/algorithmic decisions that are product decisions, not technical ones.**

## Decisions made in Phase 3 (see DECISION_LOG.md / docs/adr for full rationale)

- Domain model: `Incident`, `Decision`, `Evidence`, `TimelineEvent`, `Action` — all `tenantId`-scoped and indexed (ADR-0006). The spec's `organization_id` is this codebase's existing `tenantId`/`Tenant`; no parallel `Organization` model was introduced.
- State transition guards: a generic, reusable `assertValidTransition` engine (`apps/api/src/common/state-machine`) plus per-entity transition maps (ADR-0007). **Every transition, including same-state, must be explicitly listed — there is no implicit no-op** (a bug where this wasn't true let an already-`DECIDED` `Decision` be silently re-decided; fixed and tested, see DECISION_LOG.md).
- **Principle 1 (the AI decides nothing alone):** `Decision.status` can only become `DECIDED` via `DecisionsService.decide()`, which requires a non-empty `humanDecision` AND a `decidedByUserId` verified to be a real member of the tenant. No other code path can set this status.
- Phase 6 integrations: one shared `IntegrationProvider` TS interface + a `MockIntegrationProvider` per system (ServiceNow/Jira/Slack/Teams/AWS/Azure/GCP/Splunk/Datadog/Microsoft Sentinel), registered in `IntegrationsRegistryService`, already wired into incident-created/decision-decided events (ADR-0008). `isConfigured()` always reports `false` on the mocks — an honest "not wired up" signal.
- Executive Command Center: `GET /incidents/:id/command-center` returns `{ incident, openDecision, lastDecision }`; the frontend (`apps/web`, `IncidentDecisionPanel` component) renders one of three states and never nothing (ADR-0009) — open decision, last decision's outcome, or an explicit "no decisions yet" message.
- Frontend auth: minimal client-side JWT-in-localStorage flow (`apps/web/src/lib/auth-storage.ts`, `/login` page) — no refresh-token rotation wired into the frontend yet (the backend supports it), no "remember me"/session persistence design beyond localStorage. Sufficient for Phase 3's UI contract; revisit before real users.

## Open questions for later phases

- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
- Email delivery provider (needed for real invite/password-reset flows).
- Multi-tenant login/tenant-selection flow (a user with >1 tenant membership still cannot log in — Phase 2 limitation, unchanged in Phase 3).
- Phase 4 confidence-scoring methodology — needs product input.
- Phase 6 — needs real credentials per integration, see constraint above.
- Frontend refresh-token handling (access token expiry currently just breaks API calls with no silent refresh) — fine for Phase 3's scope, worth hardening before real usage.
