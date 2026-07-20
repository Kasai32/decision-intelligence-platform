import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { from, lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { runInTenantContext } from '../../prisma/tenant-rls.context';
import { SKIP_TENANT_RLS_KEY } from '../decorators/skip-tenant-rls.decorator';

/**
 * Establishes the Postgres RLS session variable (see ADR-0015) for every
 * JWT-authenticated request. Guards run before interceptors in Nest's
 * pipeline, so by the time this runs, `JwtAuthGuard` has already populated
 * `request.user` for any protected route — unauthenticated routes
 * (login/register/health) have no `request.user` and pass through
 * unwrapped, at no extra cost. The one route authenticated by HMAC instead
 * of a JWT (`POST /webhooks/:tenantId/:providerType`) establishes its own
 * tenant context directly in `WebhookSignatureGuard`/`WebhooksController`,
 * since its tenant identity is known before any guard/interceptor runs and
 * — unlike this interceptor — needs to be set even earlier, before the
 * signature-verifying guard's own DB lookup.
 *
 * `lastValueFrom(next.handle())` assumes the handler emits exactly one
 * value — true for every ordinary JSON endpoint. A route decorated with
 * `@SkipTenantRls()` (e.g. an SSE stream, see ADR-0020) is exempted for
 * exactly this reason: `lastValueFrom` would silently collapse a
 * multi-emission Observable down to only its final value, defeating
 * streaming entirely rather than erroring loudly — a skip that fails
 * safe-and-silent is worse than one that's explicit, so this only applies
 * to routes that opt in and take responsibility for their own DB scoping.
 */
@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_RLS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { tenantId?: string } }>();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return from(
      runInTenantContext(this.prisma, tenantId, () =>
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }
}
