/**
 * Shared HTTP client for the Ascend frontend.
 *
 * Replaces the per-hook fetchJson + headers + API_KEY duplication that
 * had spread across 5 hooks and ~10 components. Centralizing here gives:
 *   - one place to change auth (e.g., when migrating away from NEXT_PUBLIC_API_KEY)
 *   - one place to add retry, telemetry, AbortSignal support, etc.
 *   - consistent 204 No Content handling (the use-context drift)
 *   - one error envelope shape that throws Error with the server message.
 *
 * NOTE on NEXT_PUBLIC_API_KEY: this token ships in the client bundle
 * and is visible to anyone with devtools. The single-user design makes
 * this an acceptable choice today; multi-user would need a server-side
 * session model.
 */

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

/**
 * Headers used for every authenticated request from the browser.
 * Exported because a few fire-and-forget call sites use bare fetch
 * with the same headers (e.g., the dashboard recurring trigger).
 */
export const apiHeaders: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

/**
 * Fetch JSON from an Ascend API route with the bearer token attached.
 * Returns undefined for 204 No Content responses (cast to T at the
 * call site if the consumer expects void). Throws Error with the
 * server's `error` field on non-2xx, falling back to statusText.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  // Offline guard for write methods. Blocking POST/PUT/PATCH/DELETE when
  // navigator.onLine === false prevents a mutation from dying silently
  // mid-flight with an opaque TypeError. GETs fall through so the service
  // worker (or browser HTTP cache) can still serve cached reads.
  if (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.onLine === false &&
    init?.method &&
    init.method.toUpperCase() !== "GET"
  ) {
    throw new Error(
      "You are offline. Changes will not save until your connection resumes.",
    );
  }
  const res = await fetch(url, { ...init, headers: { ...apiHeaders, ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  // 204 No Content: return undefined cast to T so callers expecting
  // void won't crash on res.json().
  if (res.status === 204) return undefined as T;
  return res.json();
}
