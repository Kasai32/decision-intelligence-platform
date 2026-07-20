# 0015. Postgres Row-Level Security as tenant-isolation defense-in-depth

Date: 2026-07-20

## Status

Accepted

## Context

A critical review of the whole platform (requested by the user, independent of any roadmap phase) flagged that ADR-0004's shared-schema multi-tenancy relies entirely on every `apps/api` query remembering `where: { tenantId }`. That's been done correctly everywhere so far, but it's discipline, not a guarantee — one missed clause in one future PR is a cross-tenant data leak, and nothing in the stack would catch it. The user asked for this fixed with database-level defense-in-depth: Postgres Row-Level Security (RLS), so a query with no tenant filter at all still returns/writes zero rows for the wrong tenant.

## Decision

### RLS policies (`row_level_security` migration)

Ten tenant-scoped tables get `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + one policy each:

```sql
USING ("tenantId" = current_setting('app.tenant_id', true))
```

`incidents`, `decisions`, `evidence`, `timeline_events`, `actions`, `intelligence_analyses`, `executive_briefs`, `decision_reports`, `lessons_learned`, `integration_configs`. `current_setting(..., true)` (missing_ok) returns `NULL` instead of erroring when no context is set, so an unscoped connection sees zero rows rather than crashing — fail-closed.

**Deliberately excludes `memberships` and `refresh_tokens`.** Both are read during the auth flow itself (`AuthService.login()`'s `user.findUnique({ include: { memberships: true } })`, `refresh()`, `logout()`) — before any tenant context can exist, since determining which tenant(s) a user belongs to is the whole point of that read. Naively including them broke login and refresh entirely during development (every real user's memberships came back empty under RLS). A user-scoped (not tenant-scoped) policy for these two tables is a reasonable future step, not done here.

### The least-privilege role (`app_role_least_privilege` migration) — the part that actually matters

Postgres RLS is unconditionally bypassed by superusers, `FORCE` or not — there is no setting that changes this. The role that runs migrations (`dip` in `docker-compose.yml`, and the equivalent bootstrap user testcontainers creates) is exactly that: the official `postgres` Docker image's `POSTGRES_USER` becomes the cluster's bootstrap superuser. **The first version of the `row_level_security` migration alone was a complete no-op** — verified, not assumed: an adversarial e2e test doing a raw, deliberately unfiltered `SELECT` returned another tenant's row anyway, and `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'dip'` confirmed `t | t`.

The fix: a second Postgres role, `dip_app` (`NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`), created and granted ordinary DML (`SELECT`/`INSERT`/`UPDATE`/`DELETE`, current and future tables via `ALTER DEFAULT PRIVILEGES`) by the same migration mechanism every other schema change uses. `apps/api`'s running `PrismaService` connects as `dip_app` via a new `APP_DATABASE_URL` env var — `DATABASE_URL` (the superuser role) remains what `prisma migrate deploy` uses. If `APP_DATABASE_URL` is unset, `PrismaService` falls back to `DATABASE_URL` and logs a loud warning at startup rather than silently running with RLS disabled — never hidden by omission, same principle as every other honesty-over-convenience decision in this codebase (ADR-0010/0011/0014).

### Setting `app.tenant_id` per request

`TenantRlsInterceptor` (`APP_INTERCEPTOR`, global) reads `request.user.tenantId` — already populated by `JwtAuthGuard`, since guards run before interceptors — and wraps the rest of the request in `runInTenantContext()` (`apps/api/src/prisma/tenant-rls.context.ts`): one Prisma interactive transaction that runs `SELECT set_config('app.tenant_id', $1, true)` (the parameterized, `SET LOCAL`-equivalent form — `SET LOCAL` itself doesn't accept bind parameters) and stores the transaction client on an `AsyncLocalStorage`. Unauthenticated routes (no `request.user`) pass through unwrapped.

`PrismaService` itself is unchanged application code — every existing `constructor(private readonly prisma: PrismaService)` across every service keeps working with zero edits. `PrismaModule` now provides a `Proxy` around it (`tenant-aware-prisma.factory.ts`): property access to a model delegate (`.incident`, `.decision`, ...) checks the `AsyncLocalStorage` first and redirects to the active transaction's client if one exists, falling through to the real client otherwise (unauthenticated routes, app bootstrap, tests). Forwarded values are explicitly `.bind()`ed to their real owner, never the proxy, so a method that internally does `this.something()` — e.g. `PrismaService.onModuleInit` calling `this.$connect()` — doesn't re-enter the trap against the wrong receiver.

**The webhook route is the one exception.** `POST /webhooks/:tenantId/:providerType` is authenticated by HMAC (ADR-0012), not a JWT — `TenantRlsInterceptor` never fires for it, and its tenant identity is known from the URL *before* `WebhookSignatureGuard` even runs (guards run before interceptors, so the interceptor would be too late regardless). `WebhookSignatureGuard`'s own `integrationConfig` lookup and `WebhooksController`'s `evidenceService.create()` call each wrap themselves individually in `runInTenantContext()`.

## Consequences

- **A real regression was caught and fixed along the way, not shipped:** the e2e test suite added in the same remediation pass (see the prior DECISION_LOG entry) is what caught the superuser-bypass no-op — a unit-tested-only version of this change would have shipped believing RLS was enforced when it wasn't.
- **`bootstrapTestApp()` was missing the raw-body-capturing middleware entirely**, discovered only once a webhook e2e test actually needed `request.rawBody`. Every earlier e2e test happened not to exercise the gap. Fixed by extracting `rawBodySaver` into `apps/api/src/common/raw-body.ts`, shared by `main.ts` and the test bootstrap, so they can't drift again.
- **A separate, unrelated build regression surfaced too:** adding `test/*.ts` files caused TypeScript's inferred `rootDir` to shift from `src/` to the repo-relative common ancestor of `src/` and `test/`, changing `nest build`'s output from `dist/main.js` to `dist/src/main.js` — silently breaking `apps/api/Dockerfile`'s `CMD ["node", "dist/main.js"]`. Fixed with an explicit `rootDir: "./src"` and narrowing `tsconfig.json`'s `include` to `src/**/*.ts` only; `ts-jest` (used by both the unit and e2e Jest configs) doesn't need test files listed in that `include` to compile them.
- Every authenticated request now holds one dedicated Postgres connection for its full duration (guard → interceptor → controller → service), not just for its individual query calls — a real, disclosed tradeoff of "wrap the whole request in one transaction" versus "wrap each query individually." Acceptable at this stage's single-instance, low-concurrency assumption (already true of the in-process circuit-breaker state, ADR-0012); worth revisiting (e.g., pgbouncer, or per-query `SET LOCAL` instead) if connection-pool exhaustion becomes a real bottleneck.
- `Membership`/`RefreshToken` remain protected only by app-code `WHERE` clauses, same as before this ADR — a real, disclosed gap, not silently claimed as covered.
- `CREATE ROLE` inside a migration assumes the migration-running role has that privilege — true of `docker-compose.yml`'s `dip` user and every ephemeral testcontainers instance, not necessarily true of a managed cloud Postgres (RDS, Cloud SQL) a future hosting decision might choose. No hosting target is chosen yet (`memory/context.md`'s own open question) — noted here rather than solved speculatively.

## Alternatives considered

- **Per-query `runInTenantContext()` wrapping in every service method**, instead of one interceptor wrapping the whole request — more mechanical/verbose (touches ~10 service files), but avoids holding a connection for the whole request and avoids any AsyncLocalStorage-across-Nest's-pipeline reasoning. Rejected for this pass in favor of the interceptor + Proxy approach (Prisma's own documented pattern for exactly this use case), with the tradeoff explicitly disclosed above rather than silently accepted.
- **Table-owner-only RLS (no second role)**, relying on the migration role also being subject to `FORCE ROW LEVEL SECURITY` — this is what the first version of this change did, and it doesn't work: superusers bypass RLS regardless of `FORCE`. Not a viable alternative, included here because it's exactly the mistake this ADR's own history corrects.
- **A single, unprivileged role for everything (migrations included)**, e.g. having `dip_app` also run migrations — rejected: `NOCREATEDB NOCREATEROLE` and no DDL grants are intentional; a role that can alter tenant-scoped tables' policies is not meaningfully "least privilege" for RLS's purposes, and migrations already have a natural, separate execution point (container start / CI) that doesn't need runtime credentials.
