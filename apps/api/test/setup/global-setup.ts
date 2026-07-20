import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Starts one real Postgres container for the whole e2e run (see
 * DECISION_LOG.md, critical-review remediation 3/5) — every e2e spec hits
 * this actual database through the actual HTTP stack (guards,
 * ValidationPipe, exception filter, real Prisma migrations), the gap the
 * 175 apps/api unit tests (all Prisma-mocked) can't close on their own.
 *
 * Runs once before any spec file, in the same process Jest forks workers
 * from — env vars set here are inherited by the (single, see
 * jest-e2e.json's maxWorkers: 1) worker process. The container reference is
 * stashed on `globalThis` so global-teardown.ts (a separate module,
 * executed in the same Jest-orchestrating process) can stop it.
 */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('dip_e2e')
    .withUsername('dip')
    .withPassword('dip')
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_ACCESS_SECRET = 'e2e-test-secret-do-not-use-in-real-envs';
  process.env.JWT_ACCESS_TTL_SECONDS = '900';
  process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = 'e2e-test-key-32-bytes-minimum!!';
  process.env.NODE_ENV = 'test';

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  (globalThis as { __POSTGRES_CONTAINER__?: unknown }).__POSTGRES_CONTAINER__ = container;
}
