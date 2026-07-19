# 0008. Phase 6 integration abstraction (mock providers)

Date: 2026-07-19

## Status

Accepted

## Context

Phase 6 (ServiceNow, Jira, Slack, Teams, AWS, Azure, GCP, Splunk, Datadog, Microsoft Sentinel) cannot be built for real in this environment — no credentials/OAuth apps exist for any of the ten systems (see `memory/context.md`). The user's Phase 3 instructions explicitly ask for these to be mocked behind abstract TypeScript interfaces now, so that Incident/Decision code written in Phase 3 already has the right integration seam and doesn't need to be reshaped when Phase 6 adds real implementations.

## Decision

- `apps/api/src/integrations/integration-provider.interface.ts` defines `IntegrationProvider` (an abstract contract: `key`, `displayName`, `isConfigured()`, `notifyIncidentCreated(payload)`, `notifyDecisionDecided(payload)`) and an `IntegrationKey` enum with all ten Phase 6 systems.
- `apps/api/src/integrations/mock-integration.provider.ts` implements `IntegrationProvider` as a no-op that logs via NestJS `Logger` and always reports `isConfigured() === false` — an honest signal that nothing is really wired up, not a silent fake success.
- `apps/api/src/integrations/integrations.module.ts` registers one `MockIntegrationProvider` per `IntegrationKey` behind an `IntegrationsRegistryService`, whose `broadcast(event, payload)` calls every registered provider's matching method, catching and logging per-provider errors individually — consistent with the "integration isolation" cross-cutting concern already recorded in `docs/architecture/ARCHITECTURE.md` (one integration's failure must not affect others, or the request that triggered the broadcast).
- `IncidentsService` and `DecisionsService` call `IntegrationsRegistryService.broadcast(...)` at the two moments named in the spec's intent (incident created, decision decided) so the seam is actually exercised end-to-end in Phase 3, not merely defined and unused.

## Consequences

- Swapping a mock for a real provider in Phase 6 (e.g. a real `SlackIntegrationProvider`) is a matter of implementing `IntegrationProvider` and registering it in place of the mock for that key — `IncidentsService`/`DecisionsService` do not change.
- Because `broadcast()` never throws (provider errors are caught and logged per-provider), a misbehaving or misconfigured integration in Phase 6 can never block or fail an incident/decision operation — a deliberate reliability property carried forward from the mock stage.
- The mocks add no real capability (no message is actually sent anywhere); this is intentional and documented, not a gap to silently paper over — `isConfigured()` reports `false` specifically so a future caller (e.g. an admin UI) can distinguish "not wired up" from "wired up but currently failing."

## Alternatives considered

- Skip the abstraction entirely and stub Phase 6 with a single TODO comment — rejected: the user's instructions explicitly ask for the interface seam now, and defining it early is cheap while incident/decision service code is being written for the first time; retrofitting it after Phase 3 code exists would touch the same call sites twice.
- Build one real integration now (e.g. Slack, via a user-supplied webhook) to prove the pattern — not done: no credentials exist in this environment (see `memory/context.md`), and the user's instructions frame this phase as mocks specifically "pour ne pas bloquer le pipeline."
