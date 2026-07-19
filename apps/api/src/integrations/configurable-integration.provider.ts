import {
  IntegrationCallResult,
  IntegrationEventPayload,
  IntegrationKey,
  IntegrationProvider,
} from './integration-provider.interface';
import { NetworkSimulator } from './network-simulator';

export const DISPLAY_NAMES: Record<IntegrationKey, string> = {
  [IntegrationKey.SERVICENOW]: 'ServiceNow',
  [IntegrationKey.JIRA]: 'Jira',
  [IntegrationKey.SLACK]: 'Slack',
  [IntegrationKey.TEAMS]: 'Microsoft Teams',
  [IntegrationKey.AWS]: 'AWS',
  [IntegrationKey.AZURE]: 'Azure',
  [IntegrationKey.GCP]: 'Google Cloud',
  [IntegrationKey.SPLUNK]: 'Splunk',
  [IntegrationKey.DATADOG]: 'Datadog',
  [IntegrationKey.MICROSOFT_SENTINEL]: 'Microsoft Sentinel',
};

/**
 * A tenant-scoped provider that is either configured (real, decrypted
 * fixture credentials) or not (see ADR-0012). No credentials -> STUB_MODE
 * immediately, deterministic, `freshness: 0, reliability: 'MOCK'` exactly
 * as specified — never attempts a "call". Credentials present -> delegates
 * to the injected NetworkSimulator, whose failure (real or simulated) is
 * what the wrapping ResilientIntegrationProvider's circuit breaker reacts
 * to.
 */
export class ConfigurableIntegrationProvider implements IntegrationProvider {
  readonly displayName: string;

  constructor(
    readonly key: IntegrationKey,
    private readonly credentials: Record<string, unknown> | null,
    private readonly networkSimulator: NetworkSimulator,
  ) {
    this.displayName = DISPLAY_NAMES[key];
  }

  isConfigured(): boolean {
    return this.credentials !== null;
  }

  notifyIncidentCreated(payload: IntegrationEventPayload): Promise<IntegrationCallResult> {
    return this.call(payload);
  }

  notifyDecisionDecided(payload: IntegrationEventPayload): Promise<IntegrationCallResult> {
    return this.call(payload);
  }

  private async call(payload: IntegrationEventPayload): Promise<IntegrationCallResult> {
    if (!this.credentials) {
      return {
        delivered: true,
        mode: 'STUB_MODE',
        freshness: 0,
        reliability: 'MOCK',
        message: `${this.displayName}: no credentials configured for this tenant — STUB_MODE (simulated).`,
      };
    }

    await this.networkSimulator.call(this.key, this.credentials, payload);

    return {
      delivered: true,
      mode: 'LIVE',
      freshness: 100,
      reliability: 'LIVE',
      message: `${this.displayName}: delivered.`,
    };
  }
}
