import { IntegrationEventPayload, IntegrationKey } from './integration-provider.interface';

export const NETWORK_SIMULATOR = Symbol('NETWORK_SIMULATOR');

/**
 * The one seam where a "real" call to an external system would happen (see
 * ADR-0012). This Phase 6 MVP has no real credentials/endpoints for any of
 * the ten systems. Tests inject their own failing/flaky implementation to
 * exercise the resilience engine in isolation; production uses
 * `FixtureNetworkSimulator` (below), which honors a `simulateFailure` flag
 * inside a tenant's (fixture) credentials so the circuit breaker can also
 * be demonstrated live over the real HTTP API — not just in unit tests —
 * without any real endpoint to actually break.
 */
export interface NetworkSimulator {
  call(
    key: IntegrationKey,
    credentials: Record<string, unknown>,
    payload: IntegrationEventPayload,
  ): Promise<void>;
}

export class NetworkSimulationError extends Error {
  constructor(key: IntegrationKey) {
    super(`Simulated network failure calling ${key} (credentials.simulateFailure = true).`);
    this.name = 'NetworkSimulationError';
  }
}

/**
 * Succeeds unless the tenant's stored (fixture) credentials explicitly set
 * `simulateFailure: true` — a documented, deliberate testing hook, not a
 * hidden backdoor: it only ever reacts to a value the tenant itself put in
 * their own encrypted credentials via `POST /integrations/:type/config`.
 */
export class FixtureNetworkSimulator implements NetworkSimulator {
  async call(
    key: IntegrationKey,
    credentials: Record<string, unknown>,
    _payload: IntegrationEventPayload,
  ): Promise<void> {
    if (credentials.simulateFailure === true) {
      throw new NetworkSimulationError(key);
    }
    // No-op otherwise: nothing real to call yet (see ADR-0012 / memory/context.md).
  }
}
