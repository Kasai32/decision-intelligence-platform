# Decision Log

Chronological log of technical decisions made during development of the Decision Intelligence Platform. Every non-trivial technical decision made autonomously during the Phase 1 build-out is recorded here at the time it is made. For decisions with broad, lasting architectural impact, a full ADR is also created under `docs/adr/` (see [ADR index](docs/adr/README.md)) and cross-linked below.

Format: `## YYYY-MM-DD — Title` followed by Context / Decision / Rationale / Alternatives considered / Status.

---

## 2026-07-19 — Repository initialized as standalone git repo, `main` as default branch

**Context:** Directory had no VCS. Roadmap (PREREQUIS.md) requires an "enterprise-grade repository ready for development."

**Decision:** `git init -b main`. No remote configured yet (none provided).

**Rationale:** `main` is the current default convention; avoids a later rename. No remote push will happen without explicit user instruction.

**Alternatives considered:** N/A — this is a prerequisite, not a design choice.

**Status:** Done.

---

## 2026-07-19 — Package manager: npm workspaces (not pnpm/yarn/Turborepo)

**Context:** Monorepo needs a workspace-aware package manager. Environment check showed Node v24.15.0 and npm 11.12.1 preinstalled; `pnpm` is not installed and no network-dependent global install was performed in advance.

**Decision:** Use native **npm workspaces** for the monorepo (root `package.json` with a `workspaces` field spanning `apps/*` and `packages/*`).

**Rationale:** Zero additional tooling to install or pin; fully deterministic given what's already on the machine; npm workspaces are sufficient for the current scale (a handful of packages). Avoids taking a dependency on Corepack/pnpm activation succeeding unattended.

**Alternatives considered:**

- pnpm workspaces — faster, stricter, but requires `corepack enable` or a global install; deferred as unnecessary risk for an unattended run.
- Turborepo — adds remote-cache/task-graph value at larger scale; can be layered on top of npm workspaces later (Phase 2+) without restructuring if build times become a problem.

**Status:** Done. Revisit if CI build times become a bottleneck in later phases.

---

## 2026-07-19 — Monorepo layout: `apps/` + `packages/` + `docs/` + `memory/` + `infra/`

**Context:** Roadmap Phase 1 requires "Define project structure" before any business feature work, and later phases (Auth/RBAC/Tenant Mgmt, Executive Dashboard, Decision Intelligence Engine, Integrations) will need clear module boundaries.

**Decision:**

```
apps/api        — NestJS backend (API Gateway + business modules as they land)
apps/web        — Next.js frontend (dashboards, command center)
packages/shared — shared TS types/utils/contracts consumed by api and web
docs/           — architecture, ADRs, guides, api docs
memory/         — project institutional memory (glossary, standing context)
infra/          — Docker, CI/CD-adjacent infra config
```

**Rationale:** Standard, boring, widely-understood layout for a TS full-stack monorepo; keeps backend/frontend/shared concerns separable so Phase 2+ modules (Auth, RBAC, Tenant Management, Decision Intelligence Engine, etc.) can be added as new packages/modules without restructuring.

**Alternatives considered:** Single NestJS app with everything inline — rejected, doesn't scale to the Phase 3–6 feature surface (dashboards need a separate deployable frontend).

**Status:** Done.

---

## 2026-07-19 — Backend framework: NestJS (TypeScript)

**Context:** Phase 2 requires Authentication, RBAC, Tenant Management, API Gateway, Core Database. Phase 4 requires a Decision Intelligence Engine, Recommendation Engine, Confidence Model.

**Decision:** NestJS for `apps/api`.

**Rationale:** Opinionated, modular (DI, decorators, guards, interceptors) — maps directly onto RBAC guards, tenant-scoping middleware/interceptors, and an API-Gateway-style module boundary per integration (ServiceNow, Jira, Slack, Teams, cloud providers, Splunk/Datadog/Sentinel) in Phase 6. Strong TypeScript-first ecosystem, first-class testing support (Jest built in), widely adopted for enterprise Node backends.

**Alternatives considered:**

- Express/Fastify raw — more boilerplate for RBAC/module boundaries at this scale.
- Python (FastAPI/Django) — Phase 4's ML-adjacent "Confidence Model" / "Recommendation Engine" could favor Python, but nothing in Phase 1–3 needs it and splitting language stacks this early adds operational cost with no current payoff. Documented here so Phase 4 can revisit: a Python microservice can be added later for model-heavy work without disturbing the API Gateway.

**Status:** Done. See ADR-0002.

---

## 2026-07-19 — Frontend framework: Next.js (TypeScript, App Router)

**Context:** Phase 3 requires an Executive Command Center, Incident Timeline, Decision Timeline, Executive Dashboard.

**Decision:** Next.js (App Router) for `apps/web`.

**Rationale:** Server components + routing conventions fit a multi-view dashboard app; same language (TypeScript) as the backend, enabling the `packages/shared` types package to be shared without codegen; large ecosystem for charting/dashboard UI needed in Phase 3–5.

**Alternatives considered:** Plain Vite+React SPA — simpler, but Next.js's routing/layout system is a better fit for a multi-section "Command Center" with nested views, and SSR will help with the Executive Brief/Report generation views in Phase 5.

**Status:** Done. See ADR-0002.

---

## 2026-07-19 — Database: PostgreSQL (deferred: ORM choice to Phase 2)

**Context:** Phase 2 requires "Core Database" plus multi-tenant RBAC.

**Decision:** PostgreSQL as the system of record. `docker-compose.yml` provisions a local Postgres instance now so Phase 2 can start immediately against a real database. ORM/migration tool selection (e.g. Prisma) is deferred to Phase 2 since no schema exists yet — recorded here as an open item, not decided prematurely.

**Rationale:** Relational + strong multi-tenant patterns (row-level security, schema-per-tenant, or tenant_id scoping) are all well-supported in Postgres; mature, boring, widely operable choice for an enterprise system of record.

**Alternatives considered:** MySQL — comparable, but Postgres's RLS and JSON support are more useful for audit/evidence-heavy data (Decision Timeline, Evidence Collection in Phase 4) than to any Phase 1 concern.

**Status:** Partially done (infra provisioned). ORM decision open — to be made and logged at the start of Phase 2.

---

## 2026-07-19 — Test runner: Jest across all workspaces

**Context:** Phase 1 requires "Configure testing."

**Decision:** Jest for both `apps/api` (NestJS default) and `apps/web`/`packages/shared`, rather than mixing Jest and Vitest.

**Rationale:** One test runner, one mental model, one CI step across the whole monorepo; NestJS's CLI scaffolds Jest by default so this is also the path of least resistance for the backend.

**Alternatives considered:** Vitest for the frontend (faster, ESM-native) — rejected for now purely for cross-workspace consistency; revisit if `apps/web` test suite grows large enough for Vitest's speed to matter.

**Status:** Done.

---

## 2026-07-19 — Linting/formatting: ESLint flat config + typescript-eslint + Prettier

**Context:** Phase 1 requires "Configure linting" and "Configure formatting" as separate deliverables.

**Decision:** Root-level ESLint flat config (`eslint.config.mjs`) with `typescript-eslint`, applied to all workspaces; Prettier as the sole formatter, wired via `eslint-config-prettier` to avoid rule conflicts.

**Rationale:** Flat config is the current ESLint standard (legacy `.eslintrc` is in maintenance mode); one shared root config avoids drift between `apps/api` and `apps/web` conventions.

