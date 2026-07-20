import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

/**
 * Connects as `APP_DATABASE_URL` (the `dip_app` least-privilege role, see
 * ADR-0015 / the `app_role_least_privilege` migration), not `DATABASE_URL`
 * (the migration-running, superuser role Postgres RLS always bypasses).
 * Falls back to `DATABASE_URL` with a loud warning if unset, rather than
 * silently running with RLS protection disabled — never hidden by
 * omission, same principle as every other honesty-over-convenience
 * decision in this codebase (see ADR-0010/0011/0014).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly usingFallbackDatabaseUrl: boolean;

  constructor(private readonly logger: PinoLogger) {
    const appDatabaseUrl = process.env.APP_DATABASE_URL;
    super(appDatabaseUrl ? { datasources: { db: { url: appDatabaseUrl } } } : undefined);
    this.logger.setContext(PrismaService.name);
    this.usingFallbackDatabaseUrl = !appDatabaseUrl;
  }

  async onModuleInit(): Promise<void> {
    if (this.usingFallbackDatabaseUrl) {
      this.logger.warn(
        'APP_DATABASE_URL is not set — falling back to DATABASE_URL, the migration-running role. ' +
          'Postgres RLS (see ADR-0015) is a silent no-op on this connection: that role is a superuser, ' +
          'and superusers always bypass row-level security regardless of FORCE ROW LEVEL SECURITY. ' +
          'Set APP_DATABASE_URL to the dip_app role for RLS to actually protect anything.',
      );
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
