import { IntegrationKey } from './integration-provider.interface';
import { IntegrationsRegistryService } from './integrations-registry.service';

describe('IntegrationsRegistryService', () => {
  let service: IntegrationsRegistryService;

  beforeEach(() => {
    service = new IntegrationsRegistryService();
  });

  it('registers one mock provider per Phase 6 integration key', () => {
    const providers = service.getAll();
    expect(providers).toHaveLength(Object.values(IntegrationKey).length);
    expect(providers.every((provider) => provider.isConfigured() === false)).toBe(true);
  });

  it('gets a specific provider by key', () => {
    expect(service.get(IntegrationKey.SLACK)?.displayName).toBe('Slack');
  });

  it('broadcasts an event to every provider without throwing', async () => {
    await expect(
      service.broadcast('incidentCreated', {
        tenantId: 't1',
        incidentId: 'i1',
        summary: 'test incident',
      }),
    ).resolves.toBeUndefined();
  });

  it('isolates a provider failure — one bad provider does not affect the broadcast', async () => {
    const providers = service.getAll();
    jest.spyOn(providers[0], 'notifyIncidentCreated').mockRejectedValue(new Error('boom'));

    await expect(
      service.broadcast('incidentCreated', {
        tenantId: 't1',
        incidentId: 'i1',
        summary: 'test incident',
      }),
    ).resolves.toBeUndefined();
  });
});
