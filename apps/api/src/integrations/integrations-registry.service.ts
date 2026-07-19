import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationEventPayload,
  IntegrationKey,
  IntegrationProvider,
} from './integration-provider.interface';
import { MockIntegrationProvider } from './mock-integration.provider';

export type IntegrationEvent = 'incidentCreated' | 'decisionDecided';

/**
 * Holds every registered IntegrationProvider (see ADR-0008) and broadcasts
 * domain events to all of them. A single misbehaving provider is caught and
 * logged, never allowed to fail the caller's request (integration isolation
 * — see docs/architecture/ARCHITECTURE.md §5).
 */
@Injectable()
export class IntegrationsRegistryService {
  private readonly logger = new Logger(IntegrationsRegistryService.name);
  private readonly providers: IntegrationProvider[] = Object.values(IntegrationKey).map(
    (key) => new MockIntegrationProvider(key),
  );

  getAll(): IntegrationProvider[] {
    return this.providers;
  }

  get(key: IntegrationKey): IntegrationProvider | undefined {
    return this.providers.find((provider) => provider.key === key);
  }

  async broadcast(event: IntegrationEvent, payload: IntegrationEventPayload): Promise<void> {
    await Promise.all(
      this.providers.map(async (provider) => {
        try {
          if (event === 'incidentCreated') {
            await provider.notifyIncidentCreated(payload);
          } else {
            await provider.notifyDecisionDecided(payload);
          }
        } catch (error) {
          this.logger.warn(
            `Integration provider "${provider.displayName}" failed on "${event}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  }
}
