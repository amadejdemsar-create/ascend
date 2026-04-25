/**
 * Capped exponential backoff retry helper.
 *
 * Only retries on RateLimitError (HTTP 429) and ProviderHttpError with
 * 5xx status codes. All other errors propagate immediately.
 * Honors AbortSignal to break out of the retry loop.
 */

import { RateLimitError, ProviderHttpError } from "./errors";

export interface RetryOptions {
  /** Maximum number of retries. Default 3. */
  maxRetries?: number;
  /** Base delay in milliseconds. Default 500. */
  baseMs?: number;
  /** AbortSignal to cancel the retry loop. */
  signal?: AbortSignal;
}

/**
 * Wait for the given number of milliseconds, aborting early if the
 * signal fires. Uses a platform-agnostic setTimeout approach.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * Determine whether the given error is retryable.
 * Only RateLimitError and ProviderHttpError with 5xx status qualify.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof ProviderHttpError && error.status >= 500 && error.status < 600) return true;
  return false;
}

/**
 * Execute `fn` with capped exponential backoff on retryable errors.
 *
 * Backoff formula: baseMs * 2^attempt, capped at 8000ms, plus 0 to 100ms
 * of jitter to decorrelate concurrent callers.
 *
 * If a RateLimitError carries a retryAfterMs hint, that value is used
 * instead of the computed backoff (but still capped at 8000ms).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 3;
  const baseMs = opts?.baseMs ?? 500;
  const signal = opts?.signal;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt or the error is not retryable, throw.
      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Compute backoff delay.
      let backoffMs = Math.min(baseMs * Math.pow(2, attempt), 8000);

      // If the rate limit error provides a retry-after hint, prefer it.
      if (error instanceof RateLimitError && error.retryAfterMs != null) {
        backoffMs = Math.min(error.retryAfterMs, 8000);
      }

      // Add jitter: 0 to 100ms.
      const jitter = Math.floor(Math.random() * 100);
      backoffMs += jitter;

      await delay(backoffMs, signal);
    }
  }

  // This point is unreachable because the loop always either returns or throws,
  // but TypeScript needs it for exhaustiveness.
  throw lastError;
}
