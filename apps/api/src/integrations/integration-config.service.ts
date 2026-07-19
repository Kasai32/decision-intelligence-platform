import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationConfigStatus, IntegrationKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { IntegrationsRegistryService } from './integrations-registry.service';
import { DISPLAY_NAMES } from './configurable-integration.provider';

export interface IntegrationStatusSummary {
  providerType: IntegrationKey;
  displayName: string;
  configured: boolean;
  status: IntegrationConfigStatus | 'NOT_CONFIGURED';
  circuitState: string;
  updatedAt: Date | null;
}

/**
 * CRUD for per-tenant IntegrationConfig (see ADR-0012). Credentials are
 * encrypted on write and NEVER decrypted/returned by any method here —
 * only IntegrationsRegistryService (server-side call path) ever decrypts
 * them.
 */
@Injectable()
export class IntegrationConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsEncryption: CredentialsEncryptionService,
    private readonly registry: IntegrationsRegistryService,
  ) {}

  async configure(
    tenantId: string,
    providerType: IntegrationKey,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationStatusSummary> {
    const encryptedCredentials = this.credentialsEncryption.encrypt(JSON.stringify(credentials));
    const config = await this.prisma.integrationConfig.upsert({
      where: { tenantId_providerType: { tenantId, providerType } },
      create: {
        tenantId,
        providerType,
        encryptedCredentials,
        status: IntegrationConfigStatus.ACTIVE,
      },
      update: { encryptedCredentials, status: IntegrationConfigStatus.ACTIVE },
    });
    this.registry.invalidate(tenantId, providerType);
    return this.toSummary(tenantId, providerType, config.status, config.updatedAt);
  }

  async updateStatus(
    tenantId: string,
    providerType: IntegrationKey,
    status: IntegrationConfigStatus,
  ): Promise<IntegrationStatusSummary> {
    const existing = await this.prisma.integrationConfig.findUnique({
      where: { tenantId_providerType: { tenantId, providerType } },
    });
    if (!existing) {
      throw new NotFoundException(`No configuration exists for ${providerType} on this tenant`);
    }

    const config = await this.prisma.integrationConfig.update({
      where: { tenantId_providerType: { tenantId, providerType } },
      data: { status },
    });
    this.registry.invalidate(tenantId, providerType);
    return this.toSummary(tenantId, providerType, config.status, config.updatedAt);
  }

  async remove(tenantId: string, providerType: IntegrationKey): Promise<void> {
    await this.prisma.integrationConfig.deleteMany({ where: { tenantId, providerType } });
    this.registry.invalidate(tenantId, providerType);
  }

  async listAll(tenantId: string): Promise<IntegrationStatusSummary[]> {
    const configs = await this.prisma.integrationConfig.findMany({ where: { tenantId } });
    const configByType = new Map(configs.map((config) => [config.providerType, config]));

    return Promise.all(
      Object.values(IntegrationKey).map(async (providerType) => {
        const config = configByType.get(providerType);
        return this.toSummary(
          tenantId,
          providerType,
          config?.status ?? null,
          config?.updatedAt ?? null,
        );
      }),
    );
  }

  private async toSummary(
    tenantId: string,
    providerType: IntegrationKey,
    status: IntegrationConfigStatus | null,
    updatedAt: Date | null,
  ): Promise<IntegrationStatusSummary> {
    const provider = await this.registry.getProvider(tenantId, providerType);
    return {
      providerType,
      displayName: DISPLAY_NAMES[providerType],
      configured: provider.isConfigured(),
      status: status ?? 'NOT_CONFIGURED',
      circuitState: provider.getCircuitState(),
      updatedAt,
    };
  }
}
