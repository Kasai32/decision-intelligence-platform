import {
  CircuitBreaker,
  CircuitBreakerOptions,
  CircuitOpenError,
  CircuitState,
} from '../common/resilience/circuit-breaker';
import { RetryOptions, withRetry } from '../common/resilience/retry';
import {
  IntegrationCallResult,
  IntegrationEventPayload,
  IntegrationKey,
  IntegrationProvider,
} from './integration-provider.interface';

/**
 * Wraps an IntegrationProvider with a circuit breaker + retry policy (see
 * ADR-0012). On CircuitOpenError or exhausted retries, returns the last
 * successful result re-labelled DEGRADED ("dernière version en cache"), or
 * a clean zero-state degraded response if nothing has ever succeeded.
 */
export class ResilientIntegrationProvider implements IntegrationProvider {
  readonly key: IntegrationKey;
  readonly displayName: string;
  private readonly circuitBreaker: CircuitBreaker;
  private lastSuccess: IntegrationCallResult | null = null;
  private lastSuccessAt: Date | null = null;

  constructor(
    private readonly inner: IntegrationProvider,
    circuitBreakerOptions: CircuitBreakerOptions,
    private readonly retryOptions: RetryOptions,
  ) {
    this.key = inner.key;
    this.displayName = inner.displayName;
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
  }

  isConfigured(): boolean {
    return this.inner.isConfigured();
  }

  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  notifyIncidentCreated(payload: IntegrationEventPayload): Promise<IntegrationCallResult> {
    return this.callResilient(() => this.inner.notifyIncidentCreated(payload));
  }

  notifyDecisionDecided(payload: IntegrationEventPayload): Promise<IntegrationCallResult> {
    return this.callResilient(() => this.inner.notifyDecisionDecided(payload));
  }

  private async callResilient(
    fn: () => Promise<IntegrationCallResult>,
  ): Promise<IntegrationCallResult> {
    try {
      const result = await this.circuitBreaker.execute(() => withRetry(fn, this.retryOptions));
      this.lastSuccess = result;
      this.lastSuccessAt = new Date();
      return result;
    } catch (error) {
      const circuitOpen = error instanceof CircuitOpenError;
      return this.degradedResult(circuitOpen);
    }
  }

  private degradedResult(circuitOpen: boolean): IntegrationCallResult {
    const reason = circuitOpen
      ? 'circuit open — skipping the network call entirely'
      : 'call failed after retries';

    if (this.lastSuccess && this.lastSuccessAt) {
      return {
        ...this.lastSuccess,
        delivered: false,
        mode: 'DEGRADED',
        message: `${this.displayName}: ${reason} — returning last known-good state from ${this.lastSuccessAt.toISOString()}.`,
      };
    }

    return {
      delivered: false,
      mode: 'DEGRADED',
      freshness: 0,
      reliability: 'MOCK',
      message: `${this.displayName}: ${reason} — no prior success cached, clean degraded response.`,
    };
  }
}
