# Decision Intelligence Platform

Enterprise decision intelligence and incident command platform. Tracks incidents and decisions, generates evidence-backed recommendations, and produces executive-level reporting, integrating with the tools enterprises already run.

Status: **All 6 roadmap phases have a working MVP** (see [PREREQUIS.md](PREREQUIS.md) for the full roadmap). Foundation, Auth/RBAC/Tenant Management, the Incident/Decision domain model with its guards and Executive Command Center, the multidimensional Decision Intelligence confidence model, Reporting (Executive Briefs/Decision Reports/Lessons Learned/Knowledge Base), and Phase 6's integration resilience engine (circuit breaker + retry, per-tenant AES-256-GCM-encrypted config, HMAC-validated webhooks) are all done and verified end-to-end — see [DECISION_LOG.md](DECISION_LOG.md). No real integration credentials or LLM provider are wired up (none exist in this environment — see `memory/context.md`); everything real-world-facing is built against a documented, swappable seam.

**Post-roadmap:** an ADMIN-only `SimulationScenarioService` (`POST /simulation/trigger`, `apps/web`'s `/simulation` panel) instantly stands up two disposable, tenant-isolated test scenarios for user-validation sessions — see [ADR-0013](docs/adr/0013-simulation-scenario-architecture.md). `apps/web` was also rebuilt as a dark, Tailwind v4 + shadcn-style command-center dashboard — severity-color-coded incident list, a live SLA countdown on every open decision, and a new Decision Log tab — see [ADR-0014](docs/adr/0014-frontend-design-system.md).

## Repository map

```
apps/api        NestJS backend
apps/web        Next.js frontend
packages/shared Shared TypeScript types/constants
docs/           Architecture, ADRs, guides, API reference
memory/         Project institutional memory (glossary, standing context)
infra/docker/   Dockerfiles + docker-compose for local dev
.github/        CI/CD, CodeQL, Dependabot
```

Full docs index: [docs/README.md](docs/README.md).

## Key documents

| Doc                                                                    | What it's for                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| [PREREQUIS.md](PREREQUIS.md)                                           | Product roadmap (all phases)                       |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | System architecture and stack                      |
| [CODING_STANDARDS.md](CODING_STANDARDS.md)                             | Conventions all code follows                       |
| [docs/adr/README.md](docs/adr/README.md)                               | Architecture Decision Records                      |
| [DECISION_LOG.md](DECISION_LOG.md)                                     | Chronological log of every technical decision made |
| [memory/README.md](memory/README.md)                                   | Standing project context and glossary              |

## Getting started

Requires Node.js >= 20 and Docker.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # set real JWT_ACCESS_SECRET / INTEGRATION_CREDENTIALS_ENCRYPTION_KEY for non-local use
docker compose -f infra/docker/docker-compose.yml up -d postgres   # starts PostgreSQL only
npm run prisma:migrate:dev --workspace apps/api                    # applies migrations locally
npm run dev:api    # http://localhost:3001/health, Swagger at /api/v1/docs
npm run dev:web    # http://localhost:3000
```

Or run the entire stack (Postgres + api + web, migrations applied automatically on container start) in Docker: `docker compose -f infra/docker/docker-compose.yml up -d`.

Full API reference: [docs/api/README.md](docs/api/README.md).

## Common commands

| Command          | What it does                        |
| ---------------- | ----------------------------------- |
| `npm run lint`   | Lint all workspaces                 |
| `npm run format` | Format all workspaces with Prettier |
| `npm run test`   | Run all tests                       |
| `npm run build`  | Build all workspaces                |

See [docs/guides/README.md](docs/guides/README.md) for more.
