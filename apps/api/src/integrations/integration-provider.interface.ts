export enum IntegrationKey {
  SERVICENOW = 'SERVICENOW',
  JIRA = 'JIRA',
  SLACK = 'SLACK',
  TEAMS = 'TEAMS',
  AWS = 'AWS',
  AZURE = 'AZURE',
  GCP = 'GCP',
  SPLUNK = 'SPLUNK',
  DATADOG = 'DATADOG',
  MICROSOFT_SENTINEL = 'MICROSOFT_SENTINEL',
}

export interface IntegrationEventPayload {
  tenantId: string;
  incidentId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Abstract contract every Phase 6 enterprise integration implements
 * (see ADR-0008). Phase 3 ships only `MockIntegrationProvider` instances —
 * real implementations (ServiceNow, Jira, Slack, ...) land in Phase 6
 * without changing any caller of `IntegrationsRegistryService`.
 */
export interface IntegrationProvider {
  readonly key: IntegrationKey;
  readonly displayName: string;

  /** Whether this provider has real credentials configured. Mocks always report false. */
  isConfigured(): boolean;

  notifyIncidentCreated(payload: IntegrationEventPayload): Promise<void>;
  notifyDecisionDecided(payload: IntegrationEventPayload): Promise<void>;
}
