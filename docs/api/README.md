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

| Method | Path                            | Notes                                                                                                  |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| POST   | `/incidents`                    | Create an incident (`title`, `description`, optional `severity`).                                      |
| GET    | `/incidents`                    | List the tenant's incidents, newest first.                                                             |
| GET    | `/incidents/:id`                | Full detail: incident + its decisions + evidence + actions.                                            |
| GET    | `/incidents/:id/command-center` | `{ incident, openDecision, lastDecision }` — the North-Star / no-blank-state shape, ADR-0009.          |
| GET    | `/incidents/:id/timeline`       | Ordered `TimelineEvent[]` audit trail. Read-only — events are written by the services, never directly. |
| PATCH  | `/incidents/:id/status`         | Guarded status transition (see above).                                                                 |

## Decisions (`apps/api/src/decisions`)

`POST /decisions/:id/decide` is the **Principle 1** endpoint (see ADR-0007, `PREREQUIS.md` §2): it throws `400 Bad Request` unless `humanDecision` is a non-empty string **and** `decidedByUserId` resolves to a real member of the caller's tenant. There is no code path that lets a `Decision` reach `DECIDED` without both.

| Method | Path                    | Notes                                                                                                                                      |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/decisions`            | Open a decision against an incident (`incidentId`, `question`).                                                                            |
| GET    | `/decisions/:id`        | Fetch a decision.                                                                                                                          |
| POST   | `/decisions/:id/decide` | `{ humanDecision, decidedByUserId, rationale? }` → `OPEN → DECIDED`. Rejects if not `OPEN`, or if `decidedByUserId` isn't a tenant member. |
| POST   | `/decisions/:id/cancel` | `OPEN → CANCELLED`. Rejects if not `OPEN` (a `DECIDED` decision is immutable).                                                             |

## Evidence (`apps/api/src/evidence`)

| Method | Path            | Notes                                                                                                            |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| POST   | `/evidence`     | `{ incidentId, decisionId?, type, source, summary, url? }`. `decisionId`, if given, must belong to `incidentId`. |
| GET    | `/evidence/:id` | Fetch one piece of evidence.                                                                                     |

## Actions (`apps/api/src/actions`)

Status transitions guarded: `PENDING → IN_PROGRESS → DONE`, or `→ CANCELLED` from either non-terminal state.

| Method | Path                  | Notes                                                                                                                   |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST   | `/actions`            | `{ incidentId, decisionId?, title, assignedToUserId?, dueAt? }`. `assignedToUserId`, if given, must be a tenant member. |
| PATCH  | `/actions/:id/status` | Guarded status transition.                                                                                              |

## Integrations (Phase 6 seam, not a public API surface yet)

`apps/api/src/integrations` defines the `IntegrationProvider` contract and a mock implementation per Phase 6 system (ServiceNow, Jira, Slack, Teams, AWS, Azure, GCP, Splunk, Datadog, Microsoft Sentinel — see ADR-0008). `IncidentsService`/`DecisionsService` broadcast to all registered providers on incident creation and decision decisions; the mocks log and report `isConfigured() === false`. No HTTP endpoints exist for this yet — it's an internal seam for Phase 6 to fill in.

## Health

| Method | Path      | Auth |
| ------ | --------- | ---- |
| GET    | `/health` | none |
