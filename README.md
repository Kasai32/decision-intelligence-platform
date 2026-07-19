# Decision Intelligence Platform

Enterprise decision intelligence and incident command platform. Tracks incidents and decisions, generates evidence-backed recommendations, and produces executive-level reporting, integrating with the tools enterprises already run.

Status: **Phase 1 — Foundation** (see [PREREQUIS.md](PREREQUIS.md) for the full roadmap). No business features exist yet — this phase is the scaffolding: repo structure, standards, architecture, CI/CD, Docker, linting, testing, formatting, and security scanning.

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
docker compose -f infra/docker/docker-compose.yml up -d   # starts PostgreSQL
npm run dev:api    # http://localhost:3001/health
npm run dev:web    # http://localhost:3000
```

## Common commands

| Command          | What it does                        |
| ---------------- | ----------------------------------- |
| `npm run lint`   | Lint all workspaces                 |
| `npm run format` | Format all workspaces with Prettier |
| `npm run test`   | Run all tests                       |
| `npm run build`  | Build all workspaces                |

See [docs/guides/README.md](docs/guides/README.md) for more.
