import { CircuitBreaker, CircuitOpenError, CircuitState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('starts CLOSED', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('stays CLOSED through fewer than the threshold of consecutive failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const failing = () => Promise.reject(new Error('boom'));

    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('opens after exactly `failureThreshold` consecutive failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const failing = () => Promise.reject(new Error('boom'));

    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    await expect(breaker.execute(failing)).rejects.toThrow('boom');

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('fails fast with CircuitOpenError once OPEN, never calling the wrapped function', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
    const fn = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(breaker.execute(fn)).rejects.toThrow('boom');
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn).toHaveBeenCalledTimes(1); // not called again while OPEN
  });

  it('a success resets the consecutive-failure count and closes the circuit', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const failing = () => Promise.reject(new Error('boom'));
    const succeeding = () => Promise.resolve('ok');

    await expect(breaker.execute(failing)).rejects.toThrow();
    await expect(breaker.execute(failing)).rejects.toThrow();
    await expect(breaker.execute(succeeding)).resolves.toBe('ok');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Two more failures should NOT open it (counter was reset by the success above)
    await expect(breaker.execute(failing)).rejects.toThrow();
    await expect(breaker.execute(failing)).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('transitions to HALF_OPEN after resetTimeoutMs, and a successful probe closes it', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      now: () => now,
    });

    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    now += 999;
    expect(breaker.getState()).toBe(CircuitState.OPEN); // not yet

    now += 1;
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    await expect(breaker.execute(() => Promise.resolve('recovered'))).resolves.toBe('recovered');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('a failed HALF_OPEN probe reopens the circuit and restarts the cooldown', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      now: () => now,
    });

    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow();
    now = 1000; // eligible for HALF_OPEN probe
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    await expect(breaker.execute(() => Promise.reject(new Error('still down')))).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Cooldown restarted from the failed-probe time (now=1000), not the original open time.
    now = 1500;
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    now = 2000;
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });
});
