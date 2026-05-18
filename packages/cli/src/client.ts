/**
 * HTTP client factory for the Ascend CLI.
 *
 * Thin adapter over `@ascend/api-client`'s `createApiClient`. The
 * adapter:
 *   - injects the Bearer header from the resolved API key
 *   - translates `ApiError` (raised by api-client on non-2xx) into the
 *     CLI's `ApiCallError` so the dispatcher gets a single error type
 *     to handle
 *   - translates network failures into `NetworkError`
 *
 * Every command runs through this client so we have one place to
 * normalize errors, logging, and retries.
 */

import { ApiError, createApiClient, type ApiClient } from "@ascend/api-client";
import { ApiCallError, NetworkError } from "./errors.js";
import type { ResolvedAuth } from "./auth.js";

/**
 * Build an ApiClient bound to the resolved auth. Wraps every method in
 * an error-normalizing layer so commands never see `ApiError` or raw
 * `TypeError: fetch failed` — only `CliError` subclasses.
 */
export function makeClient(auth: ResolvedAuth): ApiClient {
  const inner = createApiClient({
    baseUrl: auth.baseUrl,
    getAuthHeaders: () => ({
      Authorization: `Bearer ${auth.apiKey}`,
    }),
  });

  function wrap<T>(path: string, fn: () => Promise<T>): Promise<T> {
    return fn().catch((err: unknown) => {
      if (err instanceof ApiError) {
        const body = err.body as
          | { error?: string; message?: string }
          | undefined;
        const msg = body?.error ?? body?.message ?? err.statusText ?? "request failed";
        throw new ApiCallError({
          status: err.status,
          path,
          message: msg,
          body: err.body,
        });
      }
      if (
        err instanceof TypeError &&
        /fetch failed|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(err.message)
      ) {
        throw new NetworkError(err.message, err);
      }
      throw err;
    });
  }

  const wrapped: ApiClient = {
    fetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
      return wrap(path, () => inner.fetch<T>(path, init));
    },
    get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
      return wrap(path, () => inner.get<T>(path, init));
    },
    post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      return wrap(path, () => inner.post<T>(path, body, init));
    },
    put<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      return wrap(path, () => inner.put<T>(path, body, init));
    },
    patch<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      return wrap(path, () => inner.patch<T>(path, body, init));
    },
    delete<T = unknown>(path: string, init?: RequestInit): Promise<T> {
      return wrap(path, () => inner.delete<T>(path, init));
    },
  };
  return wrapped;
}
