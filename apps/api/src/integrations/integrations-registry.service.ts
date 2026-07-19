import { Inject, Injectable, Logger } from '@nestjs/common';
import { IntegrationConfigStatus, Prisma, TimelineEventType } from '@prisma/client';
import { CircuitBreakerOptions, CircuitState } from '../common/resilience/circuit-breaker';
import { RetryOptions } from '../common/resilience/retry';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigurableIntegrationProvider } from './configurable-integration.provider';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import {
  IntegrationCallResult,
  IntegrationEventPayload,
  IntegrationKey,
} from './integration-provider.interface';
import { NETWORK_SIMULATOR, NetworkSimulator } from './network-simulator';
import { ResilientIntegrationProvider } from './resilient-integration.provider';

export type IntegrationEvent = 'incidentCreated' | 'decisionDecided';

const CIRCUIT_BREAKER_DEFAULTS: CircuitBreakerOptions = {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
};
const RETRY_DEFAULTS: RetryOptions = { maxAttempts: 3, baseDelayMs: 100, factor: 2 };

/**
 * Tenant-aware, DB-backed registry (see ADR-0012 — evolved from the
 * global, tenant-unaware mocks of ADR-0008). Lazily builds and caches one
 * ResilientIntegrationProvider per (tenantId, providerKey) so circuit-
 * breaker state actually persists across the many broadcast() calls made
 * over an incident's lifetime.
 */
@Injectable()
export class IntegrationsRegistryService {
  private readonly logger = new Logger(IntegrationsRegistryService.name);
  private readonly providerCache = new Map<string, ResilientIntegrationProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsEncryption: CredentialsEncryptionService,
    @Inject(NETWORK_SIMULATOR) private readonly networkSimulator: NetworkSimulator,
  ) {}

  async getProvider(tenantId: string, key: IntegrationKey): Promise<ResilientIntegrationProvider> {
    const cacheKey = `${tenantId}:${key}`;
    const cached = this.providerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const credentials = await this.loadCredentials(tenantId, key);
    const inner = new ConfigurableIntegrationProvider(key, credentials, this.networkSimulator);
    const resilient = new ResilientIntegrationProvider(
      inner,
      CIRCUIT_BREAKER_DEFAULTS,
      RETRY_DEFAULTS,
    );
    this.providerCache.set(cacheKey, resilient);
    return resilient;
  }

  async getAllProviders(tenantId: string): Promise<ResilientIntegrationProvider[]> {
    return Promise.all(Object.values(IntegrationKey).map((key) => this.getProvider(tenantId, key)));
  }

  /** Drop a cached provider (e.g. after its IntegrationConfig changes) so the next call re-reads it. */
  invalidate(tenantId: string, key: IntegrationKey): void {
    this.providerCache.delete(`${tenantId}:${key}`);
  }

  async broadcast(event: IntegrationEvent, payload: IntegrationEventPayload): Promise<void> {
    const providers = await this.getAllProviders(payload.tenantId);

    await Promise.all(
      providers.map(async (provider) => {
        const stateBefore = provider.getCircuitState();
        let result: IntegrationCallResult;
        try {
          result =
            event === 'incidentCreated'
              ? await provider.notifyIncidentCreated(payload)
              : await provider.notifyDecisionDecided(payload);
        } catch (error) {
          // ResilientIntegrationProvider is designed to never throw (it always
          // degrades gracefully); this catch is defense-in-depth so one
          // misbehaving provider can never fail the caller's request — see
          // "integration isolation", docs/architecture/ARCHITECTURE.md §5.
          this.logger.warn(
            `Integration provider "${provider.displayName}" threw unexpectedly on "${event}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return;
        }

        const stateAfter = provider.getCircuitState();
        if (stateBefore !== CircuitState.OPEN && stateAfter === CircuitState.OPEN) {
          await this.recordBlockedEvent(payload, provider, result);
        }
      }),
    );
  }

  private async loadCredentials(
    tenantId: string,
    key: IntegrationKey,
  ): Promise<Record<string, unknown> | null> {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { tenantId_providerType: { tenantId, providerType: key } },
    });
    if (!config || config.status !== IntegrationConfigStatus.ACTIVE) {
      return null;
    }

    try {
      const decrypted = this.credentialsEncryption.decrypt(config.encryptedCredentials);
      return JSON.parse(decrypted) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt credentials for tenant ${tenantId} / ${key}: ${
          error instanceof Error ? error.message : String(error)
        } — falling back to STUB_MODE.`,
      );
      return null;
    }
  }

  private async recordBlockedEvent(
    payload: IntegrationEventPayload,
    provider: ResilientIntegrationProvider,
    result: IntegrationCallResult,
  ): Promise<void> {
    await this.prisma.timelineEvent.create({
      data: {
        tenantId: payload.tenantId,
        incidentId: payload.incidentId,
        type: TimelineEventType.INTEGRATION_BLOCKED,
        description: `Integration "${provider.displayName}" circuit breaker OPEN — calls are now degraded/blocked.`,
        metadata: { providerKey: provider.key, result } as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