**Alternatives considered:** Biome (combined lint+format, much faster) — attractive, but less mature ecosystem coverage for NestJS decorator patterns at time of writing; ESLint+Prettier is the safer default for an enterprise codebase multiple teams will touch.

**Status:** Done.

---

## 2026-07-19 — CI/CD: GitHub Actions

**Context:** Phase 1 requires "Configure CI/CD." No remote/CI provider was specified by the user.

**Decision:** GitHub Actions workflows under `.github/workflows/` (`ci.yml` for lint/test/build, `codeql.yml` for security scanning), on the assumption the repo will eventually be hosted on GitHub given Phase 6's GitHub-adjacent integrations (Jira/ServiceNow/Slack/Teams are typical GitHub-Actions-integrated tools) and it being the most common default.

**Rationale:** No-cost, no-extra-account-setup CI that runs the moment the repo is pushed to GitHub; workflow files are inert (no-op) until pushed, so this carries no risk even if the eventual host differs.

**Alternatives considered:** GitLab CI, CircleCI — would require confirming the actual hosting provider; deferred/easy to swap later since the underlying `npm run lint/test/build` scripts are provider-agnostic.

**Status:** Done. Revisit hosting provider assumption when a remote is added.

---

## 2026-07-19 — Security scanning: CodeQL + npm audit + Dependabot + gitleaks

**Context:** Phase 1 requires "Configure security scanning."

**Decision:** Four layers wired into CI: CodeQL (static analysis, GitHub-native), `npm audit --audit-level=high` (dependency vulnerabilities), Dependabot (`(dependabot.yml`, automated dependency update PRs), and `gitleaks` (secret scanning) as a CI step.

**Rationale:** Covers the four most common enterprise baseline requirements (SAST, dependency CVEs, automated patching, secret leakage) with all-free, all-GitHub-native or zero-config-binary tooling — no paid SaaS security vendor decision needed at Phase 1.

**Alternatives considered:** Snyk — richer but requires an account/API token that doesn't exist yet; can be added in a later phase without removing the above.

**Status:** Done.

---

## 2026-07-19 — Pin TypeScript to latest 5.x (5.9.3), not the new 7.0.2 `latest`

**Context:** While installing dependencies, `npm view typescript dist-tags` showed `latest: 7.0.2` — a new major (the native/Corsa rewrite). Initial package.json files were written against an assumed `^5.6.3` before checking the registry.

**Decision:** Pin `typescript` to `^5.9.3` (the newest 5.x release) across every workspace, not `latest`.

**Rationale:** Checked actual peer-dependency ranges before deciding: `typescript-eslint@8.64.0` requires `typescript: ">=4.8.4 <6.1.0"` and `ts-jest@29.4.11` requires `typescript: ">=4.3 <7"`. TypeScript 7.0.2 satisfies neither — installing it would silently break linting and/or test compilation. This is exactly the kind of two-week-old breaking upgrade an enterprise foundation should not take on day one.

**Alternatives considered:** Take `latest` (7.0.2) — rejected on the compatibility grounds above, not on principle; revisit once `typescript-eslint` and `ts-jest` publish TS7-compatible releases.

**Status:** Done.

---

## 2026-07-19 — All other dependency versions pinned to registry-verified latest-compatible, not initial guesses

**Context:** The same registry check that caught the TypeScript 7 issue was extended to every dependency in the four `package.json` files (NestJS 10→11, Next.js 14→16, React 18→19, ESLint 9→10, Jest 29→30, etc.) — the first pass had been written from training-data assumptions about "current" versions, which were a full major behind reality as of 2026-07-19.

**Decision:** Every dependency version in `package.json` (root, `apps/api`, `apps/web`, `packages/shared`) was checked against `npm view <pkg> version` / `dist-tags` / `peerDependencies` and set to the latest version that is (a) actually published and (b) peer-dependency-compatible with the rest of the stack, rather than left at guessed versions.

**Rationale:** An "enterprise-grade" foundation should start from real current, compatible versions — starting a full major behind on day one just creates immediate upgrade debt for Phase 2.

**Status:** Done.

---

## 2026-07-19 — Force `postcss` to a patched version via npm `overrides`

**Context:** `npm audit` reported a moderate XSS advisory (GHSA-qx2v-qp2m-jg93) in `postcss@8.4.31`, pulled in transitively by `next@16.2.10`. `npm audit fix --force`'s suggested fix was to downgrade `next` to `9.3.3` — a 7-major-version regression, clearly the wrong direction for a real fix.

**Decision:** Added a root-level `"overrides": { "postcss": "^8.5.10" }` in `package.json` to force the resolved `postcss` to a patched 8.5.x release without touching the `next` version, then did a full clean reinstall (`rm -rf node_modules package-lock.json`) — a partial reinstall did not pick up the override.

**Rationale:** `postcss` 8.5.x is semver-compatible with what `next` expects (major 8); this is a safe, minimal fix. `npm ls` reports the override as "invalid" against Next's internal declared version — this is a known cosmetic artifact of npm overrides (it compares against the package's own `package.json` dependency range, not against real compatibility) and does not indicate a functional problem; confirmed by a successful `next build` afterward.

**Alternatives considered:** `npm audit fix --force` (downgrades next 7 majors — rejected, wrong direction). Ignoring the advisory — rejected, a moderate XSS advisory with a trivial compatible fix available is not something to leave unpatched in an "enterprise-grade" baseline.

**Status:** Done. `npm audit` now reports 0 vulnerabilities.

---

## 2026-07-19 — Dedicated Jest tsconfig for `apps/web` (JSX transform mismatch)

**Context:** `apps/web`'s test suite failed with `SyntaxError: Unexpected token '<'`. Root cause: `apps/web/tsconfig.json` sets `"jsx": "preserve"`, which is correct for Next.js's own Turbopack/SWC build pipeline (it does its own JSX transform) but wrong for `ts-jest`, which needs TypeScript itself to lower JSX to `React.createElement`/`jsx()` calls before Node can execute the output.

**Decision:** Added `apps/web/tsconfig.jest.json` (extends the app tsconfig, overrides `jsx: "react-jsx"`, `module: "commonjs"`, `moduleResolution: "node"`, `noEmit: false`) and pointed the `ts-jest` transform at it instead of the main `tsconfig.json`.

