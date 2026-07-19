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

## Health

| Method | Path      | Auth |
| ------ | --------- | ---- |
| GET    | `/health` | none |
