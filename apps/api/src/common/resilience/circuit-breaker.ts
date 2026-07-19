export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit breaker is open');
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens (see ADR-0012). */
  failureThreshold: number;
  /** How long the circuit stays OPEN before a single HALF_OPEN probe is allowed, in ms. */
  resetTimeoutMs: number;
  /** Injectable clock for deterministic tests — defaults to Date.now. */
  now?: () => number;
}

/**
 * Generic, integration-agnostic circuit breaker (see ADR-0012). CLOSED ->
 * OPEN after `failureThreshold` consecutive failed `execute()` calls; OPEN
 * calls fail fast with `CircuitOpenError` (the wrapped function is never
 * invoked) until `resetTimeoutMs` elapses, then exactly one HALF_OPEN probe
 * is allowed through — success closes the circuit, failure reopens it and
 * restarts the cooldown.
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN && this.canAttemptReset()) {
      return CircuitState.HALF_OPEN;
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    if (currentState === CircuitState.OPEN) {
      throw new CircuitOpenError();
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = CircuitState.CLOSED;
    this.openedAt = null;
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.openedAt = this.now();
    }
  }

  private canAttemptReset(): boolean {
    return this.openedAt !== null && this.now() - this.openedAt >= this.options.resetTimeoutMs;
  }
}
