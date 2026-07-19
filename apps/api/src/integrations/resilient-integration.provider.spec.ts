import { CircuitState } from '../common/resilience/circuit-breaker';
import { ConfigurableIntegrationProvider } from './configurable-integration.provider';
import { IntegrationKey } from './integration-provider.interface';
import { NetworkSimulator } from './network-simulator';
import { ResilientIntegrationProvider } from './resilient-integration.provider';

const payload = { tenantId: 't1', incidentId: 'i1', summary: 'test' };
const noopSleep = async () => undefined;

function makeResilientProvider(simulator: NetworkSimulator) {
  const inner = new ConfigurableIntegrationProvider(
    IntegrationKey.SERVICENOW,
    { apiKey: 'fixture' },
    simulator,
  );
  return new ResilientIntegrationProvider(
    inner,
    { failureThreshold: 3, resetTimeoutMs: 1000 },
    { maxAttempts: 1, baseDelayMs: 1, factor: 2, sleep: noopSleep },
  );
}

describe('ResilientIntegrationProvider — adversarial: simulated ServiceNow outage', () => {
  it('passes through a healthy provider unchanged (LIVE, delivered)', async () => {
    const simulator: NetworkSimulator = { call: jest.fn().mockResolvedValue(undefined) };
    const provider = makeResilientProvider(simulator);

    const result = await provider.notifyIncidentCreated(payload);
    expect(result).toEqual(expect.objectContaining({ mode: 'LIVE', delivered: true }));
    expect(provider.getCircuitState()).toBe(CircuitState.CLOSED);
  });

  it('trips the circuit breaker OPEN after 3 consecutive simulated network failures', async () => {
    const simulator: NetworkSimulator = {
      call: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    const provider = makeResilientProvider(simulator);

    const first = await provider.notifyIncidentCreated(payload);
    const second = await provider.notifyIncidentCreated(payload);
    expect(first.mode).toBe('DEGRADED');
    expect(second.mode).toBe('DEGRADED');
    expect(provider.getCircuitState()).toBe(CircuitState.CLOSED); // still closed, only 2 failures so far

    const third = await provider.notifyIncidentCreated(payload);
    expect(third.mode).toBe('DEGRADED');
    expect(provider.getCircuitState()).toBe(CircuitState.OPEN); // 3rd consecutive failure trips it
  });

  it('once OPEN, stops calling the network entirely (fail-fast, no saturation)', async () => {
    const simulator: NetworkSimulator = {
      call: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    const provider = makeResilientProvider(simulator);

    await provider.notifyIncidentCreated(payload);
    await provider.notifyIncidentCreated(payload);
    await provider.notifyIncidentCreated(payload); // opens here
    expect(provider.getCircuitState()).toBe(CircuitState.OPEN);

    const callsBeforeExtraAttempts = (simulator.call as jest.Mock).mock.calls.length;
    await provider.notifyIncidentCreated(payload);
    await provider.notifyIncidentCreated(payload);
    expect((simulator.call as jest.Mock).mock.calls.length).toBe(callsBeforeExtraAttempts); // no new network calls
  });

  it('returns a clean zero-state degraded response when the circuit opens before any success ever happened', async () => {
    const simulator: NetworkSimulator = { call: jest.fn().mockRejectedValue(new Error('down')) };
    const provider = makeResilientProvider(simulator);

    await provider.notifyIncidentCreated(payload);
    await provider.notifyIncidentCreated(payload);
    const result = await provider.notifyIncidentCreated(payload);

    expect(result).toEqual(
      expect.objectContaining({
        delivered: false,
        mode: 'DEGRADED',
        freshness: 0,
        reliability: 'MOCK',
      }),
    );
  });

  it('once OPEN, returns the LAST SUCCESSFUL result (cached) instead of a zero-state response', async () => {
    const simulator: NetworkSimulator = { call: jest.fn() };
    const provider = makeResilientProvider(simulator);

    (simulator.call as jest.Mock).mockResolvedValueOnce(undefined); // one success first
    const success = await provider.notifyIncidentCreated(payload);
    expect(success.mode).toBe('LIVE');

    (simulator.call as jest.Mock).mockRejectedValue(new Error('now failing'));
    await provider.notifyIncidentCreated(payload);
    await provider.notifyIncidentCreated(payload);
    const degraded = await provider.notifyIncidentCreated(payload);

    expect(provider.getCircuitState()).toBe(CircuitState.OPEN);
    expect(degraded.mode).toBe('DEGRADED');
    expect(degraded.delivered).toBe(false);
    expect(degraded.message).toContain('last known-good state');
  });

  it('recovers: after the reset timeout, a successful probe closes the circuit again', async () => {
    let now = 0;
    const simulator: NetworkSimulator = { call: jest.fn() };
    const inner = new ConfigurableIntegrationProvider(
      IntegrationKey.SLACK,
      { apiKey: 'x' },
      simulator,
    );
    const provider = new ResilientIntegrationProvider(
      inner,
      { failureThreshold: 3, resetTimeoutMs: 1000, now: () => now },
      { maxAttempts: 1, baseDelayMs: 1, factor: 2, sleep: noopSleep },
    );

    (simulator.call as jest.Mock).mockRejectedValue(new Error('outage'));
    await provider.notifyIncidentCreated(payload);
    await provider.notifyIncidentCreated(payload);
    await provider.notifyIncidentCreated(payload);
    expect(provider.getCircuitState()).toBe(CircuitState.OPEN);

    now += 1000; // outage resolved, provider recovers, and enough time has passed
    (simulator.call as jest.Mock).mockResolvedValue(undefined);
    const recovered = await provider.notifyIncidentCreated(payload);

    expect(recovered.mode).toBe('LIVE');
    expect(provider.getCircuitState()).toBe(CircuitState.CLOSED);
  });
});
