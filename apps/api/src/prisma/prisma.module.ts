import { Global, Module } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from './prisma.service';
import { createTenantAwarePrismaProxy } from './tenant-aware-prisma.factory';

/**
 * Provides the tenant-RLS-aware Proxy (see ADR-0015) as the `PrismaService`
 * DI token, so every existing `constructor(private readonly prisma:
 * PrismaService)` across the app gets it with zero code changes. Built via
 * `useFactory` (not `useClass`) so there's exactly one instance for Nest's
 * lifecycle hooks (`onModuleInit`/`onModuleDestroy`) to call — calling them
 * on the returned Proxy correctly forwards to the real, wrapped instance.
 * `PinoLogger` is resolved through `inject` (not a plain `new PrismaService()`
 * with no arguments) since `PrismaService`'s constructor needs it to log the
 * `APP_DATABASE_URL` fallback warning.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: (logger: PinoLogger) => createTenantAwarePrismaProxy(new PrismaService(logger)),
      inject: [PinoLogger],
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
