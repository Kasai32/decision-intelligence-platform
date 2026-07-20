import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Holds the current request's tenant-scoped Prisma transaction client (see
 * ADR-0015 — Postgres RLS defense-in-depth). `TenantAwarePrismaService`
 * (the actual `PrismaService` DI token every existing service already
 * injects) checks this on every property access: if a transaction is
 * active, model calls (`.incident`, `.decision`, etc.) transparently route
 * through it instead of the base client — no existing service code needed
 * to change.
 */
export const tenantRlsStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

/**
 * Opens one Postgres transaction, sets `app.tenant_id` for its duration
 * (via `set_config(..., true)` — the parameterized, `SET LOCAL`-equivalent
 * form; `SET LOCAL` itself doesn't accept bind parameters), and runs `fn`
 * with every `PrismaService` call inside it scoped to that transaction.
 * Used by `TenantRlsInterceptor` for JWT-authenticated routes, and
 * directly by `WebhookSignatureGuard`/`WebhooksController` for the one
 * route authenticated by HMAC instead (see ADR-0015).
 */
export async function runInTenantContext<T>(
  prisma: PrismaService,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return tenantRlsStorage.run(tx, fn);
  });
}
