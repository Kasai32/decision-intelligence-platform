import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as { __POSTGRES_CONTAINER__?: StartedPostgreSqlContainer })
    .__POSTGRES_CONTAINER__;
  await container?.stop();
}
