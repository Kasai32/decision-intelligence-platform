# Guides

## Local development setup

1. Install Node.js >= 20.
2. `npm install` at the repo root (installs all workspaces).
3. Copy environment templates: `cp apps/api/.env.example apps/api/.env` (fill in local values).
4. Start local infra: `docker compose -f infra/docker/docker-compose.yml up -d` (starts PostgreSQL).
5. Run the API: `npm run dev:api`.
6. Run the web app: `npm run dev:web`.

## Common tasks

| Task                  | Command                |
| --------------------- | ---------------------- |
| Lint everything       | `npm run lint`         |
| Fix lint issues       | `npm run lint:fix`     |
| Format everything     | `npm run format`       |
| Check formatting (CI) | `npm run format:check` |
| Run all tests         | `npm run test`         |
| Run apps/api e2e tests (real Postgres via testcontainers — needs Docker) | `npm run test:e2e --workspace apps/api` |
| Build all workspaces  | `npm run build`        |

## Adding a new workspace package

1. Create `apps/<name>` or `packages/<name>` with its own `package.json` (npm workspaces auto-detects it — no root config change needed).
2. Extend `tsconfig.base.json` from the new workspace's `tsconfig.json`.
3. Add lint/test/build scripts consistent with `CODING_STANDARDS.md`.
4. If it introduces a new architecturally significant choice, add an ADR (`docs/adr/`) and a `DECISION_LOG.md` entry.

More guides will be added as later phases introduce deployment, auth setup, and integration configuration steps.
