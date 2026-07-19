import { IntegrationKey } from '@prisma/client';

export { IntegrationKey };

export interface IntegrationEventPayload {
  tenantId: string;
  incidentId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export type IntegrationMode = 'LIVE' | 'STUB_MODE' | 'DEGRADED';

/**
 * Result of one notify call (see ADR-0012). Never `void` — resilience
 * (caching a last-known-good result, reporting a clean degraded response)
 * requires the interface to actually carry a result.
 */
export interface IntegrationCallResult {
  delivered: boolean;
  mode: IntegrationMode;
  /** 0-100. Always 0 for STUB_MODE/DEGRADED — an honest "no real signal", not a fabricated number. */
  freshness: number;
  reliability: 'LIVE' | 'MOCK';
  message: string;
}

/**
 * Abstract contract every Phase 6 enterprise integration implements (see
 * ADR-0008, evolved in ADR-0012). Real implementations (ServiceNow, Jira,
 * Slack, ...) plug in behind `ConfigurableIntegrationProvider` /
 * `NetworkSimulator` without changing this interface or any caller of
 * `IntegrationsRegistryService`.
 */
export interface IntegrationProvider {
  readonly key: IntegrationKey;
  readonly displayName: string;

  /** Whether this provider has real (decrypted, tenant-configured) credentials. */
  isConfigured(): boolean;

  notifyIncidentCreated(payload: IntegrationEventPayload): Promise<IntegrationCallResult>;
  notifyDecisionDecided(payload: IntegrationEventPayload): Promise<IntegrationCallResult>;
}
