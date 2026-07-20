import { tenantRlsStorage } from './tenant-rls.context';
import { PrismaService } from './prisma.service';

/**
 * Wraps the real `PrismaService` in a `Proxy` so every existing
 * `this.prisma.X` call across every service transparently routes through
 * the current request's RLS-scoped transaction (see `runInTenantContext`)
 * when one is active, falling through to the real client otherwise
 * (unauthenticated routes, app bootstrap, tests) — see ADR-0015.
 *
 * Forwarded values are explicitly bound to their real owner (`tx` or
 * `target`, never the proxy) so a method that internally does
 * `this.someOtherMethod()` — e.g. `PrismaService.onModuleInit` calling
 * `this.$connect()` — doesn't re-enter the proxy's `get` trap against the
 * wrong receiver.
 */
export function createTenantAwarePrismaProxy(real: PrismaService): PrismaService {
  return new Proxy(real, {
    get(target, prop, _receiver) {
      const tx = tenantRlsStorage.getStore();
      if (tx && prop in tx) {
        const value = (tx as unknown as Record<string | symbol, unknown>)[prop as string];
        return typeof value === 'function' ? value.bind(tx) : value;
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as PrismaService;
}
