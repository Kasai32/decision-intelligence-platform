import { Logger } from '@nestjs/common';
import {
  IntegrationEventPayload,
  IntegrationKey,
  IntegrationProvider,
} from './integration-provider.interface';

const DISPLAY_NAMES: Record<IntegrationKey, string> = {
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
 * No-op stand-in for a real Phase 6 integration (see ADR-0008). Logs what it
 * would have done instead of calling out to a real, uncredentialed service.
 * `isConfigured()` always returns false so callers can tell "not wired up
 * yet" apart from "wired up but failing".
 */
export class MockIntegrationProvider implements IntegrationProvider {
  readonly displayName: string;
  private readonly logger: Logger;

  constructor(readonly key: IntegrationKey) {
    this.displayName = DISPLAY_NAMES[key];
    this.logger = new Logger(`MockIntegration:${this.displayName}`);
  }

  isConfigured(): boolean {
    return false;
  }

  async notifyIncidentCreated(payload: IntegrationEventPayload): Promise<void> {
    this.logger.debug(`[mock] would notify incident created: ${payload.summary}`);
  }

  async notifyDecisionDecided(payload: IntegrationEventPayload): Promise<void> {
    this.logger.debug(`[mock] would notify decision decided: ${payload.summary}`);
  }
}
