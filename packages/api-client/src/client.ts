/**
 * Platform-agnostic HTTP client factory for Ascend.
 *
 * Uses the global `fetch` (available in Node >= 18, all modern browsers, and
 * React Native). No runtime dependencies beyond what the platform provides.
 *
 * Usage:
 *   const api = createApiClient({ baseUrl: "", getAuthHeaders: () => ({ Authorization: "Bearer ..." }) });
 *   const goals = await api.get<Goal[]>("/api/goals");
 *   const created = await api.post<Goal>("/api/goals", { title: "Ship v2" });
 */

import { ApiError } from "./errors";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ApiClientConfig {
  /** Base URL prepended to every path. Defaults to "" (same-origin on web). */
  baseUrl?: string;

  /**
   * Factory that returns auth headers for every request.
   * Called on every request so it can read rotating tokens, cookies, etc.
   * May be async (e.g., reading from SecureStore on mobile).
   */
  getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>;

  /**
   * Optional fetch override for testing or platform-specific fetch implementations
   * (e.g., React Native's built-in fetch with cert pinning).
   * Defaults to `globalThis.fetch`.
   */
  fetch?: typeof globalThis.fetch;
}

export interface ApiClient {
  /**
   * Low-level fetch with auth headers merged in. Returns parsed JSON typed as T.
   * Throws ApiError on non-2xx. Returns `undefined as T` on 204 No Content.
   */
  fetch<T = unknown>(path: string, options?: RequestInit): Promise<T>;

  /** GET shorthand. */
  get<T = unknown>(path: string, init?: RequestInit): Promise<T>;

  /** POST shorthand. Body is JSON-serialized if it is a plain object. */
  post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>;

  /** PUT shorthand. Body is JSON-serialized if it is a plain object. */
  put<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>;

  /** PATCH shorthand. Body is JSON-serialized if it is a plain object. */
  patch<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>;

  /** DELETE shorthand. */
  delete<T = unknown>(path: string, init?: RequestInit): Promise<T>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the value is a plain object that should be JSON-serialized.
 * Returns false for FormData, Blob, ArrayBuffer, URLSearchParams, ReadableStream,
 * and other BodyInit types that fetch handles natively.
 */
function isJsonSerializable(value: unknown): value is Record<string, unknown> {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  // Exclude known BodyInit types that fetch handles natively.
  // We check by constructor name to stay platform-agnostic (some of these
  // may not exist in all runtimes, but the typeof/constructor check is safe).
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return true; // Object.create(null) plain object
  const ctor = proto.constructor;
  if (ctor === Object) return true;
  if (ctor === Array) return true;
  // Everything else (FormData, Blob, ArrayBuffer, URLSearchParams,
  // ReadableStream, etc.) passes through unchanged.
  return false;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApiClient(config?: ApiClientConfig): ApiClient {
  const baseUrl = config?.baseUrl ?? "";
  const getAuthHeaders = config?.getAuthHeaders;
  const fetchFn = config?.fetch ?? globalThis.fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${baseUrl}${path}`;

    // --- Header merge order ---
    // 1. Start with caller-provided headers (lowest precedence).
    // 2. Layer on Content-Type: application/json default (only when the body
    //    is a JSON-serialized object; caller can override by passing a
    //    different Content-Type in init.headers, but that override is at
    //    layer 1 so it gets overwritten. For FormData uploads the caller
    //    should NOT set Content-Type and should pass FormData as body
    //    directly, which skips JSON serialization entirely).
    // 3. Auth headers always win (highest precedence) so callers cannot
    //    accidentally drop the Authorization header.
    const callerHeaders: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          callerHeaders[k] = v;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) {
          callerHeaders[k] = v;
        }
      } else {
        Object.assign(callerHeaders, init.headers);
      }
    }

    const merged: Record<string, string> = { ...callerHeaders };

    // Accept JSON by default; caller can override.
    if (!merged["Accept"] && !merged["accept"]) {
      merged["Accept"] = "application/json";
    }

    // Auth headers win over everything else.
    if (getAuthHeaders) {
      const auth = await getAuthHeaders();
      Object.assign(merged, auth);
    }

    const res = await fetchFn(url, {
      ...init,
      headers: merged,
    });

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = { message: await res.text().catch(() => res.statusText) };
      }
      throw new ApiError(res.status, body, res.statusText);
    }

    // 204 No Content: return undefined cast to T.
    if (res.status === 204) return undefined as unknown as T;

    return res.json() as Promise<T>;
  }

  /**
   * Prepare the RequestInit for methods that accept a body (POST, PUT, PATCH).
   * If the body is a plain object or array, JSON-serialize it and set
   * Content-Type. Otherwise, pass it through as-is (FormData, Blob, etc.).
   */
  function withBody(
    method: string,
    body: unknown,
    init?: RequestInit,
  ): RequestInit {
    if (body === undefined || body === null) {
      return { ...init, method };
    }

    if (isJsonSerializable(body)) {
      const callerHeaders: Record<string, string> = {};
      if (init?.headers) {
        if (typeof init.headers === "object" && !Array.isArray(init.headers) && !(init.headers instanceof Headers)) {
          Object.assign(callerHeaders, init.headers);
        }
      }
      return {
        ...init,
        method,
        headers: {
          "Content-Type": "application/json",
          ...callerHeaders,
        },
        body: JSON.stringify(body),
      };
    }

    // BodyInit passthrough (FormData, Blob, ArrayBuffer, etc.)
    return { ...init, method, body: body as BodyInit };
  }

  const client: ApiClient = {
    fetch: request,

    get<T>(path: string, init?: RequestInit): Promise<T> {
      return request<T>(path, { ...init, method: "GET" });
    },

    post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      return request<T>(path, withBody("POST", body, init));
    },

    put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      return request<T>(path, withBody("PUT", body, init));
    },

    patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
      return request<T>(path, withBody("PATCH", body, init));
    },

    delete<T>(path: string, init?: RequestInit): Promise<T> {
      return request<T>(path, { ...init, method: "DELETE" });
    },
  };

  return client;
}
