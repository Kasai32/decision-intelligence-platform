# API Reference

The authoritative reference is the generated OpenAPI/Swagger UI, served by `apps/api` itself at `/api/v1/docs` (see `apps/api/src/main.ts`) — generated from `@nestjs/swagger` decorators on the DTOs/controllers, so it cannot drift from the actual code. Run the API (`npm run dev:api`, or `docker compose up`) and open `http://localhost:3001/api/v1/docs`.

All routes below are prefixed with `/api/v1`, except `GET /health` which is intentionally unversioned/unprefixed (for load balancer health checks).

## Auth (`apps/api/src/auth`)

| Method | Path             | Auth                         | Notes                                                                                                                                                  |
| ------ | ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/auth/register` | none                         | Creates a new Tenant + User (as `OWNER`) in one transaction. Returns `{ accessToken, refreshToken }`.                                                  |
| POST   | `/auth/login`    | none                         | Fails with 401 if the account belongs to zero or more than one tenant (see ADR-0005 / DECISION_LOG.md — multi-tenant login selection isn't built yet). |
| POST   | `/auth/refresh`  | none (refresh token in body) | Rotates the refresh token — the old one is revoked and cannot be reused.                                                                               |
| POST   | `/auth/logout`   | none (refresh token in body) | Revokes the given refresh token.                                                                                                                       |

Access tokens are short-lived JWTs (`JWT_ACCESS_TTL_SECONDS`, default 900s) sent as `Authorization: Bearer <token>`. Refresh tokens are opaque, server-tracked, and revocable (`RefreshToken` table).

## Tenants (`apps/api/src/tenants`)

All routes require a valid access token (`JwtAuthGuard`) and operate on the caller's own tenant (`request.user.tenantId` from the JWT) — there is no "manage an arbitrary tenant by ID" surface, by design (see ADR-0004).

| Method | Path                          | Min. role | Notes                                                                                                                  |
| ------ | ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | `/tenants/me`                 | MEMBER    | Current tenant's details.                                                                                              |
| PATCH  | `/tenants/me`                 | ADMIN     | Update tenant name.                                                                                                    |
| GET    | `/tenants/me/members`         | MEMBER    | List members with their roles.                                                                                         |
| POST   | `/tenants/me/members`         | ADMIN     | Add an _already-registered_ user (by email) to the tenant with a role. No email invites yet — see `memory/context.md`. |
| DELETE | `/tenants/me/members/:userId` | ADMIN     | Remove a member. Cannot remove the `OWNER`.                                                                            |

Role hierarchy (`apps/api/src/auth/guards/roles.guard.ts`): `OWNER > ADMIN > MEMBER`, higher rank subsumes lower on `@Roles(...)`-gated routes.

## Incidents (`apps/api/src/incidents`)

All routes require a valid access token and are scoped to the caller's tenant. Status transitions are guarded (see ADR-0007) — `PATCH .../status` rejects any jump not in `OPEN → MITIGATED → RESOLVED → CLOSED` with `400 Bad Request`.

| Method | Path                            | Notes                                                                                                                                          |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/incidents`                    | Create an incident (`title`, `description`, optional `severity`, optional `type` — drives Phase 4's `evidenceCompleteness` scoring, ADR-0010). |
| GET    | `/incidents`                    | List the tenant's incidents, newest first.                                                                                                     |
| GET    | `/incidents/:id`                | Full detail: incident + its decisions + evidence + actions.                                                                                    |
| GET    | `/incidents/:id/command-center` | `{ incident, openDecisions, lastDecision }` — the North-Star / no-blank-state shape, ADR-0009 (amended by ADR-0013 to support multiple simultaneously open decisions). |
| GET    | `/incidents/:id/timeline`       | Ordered `TimelineEvent[]` audit trail. Read-only — events are written by the services, never directly.                                         |
| PATCH  | `/incidents/:id/status`         | Guarded status transition (see above).                                                                                                         |

## Decisions (`apps/api/src/decisions`)

`POST /decisions/:id/decide` is the **Principle 1** endpoint (see ADR-0007, `PREREQUIS.md` §2): it throws `400 Bad Request` unless `humanDecision` is a non-empty string **and** `decidedByUserId` resolves to a real member of the caller's tenant. There is no code path that lets a `Decision` reach `DECIDED` without both.

| Method | Path                    | Notes                                                                                                                                      |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/decisions`            | Open a decision against an incident (`incidentId`, `question`).                                                                            |
| GET    | `/decisions/:id`        | Fetch a decision.                                                                                                                          |
| POST   | `/decisions/:id/decide` | `{ humanDecision, decidedByUserId, rationale? }` → `OPEN → DECIDED`. Rejects if not `OPEN`, or if `decidedByUserId` isn't a tenant member. |
| POST   | `/decisions/:id/cancel` | `OPEN → CANCELLED`. Rejects if not `OPEN` (a `DECIDED` decision is immutable).                                                             |

## Evidence (`apps/api/src/evidence`)

| Method | Path            | Notes                                                                                                                                                                                                       |
| ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/evidence`     | `{ incidentId, decisionId?, type, sourceCategory?, source, summary, url? }`. `decisionId`, if given, must belong to `incidentId`. `sourceCategory` (default `OTHER`) drives Phase 4 scoring — see ADR-0010. |
| GET    | `/evidence/:id` | Fetch one piece of evidence.                                                                                                                                                                                |

## Actions (`apps/api/src/actions`)

Status transitions guarded: `PENDING → IN_PROGRESS → DONE`, or `→ CANCELLED` from either non-terminal state.

| Method | Path                  | Notes                                                                                                                   |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST   | `/actions`            | `{ incidentId, decisionId?, title, assignedToUserId?, dueAt? }`. `assignedToUserId`, if given, must be a tenant member. |
| PATCH  | `/actions/:id/status` | Guarded status transition.                                                                                              |

## Decision Intelligence Engine (`apps/api/src/decision-intelligence`)

Implements the multidimensional confidence model from ADR-0010 / `PREREQUIS.md` §2. **`confidenceDimensions`, `evidenceUsed`, and the evidence-completeness portion of `missingInformation` are always computed server-side from the incident's real `Evidence` rows — a caller can never supply or override them.** The four dimensions (`evidenceCompleteness`, `sourceReliability`, `dataFreshness`, `aiCertainty`) are never merged into a single score.

| Method | Path                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/incidents/:incidentId/analyze`  | Body: the qualitative fields only (`situationSummary`, `businessImpact`, `criticalRisks`, `conflictingInformation`, `recommendedDecision`, `alternativeDecisions`, `expectedConsequences`, `immediateNextActions`, `executiveSummary` — all required, arrays required even if empty per "Principle 3: never hidden"). Computes the four dimensions from the incident's evidence, assembles the full `AIOutputContract`, validates it server-side (`400` if the assembled object is structurally invalid), persists it, and returns it. |
| GET    | `/incidents/:incidentId/analyses` | List past analyses for the incident, newest first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`evidenceCompleteness` requires specific `EvidenceSourceCategory` values per `Incident.type` (e.g. `CLOUD_OUTAGE` requires `[MONITORING, CLOUD_PROVIDER]`); `sourceReliability` averages a static per-category reliability table (e.g. `CLOUD_PROVIDER: 95`, `CHAT: 40`); `dataFreshness` decays from the most recent evidence's age, faster for higher-severity incidents; `aiCertainty` is an explicitly-documented deterministic heuristic (evidence volume + source diversity − conflict count), not a trained-model output — see ADR-0010 for the exact formulas and lookup tables.

## Reporting (Phase 5 — see ADR-0011)

Executive Briefs and Decision Reports are **immutable, persisted snapshots** generated on `POST`, not recomputed on every `GET` — each generation creates a new row, preserving history. Every field except `additionalNotes` is a factual value computed from real rows at generation time; no narrative is fabricated (no LLM integration exists in this environment).

### Executive Briefs (`apps/api/src/executive-briefs`)

| Method | Path                                      | Notes                                                                                                                                                                                                                                                                          |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/incidents/:incidentId/executive-brief`  | Body: `{ additionalNotes? }`. Assembles `title`, `incidentStatus`/`incidentSeverity` (snapshot), a factual `summary` (e.g. "N of M decisions made"), `businessImpact`/`openRisks` from the latest `IntelligenceAnalysis` if one exists, and `nextActions` from open `Action`s. |
| GET    | `/incidents/:incidentId/executive-briefs` | List generated briefs for the incident, newest first.                                                                                                                                                                                                                          |

### Decision Reports (`apps/api/src/decision-reports`)

| Method | Path                             | Notes                                                                                                                                                              |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/decisions/:decisionId/report`  | Body: `{ additionalNotes? }`. Snapshots the decision's outcome plus `evidenceSummary`/`timelineSummary` scoped strictly to that decision (not the whole incident). |
| GET    | `/decisions/:decisionId/reports` | List generated reports for the decision, newest first.                                                                                                             |

### Lessons Learned + Knowledge Base (`apps/api/src/lessons-learned`)

Entirely human-authored — no algorithm generates retrospective insight. Creating a lesson requires `Incident.status = CLOSED` (`400 Bad Request` otherwise).

| Method | Path                                     | Notes                                                                                                                                                                     |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/incidents/:incidentId/lessons-learned` | `{ title, whatHappened, whatWentWell?, whatToImprove?, actionItems?, tags? }`. Rejects unless the incident is `CLOSED`.                                                   |
| GET    | `/incidents/:incidentId/lessons-learned` | List lessons recorded for the incident.                                                                                                                                   |
| GET    | `/knowledge-base/search?query=&tags=a,b` | Tenant-scoped search across all `LessonLearned` rows: `query` matches `title`/`whatHappened` case-insensitively; `tags` is a comma-separated list matched with `hasSome`. |

## Integrations (Phase 6 — see ADR-0008, ADR-0012)

Every one of the ten systems (ServiceNow, Jira, Slack, Teams, AWS, Azure, GCP, Splunk, Datadog, Microsoft Sentinel) is a `ResilientIntegrationProvider`: circuit-breaker + retry wrapped, per-tenant configurable, falling back to an explicit `STUB_MODE` when unconfigured. No real OAuth credentials exist in this environment (see `memory/context.md`) — configuration uses encrypted fixtures.

### Configuration management (`apps/api/src/integrations`)

| Method | Path                                        | Min. role | Notes                                                                                                                                                                     |
| ------ | ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/integrations`                             | MEMBER    | Status of all ten providers for the tenant: `{ providerType, displayName, configured, status, circuitState, updatedAt }`. `status` is `ACTIVE`/`BROKEN`/`NOT_CONFIGURED`. |
| POST   | `/integrations/:providerType/config`        | ADMIN     | `{ credentials: {...} }` — AES-256-GCM encrypted and stored (`IntegrationConfig`, upsert). Credentials are never returned by any endpoint.                                |
| PATCH  | `/integrations/:providerType/config/status` | ADMIN     | `{ status: "ACTIVE" \| "BROKEN" }`. `404` if no config exists yet.                                                                                                        |
| DELETE | `/integrations/:providerType/config`        | ADMIN     | Removes the config — the provider reverts to `STUB_MODE`.                                                                                                                 |

Any of the ten `providerType` values (`SERVICENOW`, `JIRA`, `SLACK`, `TEAMS`, `AWS`, `AZURE`, `GCP`, `SPLUNK`, `DATADOG`, `MICROSOFT_SENTINEL`) is valid in the path; an unknown value is rejected with `400`.

### Resilience behavior

`IncidentsService`/`DecisionsService` broadcast to all ten providers on incident-created/decision-decided. Per provider, per tenant:

- **No config, or `status: BROKEN`, or a decrypt failure** → `STUB_MODE`: `{ delivered: true, mode: "STUB_MODE", freshness: 0, reliability: "MOCK" }`, no network call attempted.
- **Configured + healthy** → up to 3 attempts with exponential backoff per call; success → `{ mode: "LIVE", freshness: 100, reliability: "LIVE" }`.
- **3 consecutive failed calls** (each having already retried) → the circuit breaker opens. Further calls fail fast (`{ mode: "DEGRADED", delivered: false }`, returning the last successful result if one exists, otherwise a clean zero-state response) without attempting the network — and exactly one `TimelineEvent` of type `INTEGRATION_BLOCKED` is written on the transition to `OPEN` (not on every subsequent blocked call).
- **After `resetTimeoutMs` (30s)** the circuit allows one `HALF_OPEN` probe call — success closes it, failure reopens it and restarts the cooldown.

### Webhooks (`apps/api/src/integrations/webhooks.controller.ts`)

| Method | Path                                | Auth                                    | Notes                                                                                               |
| ------ | ----------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/webhooks/:tenantId/:providerType` | HMAC signature (`X-Signature`), not JWT | Generic inbound alert receiver (Splunk/Jira/Sentinel-style). Body: `{ incidentId, summary, url? }`. |

**Not prefixed with `/api/v1`** (external systems call it directly, like `/health`). Not behind `JwtAuthGuard` — the caller is an external system with no user session. Security boundary: `X-Signature` must be `HMAC-SHA256(rawRequestBody, webhookSecret)` in hex, where `webhookSecret` is a key inside that tenant/provider's encrypted `IntegrationConfig` credentials — compared with `crypto.timingSafeEqual`. Any mismatch, missing header, missing/broken config, or missing `webhookSecret` → `401`, and the payload is never parsed or persisted. On success, creates an `Evidence` row (system-originated, `submittedByUserId: null`) linked to the given `incidentId`, with `sourceCategory` mapped from the provider (e.g. `SPLUNK → LOG_AGGREGATOR`, `JIRA → TICKETING`).

## Simulation (`apps/api/src/simulation` — user validation test scenarios, ADR-0013)

Builds disposable, tenant-scoped test incidents on demand for facilitator-driven validation sessions, entirely by composing existing services (`IncidentsService`, `DecisionsService`, `EvidenceService`, `IntegrationConfigService`, `IntegrationsRegistryService`, `DecisionIntelligenceEngineService`) — no new persistence path, no bypass of any existing guard. Every triggered incident's title is prefixed `[SIMULATION]`.

| Method | Path                  | Min. role | Notes                                                                                                                                                                                                                                                                                       |
| ------ | --------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/simulation/trigger` | ADMIN     | `{ scenario: "CYBER_RANSOMWARE" \| "CLOUD_OUTAGE_PARTIAL_EVIDENCE" }` → `{ scenario, incident }`. **`CYBER_RANSOMWARE`**: `SECURITY_BREACH`/`CRITICAL` incident, one `MONITORING` evidence row, two simultaneously `OPEN` decisions left undecided (exercises the multi-decision Command Center panel). **`CLOUD_OUTAGE_PARTIAL_EVIDENCE`**: `CLOUD_OUTAGE`/`HIGH` incident with only `CLOUD_PROVIDER` evidence attached, configures the tenant's `DATADOG` integration with fixture `simulateFailure: true` credentials and drives three real broadcasts to trip its circuit breaker `OPEN` (ADR-0012), then seeds one real `IntelligenceAnalysis` via `DecisionIntelligenceEngineService.analyze()` — so `evidenceCompleteness` genuinely reads 50% and the "not enough evidence" state is the engine's own computation, not a scripted message. |

Both scenarios are strictly scoped to the caller's own `tenantId` (ADR-0004) — never a client-supplied tenant.

## Health

| Method | Path      | Auth |
| ------ | --------- | ---- |
| GET    | `/health` | none |
