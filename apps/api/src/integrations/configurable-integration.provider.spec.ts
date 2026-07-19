import { ConfigurableIntegrationProvider } from './configurable-integration.provider';
import { IntegrationKey } from './integration-provider.interface';
import { NetworkSimulator } from './network-simulator';

const payload = { tenantId: 't1', incidentId: 'i1', summary: 'test' };

describe('ConfigurableIntegrationProvider', () => {
  it('reports STUB_MODE with freshness 0 and reliability MOCK when no credentials are configured', async () => {
    const simulator: NetworkSimulator = { call: jest.fn() };
    const provider = new ConfigurableIntegrationProvider(IntegrationKey.SLACK, null, simulator);

    expect(provider.isConfigured()).toBe(false);
    const result = await provider.notifyIncidentCreated(payload);

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'STUB_MODE',
        freshness: 0,
        reliability: 'MOCK',
        delivered: true,
      }),
    );
    expect(simulator.call).not.toHaveBeenCalled();
  });

  it('delegates to the NetworkSimulator and reports LIVE when credentials are configured', async () => {
    const simulator: NetworkSimulator = { call: jest.fn().mockResolvedValue(undefined) };
    const provider = new ConfigurableIntegrationProvider(
      IntegrationKey.SERVICENOW,
      { apiKey: 'fixture' },
      simulator,
    );

    expect(provider.isConfigured()).toBe(true);
    const result = await provider.notifyDecisionDecided(payload);

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'LIVE',
        freshness: 100,
        reliability: 'LIVE',
        delivered: true,
      }),
    );
    expect(simulator.call).toHaveBeenCalledWith(
      IntegrationKey.SERVICENOW,
      { apiKey: 'fixture' },
      payload,
    );
  });

  it('propagates a NetworkSimulator failure (does not swallow it) so the caller can retry/circuit-break', async () => {
    const simulator: NetworkSimulator = {
      call: jest.fn().mockRejectedValue(new Error('network down')),
    };
    const provider = new ConfigurableIntegrationProvider(
      IntegrationKey.JIRA,
      { apiKey: 'fixture' },
      simulator,
    );

    await expect(provider.notifyIncidentCreated(payload)).rejects.toThrow('network down');
  });
});
