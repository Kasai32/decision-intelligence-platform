import { FixtureNetworkSimulator, NetworkSimulationError } from './network-simulator';
import { IntegrationKey } from './integration-provider.interface';

const payload = { tenantId: 't1', incidentId: 'i1', summary: 'test' };

describe('FixtureNetworkSimulator', () => {
  it('succeeds by default (no real endpoint to call yet)', async () => {
    const simulator = new FixtureNetworkSimulator();
    await expect(
      simulator.call(IntegrationKey.SLACK, { apiKey: 'fixture' }, payload),
    ).resolves.toBeUndefined();
  });

  it('throws NetworkSimulationError when credentials.simulateFailure is true', async () => {
    const simulator = new FixtureNetworkSimulator();
    await expect(
      simulator.call(IntegrationKey.SLACK, { simulateFailure: true }, payload),
    ).rejects.toBeInstanceOf(NetworkSimulationError);
  });

  it('does not treat a truthy-but-not-strictly-true value as a failure trigger', async () => {
    const simulator = new FixtureNetworkSimulator();
    await expect(
      simulator.call(IntegrationKey.SLACK, { simulateFailure: 'yes' }, payload),
    ).resolves.toBeUndefined();
  });
});
