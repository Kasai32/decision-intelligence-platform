# Decision Intelligence Platform

Enterprise decision intelligence and incident command platform. Tracks incidents and decisions, generates evidence-backed recommendations, and produces executive-level reporting, integrating with the tools enterprises already run.

Status: **Phase 3 — Executive Command Center / Incident & Decision domain model** complete (see [PREREQUIS.md](PREREQUIS.md) for the full roadmap). Phases 1 (Foundation), 2 (Authentication, RBAC, Tenant Management, API Gateway, Core Database), and 3 (Incident/Decision/Evidence/TimelineEvent/Action domain model, state transition guards, Executive Command Center UI) are done and verified end-to-end — see [DECISION_LOG.md](DECISION_LOG.md). No Decision Intelligence Engine, reporting, or real external integrations yet (Phases 4–6) — Phase 6's integrations exist only as mocked interfaces (ADR-0008).

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
cp apps/api/.env.example apps/api/.env
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
