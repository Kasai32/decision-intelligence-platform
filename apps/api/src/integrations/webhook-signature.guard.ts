import { createHmac, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { IntegrationConfigStatus, IntegrationKey } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { runInTenantContext } from '../prisma/tenant-rls.context';
import { CredentialsEncryptionService } from './credentials-encryption.service';

const SIGNATURE_HEADER = 'x-signature';

/**
 * Validates an inbound webhook's HMAC-SHA256 signature over the raw
 * request body (see ADR-0012, "Principe 8: Sécurité") — the security
 * boundary for this endpoint, since the caller is an external system with
 * no user session, not `JwtAuthGuard`. Uses `timingSafeEqual` to avoid a
 * timing side-channel. Any failure -> 401, and the payload is never parsed
 * or persisted.
 *
 * Establishes its own Postgres RLS tenant context (see ADR-0015) around
 * its `integrationConfig` lookup: this runs as a guard, before
 * `TenantRlsInterceptor` (which only fires for JWT-authenticated routes),
 * so it can't rely on that interceptor — its own tenant identity is
 * already known from the URL at this point, the same trust boundary
 * `IntegrationConfigService`'s already-authenticated management endpoints
 * use.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsEncryption: CredentialsEncryptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const params = request.params as Record<string, string>;
    const { tenantId, providerType } = params;

    if (!tenantId || !this.isValidProviderType(providerType)) {
      throw new UnauthorizedException('Unknown tenant or provider');
    }

    const signatureHeader = request.header(SIGNATURE_HEADER);
    if (!signatureHeader || !request.rawBody) {
      throw new UnauthorizedException('Missing signature or request body');
    }

    const webhookSecret = await this.getWebhookSecret(tenantId, providerType);
    if (!webhookSecret) {
      throw new UnauthorizedException('Integration not configured for webhooks on this tenant');
    }

    const expected = createHmac('sha256', webhookSecret).update(request.rawBody).digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(signatureHeader, 'hex');
    } catch {
      throw new UnauthorizedException('Malformed signature');
    }

    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }

  private isValidProviderType(value: string): value is IntegrationKey {
    return (Object.values(IntegrationKey) as string[]).includes(value);
  }

  private async getWebhookSecret(tenantId: string, providerType: string): Promise<string | null> {
    const config = await runInTenantContext(this.prisma, tenantId, () =>
      this.prisma.integrationConfig.findUnique({
        where: {
          tenantId_providerType: { tenantId, providerType: providerType as IntegrationKey },
        },
      }),
    );
    if (!config || config.status !== IntegrationConfigStatus.ACTIVE) {
      return null;
    }

    try {
      const credentials = JSON.parse(
        this.credentialsEncryption.decrypt(config.encryptedCredentials),
      ) as Record<string, unknown>;
      const secret = credentials.webhookSecret;
      return typeof secret === 'string' && secret.length > 0 ? secret : null;
    } catch {
      return null;
    }
  }
}