**Rationale:** Keeps the Next.js build config untouched (it's correct for its own pipeline) while giving the test runner a config that actually produces executable JS. Two tsconfigs for two different compilation targets (bundler-consumed vs. Node-executed) is the standard pattern here, not duplication for its own sake.

**Status:** Done. `apps/web` tests pass.

---

## 2026-07-19 — Phase 1 foundation verified end-to-end before commit

**Context:** Roadmap deliverable is "a clean enterprise-grade repository ready for development" — verified, not just written.

**Decision:** Before committing, ran the full chain for real: `npm run format:check`, `npm run lint`, `npm run test` (all 3 workspaces), `npm run build` (all 3 workspaces) — all green. Additionally started Docker Desktop (was not running), built both `apps/api` and `apps/web` Docker images from their Dockerfiles, ran the full `docker compose` stack (Postgres + api + web), and confirmed `GET /health` on the API and the rendered homepage on the web app both work against the real containers — then tore the stack down (`docker compose down -v`) and removed the ad-hoc test images, leaving no running state behind.

**Rationale:** A scaffold that merely "looks right" isn't the deliverable; the roadmap explicitly asks for something "ready for development," which means every tool configured in Phase 1 (lint, format, test, build, Docker) has to actually work, not just exist as config files.

**Status:** Done. All green.

---

## 2026-07-19 — Phase 2 started: ORM, multi-tenancy, and auth strategy decided upfront

**Context:** `memory/context.md` flagged three open questions before Phase 2 schema work could start: ORM choice, multi-tenancy isolation strategy, and auth build-vs-buy. All three are load-bearing for the very first migration, so they were resolved before writing `schema.prisma` rather than during it.

**Decision:**

- ORM: **Prisma**. Full rationale in [ADR-0003](docs/adr/0003-orm-prisma.md).
- Multi-tenancy: **shared schema with a `tenantId` column** on every tenant-owned table, scoped at the application layer. Full rationale in [ADR-0004](docs/adr/0004-multi-tenancy-shared-schema.md).
- Auth: **self-hosted email/password + JWT** (argon2 password hashing, access + rotating/revocable refresh tokens), not a third-party provider. Full rationale in [ADR-0005](docs/adr/0005-self-hosted-jwt-auth.md).

**Rationale:** All three are architecturally significant and expensive to reverse once real tenant data and user credentials exist, which is why each got a full ADR rather than just a log entry. The auth decision in particular was constrained by environment reality: this agent has no ability to create an Auth0/Clerk/WorkOS account or obtain real API keys, so "buy" was not actually an available option regardless of its technical merits — documented explicitly so a human doesn't mistake this for a considered rejection of managed auth on the merits alone.

**Status:** Done. See ADR-0003, ADR-0004, ADR-0005.

---

## 2026-07-19 — Override `@hono/node-server` (transitive of `prisma` CLI's unused local-dev feature)

**Context:** Installing `prisma@7.8.0` pulled in `@prisma/dev` (the CLI's optional embedded local-Postgres dev-server feature, not used here — this repo runs Postgres via `docker-compose`), which depends on a vulnerable `@hono/node-server@1.19.11` (moderate: static-file middleware bypass via repeated slashes).

**Decision:** Added `"@hono/node-server": "^2.0.10"` to the root `overrides` alongside the existing `postcss` override.

**Rationale:** Same pattern as the earlier `postcss` fix — a targeted override to a patched, semver-compatible version rather than downgrading `prisma` itself. The vulnerable code path (`prisma dev`'s embedded server) isn't exercised by this project's workflow at all, but patching costs nothing and keeps `npm audit` clean.

**Status:** Done. `npm audit` reports 0 vulnerabilities.

---

## 2026-07-19 — Pin `prisma`/`@prisma/client` to latest 6.x (6.19.3), not 7.8.0

**Context:** `prisma generate` against `prisma@7.8.0` failed immediately: `datasource.url` in `schema.prisma` — the exact pattern documented in ADR-0003 and used across the Prisma ecosystem for years — is no longer supported in Prisma 7. It now requires a `prisma.config.ts` file and an explicit driver adapter (`@prisma/adapter-pg` or similar) passed to the `PrismaClient` constructor instead of a plain connection URL.

**Decision:** Pinned `prisma` and `@prisma/client` to `^6.19.3` (latest stable 6.x) instead of `latest` (7.8.0). This also made the `@hono/node-server` override (added for `prisma@7`'s bundled local-dev-server dependency) dead weight, so it was removed from `overrides` in the same pass.

**Rationale:** Same principle as the earlier TypeScript 7 decision (see above): a two-week-old major version that changes a core, widely-documented configuration pattern is not something an unattended "enterprise-grade foundation" build should take on by default. Prisma 6.19.3 uses the classic, extremely well-documented `datasource { url = env("DATABASE_URL") }` pattern this schema (and ADR-0003, ADR-0004) were already written against, with no functional loss for this project's single-Postgres-datasource use case.

**Alternatives considered:** Adopt Prisma 7's driver-adapter model now (`@prisma/adapter-pg` + `prisma.config.ts`) — rejected for now as unnecessary complexity with no benefit for a single, plain Postgres connection; worth revisiting once the ecosystem (docs, NestJS integration examples, Stack Overflow-level tribal knowledge) has caught up to Prisma 7.

**Status:** Done. `prisma generate` runs successfully against 6.19.3.

---

## 2026-07-19 — `prisma` CLI moved to `dependencies`, runtime image runs `prisma migrate deploy` on start

**Context:** The API Docker image needs to apply Prisma migrations against whatever Postgres it's pointed at when it starts (there's no separate migration-runner step in this Phase 2 cut). `prisma` (the CLI) was initially a devDependency, which is the common default, but that meant it wouldn't be present in the runtime image at all if devDependencies were ever pruned.

**Decision:** Moved `prisma` from `devDependencies` to `dependencies` in `apps/api/package.json`. The runtime Docker image's `CMD` is now `npx prisma migrate deploy && node dist/main.js` — migrations run automatically on container start, before the server accepts traffic. The runtime stage also now copies `apps/api/node_modules` (not just the root `node_modules`) from the `build` stage, because `@prisma/client` resolves into the workspace-local `node_modules` in this monorepo's hoisting layout, and it copies `apps/api/prisma` (schema + migrations) since `prisma migrate deploy` needs both at runtime.

**Rationale:** Running migrations automatically on container start is the simplest correct behavior for this stage (single-instance dev/staging use) — it means `docker compose up` alone is sufficient to get a working, migrated database, with no separate manual step. This is a known tradeoff versus a dedicated migration-job step (which avoids races if multiple API replicas start concurrently); acceptable now with a single `api` replica in `docker-compose.yml`, and flagged here as something to revisit before any multi-replica deployment.

**Status:** Done. Verified: `docker compose up --build` builds both images, the `api` container applies the Prisma migration and starts cleanly, and `GET /health` plus `POST /api/v1/auth/register` both succeed against the live containerized stack.

---

## 2026-07-19 — Add `python3 make g++` to the API image's build stage (argon2 native binding)

**Context:** `docker compose up --build` failed at `npm ci` in `apps/api/Dockerfile`'s `deps` stage: `argon2` (chosen in ADR-0005) ships a native Node binding and no prebuilt binary was available for this image's platform, so `npm` fell back to compiling from source via `node-gyp`, which requires Python and a C++ toolchain — neither present in the minimal `node:20-alpine` base image.

**Decision:** Added `RUN apk add --no-cache python3 make g++` to the `deps` build stage, before `npm ci`. The final `runtime` stage is unaffected (still `node:20-alpine` with no build tools) since only the compiled `.node` binary is carried forward inside `node_modules`, not the toolchain itself.

**Rationale:** This is the standard, well-known fix for native npm modules on Alpine and keeps ADR-0005's argon2 choice intact rather than downgrading to a pure-JS hashing library to dodge the build issue. Runtime image size/attack-surface is unaffected since the toolchain only exists in an intermediate build stage, discarded from the final image.

**Alternatives considered:** Switch to a pure-JS or prebuilt-binary password hashing library (e.g. `bcryptjs`) to avoid native compilation — rejected; argon2 is the stronger, modern default already decided in ADR-0005, and the actual fix (add build tools to one Dockerfile stage) is small and standard.

**Status:** Done. Verified via a full `docker compose up --build`.

---

## 2026-07-19 — Phase 2 (Platform core) complete and verified end-to-end

**Context:** Roadmap Phase 2 deliverable: Authentication, RBAC, Tenant Management, API Gateway, Core Database.

**Decision:** Phase 2 is done: `Tenant`/`User`/`Membership`/`RefreshToken` Prisma models + migration; `AuthModule` (register/login/refresh/logout, argon2 hashing, rotating revocable refresh tokens); `RolesGuard`/`JwtAuthGuard`/`@Roles` RBAC with `OWNER > ADMIN > MEMBER` rank; `TenantsModule` (get/update tenant, list/add/remove members, owner-removal protected); API Gateway concerns in `main.ts` (global `ValidationPipe`, global `AllExceptionsFilter`, `/api/v1` prefix, Swagger at `/api/v1/docs`); Docker/`docker-compose` wired to run migrations automatically on container start; 21 new unit tests (32 total in `apps/api`) covering the auth service, RBAC rank logic, and tenant service edge cases (duplicate registration, wrong password, expired/revoked/reused refresh tokens, duplicate/missing membership, owner-removal protection).

**Rationale:** Before committing, the full flow was exercised for real — not just unit-tested — first against a locally-run build (`node dist/main.js` against a local Postgres) and then against the actual `docker compose up --build` stack: register → login → refresh (with old-token-reuse correctly rejected) → tenant lookup → add/list members → owner-removal correctly blocked (403) → duplicate-membership correctly blocked (409). All of `lint`, `format:check`, `test` (34 tests across 3 workspaces), and `build` pass; `npm audit` reports 0 vulnerabilities.

**Status:** Done. Phase 3 (Executive Command Center / Incident & Decision Timelines / Dashboard) is next — see `memory/context.md` for why that phase's data-model design is flagged as needing more product input than Phases 1–2 did.

---

## 2026-07-19 — Phase 3 unblocked: user supplied the domain model + guard spec directly

**Context:** The user asked to resume the autonomous loop for Phase 3, citing a detailed Domain Model / State Transition Guards / Interface Contract spec they said was "documented in PREREQUIS.md". On disk, `PREREQUIS.md` still only had the original one-line-per-item Phase 3 bullet list (Executive Command Center, Incident Timeline, Decision Timeline, Executive Dashboard) — the detailed spec was not actually there, the same gap pattern as the original empty `PREREQUIS.md`/`instruction.md` at the very start of this build.

**Decision:** Did not block on the discrepancy. The user's chat message itself contained a complete, actionable spec (five named entities with tenant isolation, a concrete state-transition guard example, an explicit "Principle 1" rule, and a North-Star UI contract), which is sufficient to proceed. The spec was transcribed into `PREREQUIS.md` under a new "Phase 3 — Detailed Specification" subsection (flagged as user-supplied-in-chat, not originally on disk) so it's preserved for future reference, same treatment as the original roadmap capture.

**Rationale:** Blocking a second time on the same class of gap (claimed file content vs. actual file content) would waste the user's explicit unblock instruction when the actual information needed was already in hand. Silently proceeding without noting the discrepancy would risk the user believing a document exists that doesn't. Recording it transparently in both `PREREQUIS.md` and here satisfies both concerns.

**Status:** Done. See ADR-0006, ADR-0007, ADR-0008, ADR-0009 for the resulting technical decisions.

---

## 2026-07-19 — Phase 3 architecture decided upfront: domain model naming, guard layering, integration seam, UI contract

**Context:** Four architecturally significant decisions had to be made before writing any Phase 3 code, each getting a full ADR because each is expensive to reverse once incident/decision data or frontend code depends on it.

**Decision:**

- `organization_id` (spec wording) is treated as this codebase's existing `tenantId`/`Tenant` concept, not a new parallel `Organization` model; spec field names normalized from snake_case to this codebase's camelCase convention (e.g. `human_decision` → `humanDecision`). Full rationale: [ADR-0006](docs/adr/0006-incident-decision-domain-model.md).
- State transition validity (generic FSM guard) and the Decision→DECIDED human-stakeholder rule (Principle 1) are implemented as two separate, composable layers, not one entangled check. Full rationale: [ADR-0007](docs/adr/0007-state-transition-guards.md).
- Phase 6's ten integrations get one shared `IntegrationProvider` TypeScript interface + a `MockIntegrationProvider` per system, wired into `IncidentsService`/`DecisionsService` now so the seam is actually exercised, not just defined. Full rationale: [ADR-0008](docs/adr/0008-phase6-integration-abstraction.md).
- The Executive Command Center's "never blank, show last decision if none open" rule is computed once server-side (`GET /incidents/:id/command-center`), not reimplemented per frontend surface. Full rationale: [ADR-0009](docs/adr/0009-command-center-no-blank-state.md).

**Rationale:** Same reasoning as the Phase 2 upfront-decisions entry above: these are load-bearing choices that get more expensive to change the more code depends on them, so they were resolved before, not during, implementation.

**Status:** Done. See ADR-0006 through ADR-0009.

---

## 2026-07-19 — Bug fix: state-machine same-state shortcut let an already-DECIDED Decision be "re-decided"

**Context:** Caught by a unit test, not by inspection: the original `assertValidTransition` treated `from === to` as an unconditional no-op (a reasonable-sounding convenience — "setting status to what it already is shouldn't error"). But `DecisionsService.decide()` always calls it with a fixed `to = DECIDED`. For a `Decision` already in `DECIDED` status, `from === to === DECIDED` tripped the no-op shortcut and skipped the transition check entirely — `decide()` would then proceed straight to the human-stakeholder membership lookup and silently overwrite an already-decided `Decision`'s `humanDecision`/`decidedByUserId`/`decidedAt`. This directly undermines Principle 1's intent: a decision, once made by a named human, must be immutable, not silently re-writable.

**Decision:** Removed the `from === to` shortcut from `assertValidTransition` entirely. Every transition, including a same-state one, must now be explicitly listed in the entity's `TransitionMap` to be allowed — there is no implicit "no-op is always fine" behavior. Since none of the Phase 3 transition maps (`INCIDENT_TRANSITIONS`, `DECISION_TRANSITIONS`, `ACTION_TRANSITIONS`) list any state as reachable from itself, a same-state call now correctly throws `BadRequestException` everywhere, including re-deciding/re-cancelling a `Decision` and re-setting an `Incident`/`Action` to its current status.

**Rationale:** An implicit convenience in a generic, shared engine silently created a real correctness gap in the one place (`Decision.decide()`) where immutability actually matters. Requiring every legal transition — including same-state ones — to be explicit in the map removes an entire class of "convenient default quietly does the wrong thing for one specific caller" bugs, at the cost of needing an explicit self-loop entry (`RED: ['RED', ...]`) for any future entity where idempotent same-state PATCH really is desired.

**Status:** Done. Test added: `state-machine.spec.ts` — "rejects a same-state transition unless explicitly allowed"; `decisions.service.spec.ts` — "rejects deciding a Decision that is not OPEN (already DECIDED)" now correctly fails closed.

---

## 2026-07-19 — Phase 3 complete and verified end-to-end, including a live adversarial test of Principle 1

**Context:** Roadmap Phase 3 deliverable (per the user-supplied §2 spec): Incident/Decision/Evidence/TimelineEvent/Action domain model, state transition guards with Principle 1 enforcement, Phase 6 integration mocks, and a no-blank-state Executive Command Center.

**Decision:** Phase 3 is done: 5 new Prisma models + migration; generic state-transition guard engine + per-entity maps (Incident/Decision/Action); `DecisionsService.decide()` enforcing Principle 1; `EvidenceService`/`ActionsService`; `IntegrationsRegistryService` with 10 mock providers wired into incident/decision events; `GET /incidents/:id/command-center` shaping the no-blank-state contract; `apps/web` Executive Command Center (`IncidentDecisionPanel` + login + API client). 33 new backend tests (65 total in `apps/api`) and 5 new frontend tests (6 total in `apps/web`).

**Rationale — verification, not just unit tests:** Before committing, ran a live adversarial sequence against the full `docker compose up --build` stack, specifically trying to defeat Principle 1: (1) `POST /incidents/:id/command-center`-equivalent before any decision existed → confirmed `{openDecision: null, lastDecision: null}`, never a missing/blank field; (2) opened a decision, then attempted `decide()` with a fabricated `decidedByUserId` (a UUID that is not a real tenant member — simulating an AI or script trying to self-attest a decision) → correctly rejected with `400` and the exact Principle-1 message; (3) attempted `decide()` with no `humanDecision` → correctly rejected by the DTO validator; (4) `decide()` with a real, verified tenant member → succeeded, `201`; (5) command-center re-checked → correctly fell back to `lastDecision` (North Star requirement); (6) attempted to `decide()` the same, now-`DECIDED` decision again → correctly rejected, `DECIDED -> DECIDED` is not an allowed transition (the same bug class fixed above, now proven closed live, not just in a mock-based unit test); (7) fetched the incident's `TimelineEvent` audit trail → confirmed `INCIDENT_CREATED`, `DECISION_OPENED`, `DECISION_DECIDED` all present and attributed to the correct actor.

**Status:** Done. All of `lint`, `format:check`, `test` (72 tests across 3 workspaces), and `build` pass; `npm audit` reports 0 vulnerabilities. No git remote exists to push to (see `memory/context.md`) — committed locally only.

---

## 2026-07-19 — Phase 4 started: multidimensional confidence model, not a single black-box score

**Context:** The user gave an explicit, detailed spec for the Decision Intelligence Engine's confidence model: four separate dimensions (`evidenceCompleteness`, `sourceReliability`, `dataFreshness`, `aiCertainty`), never merged into one number, plus a strict `AIOutputContract` that a validation layer must reject if incomplete. They referred to the write-up destination as "ADR-0007" — that number already belongs to the Phase 3 state-transition-guards ADR, so this work is recorded as **ADR-0010** instead (next sequential number per `docs/adr/README.md`'s own rule), not a silent overwrite of Phase 3's record.

**Decision:** Full rationale in [ADR-0010](docs/adr/0010-decision-intelligence-confidence-model.md). Summary: two schema fields added (`Incident.type`, `Evidence.sourceCategory`) to make the completeness/reliability algorithms computable from real data; all four dimensions implemented as pure, independently-unit-tested functions; `aiCertainty` implemented as an explicit, documented deterministic heuristic (evidence volume + source diversity − conflict count) rather than a fabricated "ML" number, since no trained model or historical corpus exists in this system yet; the `AIOutputContract`'s computed fields (`confidenceDimensions`, `evidenceUsed`, the evidence-completeness portion of `missingInformation`) can never be supplied by a caller — only the server, from real `Evidence` rows, produces them.

**Rationale:** Same principle as Phase 3's Principle 1 (no self-attested decisions) applied to confidence scoring: if a client could POST its own `confidenceDimensions`, the "auditable, non-black-box" property the user asked for would be worthless — anyone could claim 100% completeness. Computing it server-side from data a human could independently query and verify is what makes it actually auditable, not just labeled as such.

**Status:** In progress — see subsequent entries for implementation, tests, and live verification.

---

## 2026-07-19 — Fixed two gaps that would have silently defeated the scoring model

**Context:** While wiring `DecisionIntelligenceEngineService` to real `Incident`/`Evidence` data, found that `CreateIncidentDto` never exposed the new `type` field and `CreateEvidenceDto` never exposed the new `sourceCategory` field — both were added to the Prisma schema (ADR-0010) but not threaded through the existing Phase 3 create endpoints.

**Decision:** Added `type?: IncidentType` to `CreateIncidentDto`/`IncidentsService.create()` and `sourceCategory?: EvidenceSourceCategory` to `CreateEvidenceDto`/`EvidenceService.create()`, both optional with the schema's `OTHER` default preserved.

**Rationale:** Without this, every incident/evidence row would silently stay at `type: OTHER` / `sourceCategory: OTHER` regardless of what was actually created, `REQUIRED_EVIDENCE_SOURCES[OTHER] = []`, and `evidenceCompleteness` would always compute to 100% — a confidence dimension that always reports "fully complete" regardless of reality is exactly the fake-precision black box the user's entire Phase 4 directive is about _not_ building. Caught before commit by manually tracing the field from HTTP request through to the scoring functions, not by a failing test (the unit tests mock Prisma with `type`/`sourceCategory` supplied directly, so they wouldn't have caught a controller-layer gap — a live end-to-end check would have; see the verification entry below).

**Status:** Done. Verified live: creating a `CLOUD_OUTAGE` incident and `MONITORING`/`CLOUD_PROVIDER` evidence via the real HTTP API now correctly reports `evidenceCompleteness: 100` only once both are actually present.

---

## 2026-07-19 — Phase 4 complete and verified end-to-end, including adversarial contract tests

**Context:** Roadmap Phase 4 deliverable: `DecisionIntelligenceEngineService`, a deterministic 4-dimension confidence model, strict `AIOutputContract` validation, freshness-decay tests, documentation.

**Decision:** Phase 4 is done: `IncidentType`/`EvidenceSourceCategory` enums + `Incident.type`/`Evidence.sourceCategory` fields + `IntelligenceAnalysis` model + migration; four pure scoring functions (`evidenceCompleteness`, `sourceReliability`, `dataFreshness`, `aiCertainty`) each independently unit-tested (24 tests, including freshness decay across elapsed time, per-severity degradation rates, and reproducibility with a fixed `now`); `AIOutputContractDto` (extends `SubmitIntelligenceAnalysisDto`) with every field required, including `missingInformation`/`conflictingInformation` as required (non-optional) arrays; `DecisionIntelligenceEngineService.analyze()` computing the objective fields server-side and validating the fully-assembled contract via a second, internal `class-validator` pass (8 more service tests, including a deliberately-malformed-object test proving this second pass catches what the controller boundary might miss). 96 tests total in `apps/api` (103 across the whole monorepo).

**Rationale — live adversarial verification, not just unit tests:** Before committing, ran a full sequence against `docker compose up --build`: (1) created a `CLOUD_OUTAGE`/`HIGH` incident and ran `/analyze` with zero evidence attached → confirmed all four dimensions honestly report `0`, `missingInformation` correctly lists both missing required sources (`MONITORING`, `CLOUD_PROVIDER`), and the contract is still fully-formed (never a blank/partial response); (2) added one `MONITORING` and one `CLOUD_PROVIDER` piece of evidence, re-ran `/analyze` → `evidenceCompleteness: 100`, `sourceReliability: 93` (mean of 90 and 95), `dataFreshness: 100` (just-created evidence), `aiCertainty: 44` (2 evidence × 15 + 2 categories × 7), each computed independently and never merged; (3) attempted `/analyze` with `conflictingInformation` omitted entirely → `400`, exact Principle-3 violation; (4) attempted `/analyze` with a client-supplied `confidenceDimensions: {..., 100}` in the request body, simulating a caller trying to self-attest a fake confidence score → `400 "property confidenceDimensions should not exist"`, rejected by the controller's own DTO shape before the request even reaches the service — the strongest possible proof that a client cannot fabricate its own confidence numbers.

**Status:** Done. All of `lint`, `format:check`, `test` (103 tests across 3 workspaces), and `build` pass; `npm audit` reports 0 vulnerabilities.

---

## 2026-07-19 — Phase 5 started without a detailed user spec — design judgment recorded upfront

**Context:** Unlike Phase 3/4, the user's instruction to continue Phase 5 came with no technical spec — only the four roadmap bullet items (Executive Brief Generator, Decision Reports, Lessons Learned, Knowledge Base). Real design decisions had to be made independently.

**Decision:** Full rationale in [ADR-0011](docs/adr/0011-phase5-reporting-architecture.md). Summary: Executive Briefs and Decision Reports are immutable, persisted, point-in-time snapshots (like `IntelligenceAnalysis`, ADR-0010) rather than recomputed views; brief/report narrative content is assembled from real facts via a small deterministic template, never fabricated prose (same no-black-box principle as ADR-0010, since no LLM integration exists here); Lessons Learned are entirely human-authored and gated to `Incident.status = CLOSED`; the Knowledge Base is search (Postgres `ILIKE` + tag filter) over `LessonLearned`, not a new content type or a search engine.

**Rationale:** Where the user gives an explicit spec (Phase 3/4), follow it exactly and flag any gaps. Where none exists (this phase), the responsible path is to apply the same architectural principles already established and validated in this codebase — auditable persistence, no fabricated intelligence, tenant isolation, guarded preconditions — rather than either inventing an unconstrained feature set or stalling the loop waiting for detail that wasn't offered.

**Status:** In progress — see subsequent entries for implementation, tests, and verification.

---

## 2026-07-19 — Phase 5 complete and verified end-to-end, including the CLOSED-incident guard

**Context:** Roadmap Phase 5 deliverable: Executive Brief Generator, Decision Reports, Lessons Learned, Knowledge Base (see ADR-0011 for the full design).

**Decision:** Phase 5 is done: `ExecutiveBrief`/`DecisionReport`/`LessonLearned` Prisma models + migration; `ExecutiveBriefsService.generate()` assembling a factual snapshot (title, status/severity, a template-based `summary`, `businessImpact`/`openRisks` from the latest `IntelligenceAnalysis` if any, `nextActions` from open `Action`s); `DecisionReportsService.generate()` snapshotting a decision's outcome plus evidence/timeline scoped strictly to that decision; `LessonsLearnedService.create()` gated to `Incident.status = CLOSED`; `LessonsLearnedService.search()` (Knowledge Base) via Postgres `ILIKE` + tag `hasSome`. 16 new tests (112 total in `apps/api`).

**Rationale — live verification, not just unit tests:** Before committing, ran a full sequence against `docker compose up --build`: created an incident, opened and decided a decision, generated an Executive Brief → confirmed the `summary` field read exactly `Incident "Checkout latency spike" is currently OPEN (MEDIUM severity). 1 of 1 decision(s) made.` (a real count, not invented text), `keyDecisions` reflected the actual decided decision, `businessImpact`/`openRisks` were correctly `null`/`[]` since no `IntelligenceAnalysis` existed for this incident (no silent fabrication to fill the gap); generated a Decision Report → confirmed `evidenceSummary`/`timelineSummary` were correctly empty/scoped to just that decision's own timeline events (`DECISION_OPENED`, `DECISION_DECIDED`), not the whole incident's; attempted to record a Lesson Learned on the still-`OPEN` incident → `400`, exact guard message; walked the incident through its full guarded lifecycle (`OPEN → MITIGATED → RESOLVED → CLOSED`); recorded the Lesson Learned again on the now-`CLOSED` incident → succeeded; searched the Knowledge Base by both free-text query and tag → both correctly found the one match; searched for an unrelated term → correctly found zero.

**Status:** Done. All of `lint`, `format:check`, `test` (119 tests across 3 workspaces), and `build` pass; `npm audit` reports 0 vulnerabilities.

---

## 2026-07-19 — Phase 6 unblocked: resilience engine + per-tenant config replaces the "need real OAuth" constraint

**Context:** The user supplied a detailed, three-part spec for Phase 6: (A) a circuit-breaker + retry resilience engine wrapping `IntegrationProvider`, (B) per-tenant encrypted credentials in a new `IntegrationConfig` table with automatic `STUB_MODE` fallback, (C) HMAC-validated inbound webhooks. Explicit instruction: no real OAuth tokens needed — use encrypted fixtures and simulated network failures to prove the circuit breaker, not real API calls. This directly resolves the blocker recorded after Phase 3 (`memory/context.md`: "Phase 6 cannot be built for real without credentials").

**Decision:** Full rationale in [ADR-0012](docs/adr/0012-integration-resilience-and-tenant-config.md). Summary: generic `CircuitBreaker`/`withRetry` primitives (`apps/api/src/common/resilience/`); `IntegrationProvider` methods now return a real `IntegrationCallResult` (`delivered`/`mode`/`freshness`/`reliability`) instead of `void`, so there is something to cache/degrade; `ConfigurableIntegrationProvider` falls back to `STUB_MODE` (`freshness: 0, reliability: 'MOCK'`) when a tenant has no credentials or `status: BROKEN`; `ResilientIntegrationProvider` wraps it with the circuit breaker and caches the last successful result for degraded responses; `IntegrationsRegistryService` is rewritten to be tenant-aware and DB-backed, caching one resilient provider per `(tenantId, providerKey)` so breaker state actually persists across calls; `TimelineEventType.INTEGRATION_BLOCKED` is written exactly once per CLOSED/HALF_OPEN → OPEN transition; credentials are AES-256-GCM encrypted via Node's built-in `crypto` (no new dependency); a generic `POST /webhooks/:tenantId/:providerType` validates an HMAC-SHA256 signature over the raw request body with `crypto.timingSafeEqual`, rejecting anything that doesn't match before the payload is ever parsed.

**Rationale:** Same principle as every prior phase's guard work: prove the failure-handling code path for real, not just structurally. A resilience engine that's never actually forced to fail is unverified. The plan (see later entries) is to test it with an injected network simulator that deterministically fails N times, not a random flake.

**Status:** In progress — see subsequent entries for implementation, tests, and live verification.

---

## 2026-07-19 — `FixtureNetworkSimulator`: a documented failure-injection hook, so the circuit breaker can be proven live, not just in unit tests

**Context:** The production `NetworkSimulator` always succeeds (there's no real endpoint to fail against). That's correct for unit tests (which inject their own failing simulator via DI), but it means the resilience engine could not be demonstrated end-to-end against the real running API — every prior phase's verification standard in this project has included a live `docker compose` proof, and this one shouldn't be an exception just because the thing being tested is "what happens when an external system is down."

**Decision:** Renamed the production default to `FixtureNetworkSimulator` and gave it one documented behavior: if a tenant's own (fixture) credentials contain `simulateFailure: true`, the call throws `NetworkSimulationError`; otherwise it's a no-op success. This is not a hidden backdoor — it only ever reacts to a value the tenant explicitly put into their own encrypted credentials via `POST /integrations/:type/config`, the same way a real integration's "sandbox mode" flag might work.

**Rationale:** This makes the entire resilience story — configure with fixture credentials, watch it succeed, flip `simulateFailure` on, watch 3 consecutive failures trip the circuit and produce an `INTEGRATION_BLOCKED` `TimelineEvent`, watch it recover after the cooldown — independently verifiable by a human hitting the real HTTP API, not just readable in test code. See the live-verification entry below for the actual run.

**Status:** Done. 3 new tests (160 total in `apps/api`).

---

## 2026-07-19 — Phase 6 complete and verified end-to-end, including a live-triggered circuit breaker and a live webhook forgery attempt

**Context:** Roadmap Phase 6 deliverable: `IntegrationConfig` table with strict tenant isolation, circuit breaker + retry, graceful degradation to an explicit `STUB_MODE` with an `INTEGRATION_BLOCKED` `TimelineEvent`, adversarial resilience tests, and HMAC-secured webhooks (see ADR-0012).

**Decision:** Phase 6 is done: `IntegrationConfig`/`IntegrationConfigStatus`/`IntegrationKey` (moved to Prisma) + migration; `CircuitBreaker`/`withRetry` generic primitives (12 tests); `CredentialsEncryptionService` (AES-256-GCM, 5 tests); `ConfigurableIntegrationProvider` + `ResilientIntegrationProvider` (9 tests, including the core adversarial "3 consecutive simulated failures trips the breaker, fails fast without further network calls, returns cached last-known-good, recovers after the cooldown" sequence); `IntegrationsRegistryService` rewritten as a tenant-aware, DB-backed, cached registry (9 tests, including "writes exactly one `INTEGRATION_BLOCKED` event on the OPEN transition, not on every subsequent blocked call"); `IntegrationConfigService` + `IntegrationsController` for config CRUD (6 tests); `WebhookSignatureGuard` + `WebhooksController` for HMAC-secured inbound alerts (8 adversarial tests: forged signature, tampered body, missing config, unknown provider, missing webhook secret). 160 tests total in `apps/api` (167 across the monorepo).

**Rationale — live adversarial verification against the real running stack, not just unit tests:** Before committing, ran a full sequence against `docker compose up --build`: (1) checked `/integrations` before any config → `NOT_CONFIGURED`/`STUB_MODE` for all ten; (2) configured Slack with healthy fixture credentials → `ACTIVE`, `circuitState: CLOSED`; (3) reconfigured Slack with `simulateFailure: true` and created three incidents in a row (each triggers a real `broadcast()` call) → circuit stayed `CLOSED` after failures 1 and 2, then flipped to `OPEN` on exactly the 3rd, with a `TimelineEvent` of type `INTEGRATION_BLOCKED` on that incident's timeline containing the degraded result; (4) created a 4th incident while `OPEN` → confirmed zero additional `INTEGRATION_BLOCKED` events (the "exactly once per transition" rule holds live, not just in the mocked unit test) and the circuit stayed `OPEN`; (5) confirmed `/integrations` never leaks the raw fixture credential value in any response; (6) confirmed unauthenticated access to `/integrations` is `401`; (7) configured Splunk with a `webhookSecret`, computed a real `HMAC-SHA256` signature with Node's `crypto` from the shell, and POSTed to `/webhooks/:tenantId/SPLUNK` — a correctly signed alert was accepted (`201`, a real `Evidence` row created with `submittedByUserId: null`) and a forged signature was rejected (`401 "Invalid signature"`) before any payload processing.

**Status:** Done. All of `lint`, `format:check`, `test` (167 tests across 3 workspaces), and `build` pass; `npm audit` reports 0 vulnerabilities. All six `PREREQUIS.md` phases now have a working MVP.

---

## 2026-07-19 — User validation testing prep: SimulationScenarioService, and a real gap it found

**Context:** The user asked for a `SimulationScenarioService` to instantiate two realistic test scenarios (ransomware with two simultaneous urgent decisions; cloud outage with incomplete evidence) via an ADMIN-only endpoint, for a facilitator to trigger during live user-validation sessions. Referenced `incident-commander-validation-guide.md` does not exist in this repo — same gap pattern as prior phases, not blocking since the message itself carried a usable spec.

**Decision:** Full rationale in [ADR-0013](docs/adr/0013-simulation-scenario-architecture.md). Summary: (1) amended `GET /incidents/:id/command-center` (ADR-0009) from a single `openDecision` to `openDecisions: Decision[]` — building Scenario A (two simultaneously open decisions) exposed that the old singular shape silently hid every open decision after the first, which would have made the very scenario meant to test multi-decision behavior test nothing; (2) `SimulationScenarioService` builds both scenarios entirely from existing, already-guarded services (`IncidentsService`, `DecisionsService`, `EvidenceService`, `IntegrationConfigService`, `IntegrationsRegistryService`, `DecisionIntelligenceEngineService`) — no new persistence path, no guard bypass; (3) Scenario B doesn't fake its "not enough evidence" message — it withholds `MONITORING` evidence for real and actually trips the tenant's `DATADOG` circuit breaker (via ADR-0012's `simulateFailure` fixture hook) before seeding a real `IntelligenceAnalysis`, so the resulting `missingInformation`/`evidenceCompleteness` are genuinely computed, not scripted; (4) both scenarios are strictly scoped to the calling admin's own tenant and prefix every created incident `[SIMULATION]`.

**Rationale:** Same principle as the entire build so far — a test fixture that fakes the very behavior it's meant to validate would be worse than no fixture at all. Reusing real services means any bug the scenarios surface during a live user session is a bug in the actual code path, not an artifact of the simulation harness.

**Status:** Accepted. Implemented (`apps/api/src/simulation/{simulation-scenario.service.ts,simulation.controller.ts,simulation.module.ts,dto/trigger-simulation.dto.ts}`, `apps/web/src/app/simulation/page.tsx`), tested (14 new `SimulationScenarioService` unit tests incl. tenant isolation, 4 new/rewritten `apps/web` tests for the amended multi-decision panel and the new `/simulation` page — 175 `apps/api` + 11 `apps/web` tests total, all green; lint and build clean across `apps/api`/`apps/web`/`packages/shared`), and verified live end-to-end via `docker compose up --build` with adversarial curl testing:

- `POST /simulation/trigger` with no token → `401`; with an invalid `scenario` value → `400` with the exact allowed values listed.
- Two separate tenants (A, B) registered; tenant A's OWNER (rank ≥ ADMIN) triggered `CYBER_RANSOMWARE` — `GET /incidents/:id/command-center` came back with `openDecisions` holding **both** simultaneously open decisions ("isolate the network segment?" / "issue a public breach communication?"), confirming the ADR-0009 amendment actually fixes the gap it was written for.
- Tenant B triggered `CLOUD_OUTAGE_PARTIAL_EVIDENCE`: `GET /integrations` showed `DATADOG` at `circuitState: "OPEN"` (a real, in-process circuit-breaker trip, not a hand-set flag), and the seeded `IntelligenceAnalysis` genuinely reported `evidenceCompleteness: 50` and `missingInformation: ["Missing evidence source: MONITORING"]` — the engine's own computation, not a scripted message.
- Tenant isolation, adversarially: tenant B's `GET /incidents/:tenantAIncidentId` → `404`; tenant A's incident list never contained tenant B's incident; and critically, tenant A's `DATADOG` integration remained `NOT_CONFIGURED`/`CLOSED` throughout — tenant B's circuit-breaker trip had zero effect on tenant A's provider state, confirming the per-`(tenantId, providerKey)` cache in `IntegrationsRegistryService` truly isolates resilience state across tenants.
- Re-triggering `CLOUD_OUTAGE_PARTIAL_EVIDENCE` a second time on tenant B succeeded (`201`) without error, confirming the idempotent-in-effect behavior noted in ADR-0013's Consequences.
- `apps/web`'s `/simulation` page returned `200` from the containerized build.

---

## 2026-07-19 — Frontend design system: dark command-center UI, severity colors, live SLA countdowns (user-named "Phase 4: Command Center UI & Decision Log UI")

**Context:** The user judged the Dry Run's technically-validated backend an unacceptable demo experience because `apps/web` had zero styling — every page was unstyled default HTML. They explicitly halted all backend work and scoped the task to the frontend only: adopt a professional design system (naming Tremor/shadcn/ui as reference points), make the product dark-themed with clear severity color coding, and add visually live countdown timers on open decisions, so the next demo "inspire confiance et urgence."

**Decision:** Full rationale in [ADR-0014](docs/adr/0014-frontend-design-system.md). Summary: (1) Tailwind CSS v4 + hand-authored shadcn-style primitives (`src/components/ui/`: Button, Badge, Card, Tabs, Input, Label, Separator — CVA variants + Radix Tabs/Slot/Label), not the interactive shadcn CLI and not Tremor (better fit for a future charts dashboard, not this card/badge composition); (2) a single dark theme with no light/dark toggle — the product's identity, not a preference; (3) severity color coding (`CRITICAL` red / `HIGH` orange / `MEDIUM` amber / `LOW` blue) defined once in `src/lib/severity.ts` and applied consistently across the incident list, badges, and decision cards; (4) a live, ticking `CountdownTimer` on every open decision, computed client-side from `decision.createdAt + SLA_MINUTES[incident.severity]` against a fixed, disclosed table (CRITICAL 15m / HIGH 1h / MEDIUM 4h / LOW 24h, `src/lib/sla-policy.ts`) — deterministic and honest about being a new UI-only placeholder assumption, never a fabricated number, and critically: **never a stored field or backend change**, since `Decision` has no deadline column and adding one was explicitly out of scope; (5) a new "Decision Log" tab rendering the existing `GET /incidents/:id/timeline` feed via a new `DecisionLog` component — `packages/shared` gained one additive, type-only `TimelineEvent` interface for this, zero `apps/api` behavior change; (6) `/login` and `/simulation` were restyled too, for visual consistency with the redesigned Command Center.

**Rationale:** Same anti-fabrication discipline as every prior phase (Principle 3, ADR-0010/0011/0013) applied to a new problem: an urgency countdown needs *some* deadline, and inventing a random number would have been dishonest in the same way a fake confidence score would be. Deriving it from two real fields against an explicit, documented policy keeps the UI honest while still satisfying "don't touch the backend." The Command Center's own state logic (ADR-0009/ADR-0013's never-blank contract) was left untouched — only its rendering changed.

**Status:** Accepted. Implemented (Tailwind v4 config, 7 UI primitives, `SeverityBadge`, `CountdownTimer`, `DecisionLog`, `src/lib/{severity,sla-policy,utils}.ts`, full rewrites of `/`, `/login`, `/simulation`, `IncidentDecisionPanel`), tested (16 `apps/web` tests, up from 11 — new `CountdownTimer` tests covering calm/overdue/ticking states with fake timers, new `DecisionLog` tests, `IncidentDecisionPanel` tests extended with a `severity` prop and countdown assertions, `page.test.tsx` fixed for the new `useRouter()` call), and verified live: `apps/api` untouched and still green (175 tests, unchanged), `packages/shared`/`apps/web` lint clean, `next build` succeeds and statically renders all 4 routes, the built Tailwind CSS chunk contains every custom severity/countdown/dark-theme token (`border-l-critical`, `text-countdown-danger`, `animate-pulse-danger`, `bg-background`, etc.), the shipped client JS bundle contains all new UI copy ("Command Center", "Decision Log", "OVERDUE", "decisions required", `role="timer"`), and `docker compose up --build` serves all 4 routes (`/`, `/login`, `/simulation`, `/health`) at `200`. No visual screenshot was taken — this environment has no browser/screenshot tool — so the user should open `http://localhost:3000` themselves to confirm the actual look; every structural, build, and test signal available in this environment passes.

---

## 2026-07-20 — Decision Intelligence Engine frontend surface: a new Command Center tab, not a new architecture

**Context:** All six roadmap phases had a working `apps/api`, but `apps/web` only ever grew UI for the Command Center, login, and the `/simulation` facilitator panel (ADR-0014). Phase 4's Decision Intelligence Engine (ADR-0010) — `POST /incidents/:id/analyze`, `GET /incidents/:id/analyses` — was fully built and tested but unreachable from the product. The user asked to close that gap first, prioritized over Reporting/Integrations UI, and to use a self-paced `/loop` for the multi-surface build; commit granularity agreed with the user up front: one commit per surface.

**Decision:** Added a fourth Command Center tab, "Decision Intelligence," reusing every existing primitive/token from ADR-0014 rather than introducing a new pattern: `IntelligenceAnalysisPanel` (read-only history — all four confidence dimensions always rendered as separate bars via a new `ConfidenceMeter`, never merged into one score per ADR-0010; `missingInformation` always shown when non-empty per Principle 3) and `IntelligenceAnalysisForm` (submits the qualitative half of the AI Output Contract — situation summary, business impact, risks, recommended/alternative decisions, next actions — exactly the fields `SubmitIntelligenceAnalysisDto` accepts; the four confidence dimensions and `evidenceUsed` stay server-computed-only, never collectible here). Two new primitives (`Textarea`, a native-`<select>`-based `Select`) were added to `src/components/ui/` since the form needed them and none existed. `packages/shared` gained additive-only types (`IntelligenceAnalysis`, `Risk`, `BusinessImpact`, `DecisionOption`, `ConfidenceDimensions`) mirroring `AIOutputContractDto`/the Prisma model — no `apps/api` change.

**A real API inconsistency, surfaced and worked around, not silently duplicated:** `POST /incidents/:id/analyze` returns the confidence dimensions nested under `confidenceDimensions` (the `AIOutputContractDto` shape), but `GET /incidents/:id/analyses` returns the raw Prisma rows with the same four dimensions as flat top-level columns — the list endpoint was never updated to wrap them the way the POST response does. Rather than giving `packages/shared`'s `IntelligenceAnalysis` type two incompatible shapes (or silently picking one and letting the other endpoint's response not type-check), the shared type follows the flat, persisted (GET) shape — documented inline as the reason the two disagree — and `IntelligenceAnalysisForm` normalizes the POST response to match before handing it to the caller. This is a real backend inconsistency worth fixing (flattening the POST response, or nesting the GET response) but out of scope for a frontend-only task; noted below as an open item rather than fixed silently.

**Rationale:** Same principle as ADR-0014 — extend the existing design system rather than inventing a second one, and never fabricate what the backend doesn't provide. The alternative (a general-purpose JSON-schema-driven form generator for the whole AI Output Contract) was rejected as premature abstraction for a single form.

**Status:** Accepted. Implemented (`apps/web/src/components/{ConfidenceMeter,IntelligenceAnalysisPanel,IntelligenceAnalysisForm}.tsx`, `ui/{textarea,select}.tsx`, `app/page.tsx` gained the fourth tab and an `analyses` fetch), tested (6 new `apps/web` tests — confidence dimensions rendered as four independent values, `missingInformation` never hidden, and the POST-response normalization verified explicitly), and verified: `lint`, `build`, and `test` all pass across all three workspaces (175 `apps/api` + 22 `apps/web` + 1 `packages/shared` = 198 tests, all green).

**Open item:** the `POST /incidents/:id/analyze` vs. `GET /incidents/:id/analyses` response-shape inconsistency described above should be fixed in `apps/api` (flatten the POST response to match the persisted shape) the next time that module is touched — tracked in `memory/context.md`.

---
