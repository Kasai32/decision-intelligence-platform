# 0013. User validation test scenarios: SimulationScenarioService

Date: 2026-07-19

## Status

Accepted

## Context

The user requested preparation for user-validation testing: an ADMIN-only endpoint that instantiates two realistic incident scenarios on demand, for a facilitator to trigger during a live test session — (A) a ransomware attack with two simultaneous urgent decisions, to exercise the multi-decision panel; (B) a cloud outage with deliberately incomplete evidence (Datadog unreachable due to its own circuit breaker being open), to exercise the "not enough evidence" messaging. The referenced `incident-commander-validation-guide.md` does not exist in this repository (checked — not on disk); as with earlier gaps of this kind, the user's message itself contained enough of a spec to proceed, so no work was blocked on it, and this discrepancy is noted here rather than silently ignored.

Building Scenario A exposed a real, pre-existing gap: `GET /incidents/:id/command-center` (ADR-0009) returns a single `openDecision: Decision | null` — the most recently opened one. With two simultaneous open decisions (exactly what Scenario A needs to test), the second decision would be silently invisible through the Command Center, which is the platform's primary "what needs attention" view. A test scenario built to exercise multi-decision behavior would test nothing if the interface it's meant to exercise can't display more than one open decision.

## Decision

### Amendment to ADR-0009: `openDecision` → `openDecisions[]`

`IncidentsService.getCommandCenterSummary()` now returns `openDecisions: Decision[]` (every `OPEN` decision for the incident, oldest first) instead of a single `openDecision`. `lastDecision` (the most recently `DECIDED` one) is unchanged. The "never blank" contract from ADR-0009 still holds, generalized: zero open decisions + a `lastDecision` → show its outcome; zero open decisions + no `lastDecision` → explicit empty state; one or more open decisions → show all of them. `IncidentDecisionPanel` (`apps/web`) renders a list when `openDecisions.length > 0`, not just the first one. This is a genuine interface amendment, not a new ADR, because the underlying principle (ADR-0009) is unchanged — only the cardinality of what it surfaces.

### `SimulationScenarioService` (`apps/api/src/simulation`)

A single service, two scenario builders, both composed entirely from **existing** services (`IncidentsService`, `DecisionsService`, `EvidenceService`, `ActionsService`, `IntegrationConfigService`, `IntegrationsRegistryService`) — no new persistence path, no bypass of any existing guard (state-transition guards, Principle 1, tenant scoping all still apply exactly as they do for a real incident, because these _are_ real `Incident`/`Decision`/`Evidence` rows, just synthetic content):

- **Scenario A — `CYBER_RANSOMWARE`**: creates a `SECURITY_BREACH`/`CRITICAL` incident, one piece of `MONITORING` evidence (EDR detection), and **two simultaneously `OPEN` decisions** ("Isolate the affected network segment?" / "Issue a public breach communication?") — deliberately left undecided, to put the multi-decision panel in the state it's meant to test.
- **Scenario B — `CLOUD_OUTAGE_PARTIAL_EVIDENCE`**: creates a `CLOUD_OUTAGE`/`HIGH` incident with only `CLOUD_PROVIDER` evidence attached (AWS Health Dashboard) — no `MONITORING` evidence, matching `evidenceCompleteness`'s `CLOUD_OUTAGE` requirement of `[MONITORING, CLOUD_PROVIDER]` (ADR-0010), so the Decision Intelligence Engine will genuinely report `evidenceCompleteness: 50` and `missingInformation: ["Missing evidence source: MONITORING"]` — not a hand-typed fake message. To make the _reason_ concrete rather than abstract, the scenario also configures the tenant's `DATADOG` integration with fixture credentials carrying `simulateFailure: true` (ADR-0012's `FixtureNetworkSimulator` hook) and drives three consecutive broadcasts to actually trip that provider's circuit breaker to `OPEN` before returning — so `GET /integrations` genuinely shows Datadog as down, telling a coherent, verifiable story: evidence is incomplete _because_ the monitoring integration is circuit-broken, exactly as specified. The service then seeds one `IntelligenceAnalysis` via the real `DecisionIntelligenceEngineService.analyze()` call so a test participant sees the "not enough evidence" state immediately on load, without a manual step — its qualitative fields are prefixed `[SIMULATION]` so their synthetic origin is never ambiguous (same anti-fabrication discipline as ADR-0010/0011: this is clearly-labeled test-fixture content, not the system pretending to be a human analyst).
- Both scenarios are strictly scoped to the calling admin's own `tenantId` — never a client-supplied tenant, same pattern as every other service in this codebase (ADR-0004). Every triggered incident's title is prefixed `[SIMULATION]` so synthetic test data is never mistaken for a real incident in the same tenant.
- `POST /api/v1/simulation/trigger` (`{ scenario: "CYBER_RANSOMWARE" | "CLOUD_OUTAGE_PARTIAL_EVIDENCE" }`) is gated `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.ADMIN)` — creating synthetic crisis data is an administrative action, not something an ordinary tenant member should be able to trigger.
- `apps/web` gets a minimal `/simulation` page: two buttons, one per scenario, POSTing to the endpoint and redirecting to the Command Center on success. No role-based UI hiding (the backend enforces `ADMIN` regardless); a non-admin who navigates there simply sees the resulting `403`.

## Consequences

- Because both scenarios are built entirely from real service calls, any bug they surface is a bug in the actual product code paths a real incident would exercise — not a simulation-specific code path that could itself be wrong in a way that hides real bugs.
- Test data is trivially identifiable (`[SIMULATION]` prefix) and fully tenant-isolated, so it can be triggered repeatedly against a disposable test tenant without contaminating anything else.
- Scenario B's circuit-breaker trip is real, in-process state (ADR-0012) — triggering it repeatedly in quick succession is idempotent in effect (the breaker is already `OPEN`) but not a no-op call (it still runs three broadcasts); acceptable for a low-frequency, admin-only test-prep action.

## Alternatives considered

- Hand-write a fake `missingInformation` message for Scenario B instead of actually starving `evidenceCompleteness` of `MONITORING` evidence — rejected: would test a scripted message, not the real Decision Intelligence Engine's actual computation, defeating the point of a validation test.
- Recompute-on-read Command Center already existed (ADR-0009) as a single `openDecision`; considered leaving it as-is and only exposing the second open decision through a different endpoint — rejected: the Command Center is specifically the surface being validated, so the fix belongs there, not in a workaround.
