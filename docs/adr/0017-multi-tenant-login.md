# 0017. Multi-tenant login: a tenant-selection step, not a blocked account

Date: 2026-07-20

## Status

Accepted

## Context

`AuthService.login()` encodes a single `tenantId`/`role` pair into the access JWT (ADR-0005), which requires resolving exactly one tenant membership per login. Since Phase 2, an account with more than one `Membership` row (a real, supported state — `TenantsController`'s `POST /tenants/me/members` lets an ADMIN/OWNER add any existing user to their tenant by email) hit an unconditional `UnauthorizedException` on every subsequent login attempt, with no way out short of direct database intervention. This was a known, self-documented gap (`memory/context.md`), not a newly discovered one: legitimate multi-tenant users — someone consulting for two client organizations, or an owner who also joined a partner's tenant — could add themselves (or be added) to a second tenant and then find themselves permanently locked out.

## Decision

`POST /auth/login` keeps its existing behavior for the common case: 0 memberships still rejects, exactly 1 membership still returns `AuthTokens` directly, unchanged wire format, unchanged for every existing single-tenant account. For >1 memberships, it now returns a `TenantSelectionRequired` response (`{ tenantSelectionRequired: true, tenantSelectionToken, tenants: [{id, name, slug}] }`) instead of throwing. `tenantSelectionToken` is a JWT signed with the same `JWT_ACCESS_SECRET`, 5-minute TTL, carrying only `{ sub: userId, purpose: 'tenant-selection' }` — deliberately missing `tenantId`/`role`. A new `POST /auth/select-tenant` accepts that token plus a chosen `tenantId`, verifies the user still holds that membership, and returns real `AuthTokens` — without re-checking the password, since the selection token already proves it was checked once.

`JwtStrategy.validate()` now explicitly rejects any payload missing `tenantId`/`role` — defense-in-depth so the tenant-selection token (signed with the same secret, structurally a valid JWT) can never be accepted as a bearer token on a protected route, even by accident. This is enforced by `apps/api/test/multi-tenant-login.e2e-spec.ts` in both directions: the selection token rejected as a bearer token, and a normal access token rejected as a selection token.

`apps/web`'s login page gained a second screen: if `/auth/login` returns `tenantSelectionRequired`, show a dropdown of the account's tenants (name, not slug/id) and call `/auth/select-tenant` on submit. A "Back" control returns to the credentials form without a re-fetch (the password was already correct; there's no reason to force retyping it).

## Consequences

- Multi-tenant accounts can log in again — a real, previously undocumented-anywhere-except-`memory/context.md` gap is closed, not worked around.
- Single-tenant accounts (the overwhelming majority) see zero behavior change: same request, same response shape, same one round trip.
- Two round trips for a multi-tenant login (`/auth/login` then `/auth/select-tenant`) instead of one — an accepted UX cost for an infrequent case, and still cheaper than resending the password a second time.
- A new, narrowly-scoped token type exists in the system. It's short-lived (5 minutes), single-purpose (can't be used as a bearer token, can't be used to select a tenant twice usefully since the second call already returns full tokens), and stateless (no new DB table — unlike refresh tokens, it's never persisted or revocable, which is acceptable given the 5-minute window and that it grants no access by itself).
- `AuthController`'s login return type is now a union (`AuthTokens | TenantSelectionRequired`); any caller (frontend or future API client) must branch on `tenantSelectionRequired` before assuming `accessToken` exists — a real (if small) API contract change from the previous always-`AuthTokens` shape.

## Alternatives considered

- **Reject with a clearer error message, but still block login.** Rejected — this was the pre-existing behavior; a better error string doesn't fix that the account is unusable.
- **Log in to an arbitrary/first membership silently.** Rejected outright — this is exactly the kind of system-makes-a-choice-a-human-should-make pattern Principle 1 (ADR-0007) exists to prevent, applied to authentication instead of decisions. A user who is, say, an OWNER of their own tenant and a MEMBER of a client's tenant must not be silently logged into the wrong one.
- **Encode all of a user's tenantId/role pairs into one JWT, let the frontend switch tenants without re-authenticating.** A larger change (every existing `AuthenticatedUser`/`JwtPayload` consumer, RLS's `TenantRlsInterceptor`, assumes one tenant per request) for a benefit (switching tenants mid-session without logging in again) nobody asked for; the actual gap was "cannot log in at all," not "cannot switch tenants without logging out."
- **Re-send the password to `/auth/select-tenant` instead of a short-lived token.** Simpler (no new token type) but means the frontend must hold the plaintext password in memory between the two calls and the user effectively authenticates twice with the same throttle-consuming endpoint shape. The token approach keeps the password read-once and makes the two steps' security boundary explicit (a signed, scoped, time-limited proof of "password already checked") rather than implicit (whatever the frontend happens to still have in a variable).
