import { withRetry } from './retry';

describe('withRetry', () => {
  const noopSleep = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    noopSleep.mockClear();
  });

  it('returns the result immediately on first-attempt success, no sleep', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      factor: 2,
      sleep: noopSleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(noopSleep).not.toHaveBeenCalled();
  });

  it('retries after a failure and succeeds on a later attempt', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce('ok');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      factor: 2,
      sleep: noopSleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('applies exponential backoff delays between attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, factor: 2, sleep: noopSleep }),
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(3);
    expect(noopSleep).toHaveBeenCalledTimes(2); // between attempts 1->2 and 2->3, not after the last
    expect(noopSleep).toHaveBeenNthCalledWith(1, 100);
    expect(noopSleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('throws the last error once all attempts are exhausted', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValueOnce(new Error('third and final'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, factor: 2, sleep: noopSleep }),
    ).rejects.toThrow('third and final');
  });

  it('uses the real setTimeout-based sleep by default (not mocked)', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('ok');
    const start = Date.now();
    const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 5, factor: 2 });
    expect(result).toBe('ok');
    expect(Date.now() - start).toBeGreaterThanOrEqual(4); // roughly >= baseDelayMs, allowing timer slack
  });
});
