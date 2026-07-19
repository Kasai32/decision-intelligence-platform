export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  factor: number;
  /** Injectable delay function — defaults to a real setTimeout-based wait. Tests inject a no-op. */
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retries `fn` with exponential backoff (see ADR-0012):
 * delay = baseDelayMs * factor^(attempt-1), for up to maxAttempts total tries.
 * Throws the last error once all attempts are exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < options.maxAttempts) {
        const delayMs = options.baseDelayMs * options.factor ** (attempt - 1);
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}
