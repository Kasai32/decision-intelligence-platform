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
