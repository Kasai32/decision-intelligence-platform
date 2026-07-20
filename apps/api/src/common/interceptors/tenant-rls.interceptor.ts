import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { from, lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { runInTenantContext } from '../../prisma/tenant-rls.context';

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
 */
@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
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
