/**
 * Configured API client instance for the Ascend web app.
 *
 * Wraps `@ascend/api-client` (the platform-agnostic HTTP client package) with
 * web-specific configuration: same-origin base URL and cookie-based auth.
 *
 * Browser requests authenticate via httpOnly cookies (access_token +
 * refresh_token), set by the /api/auth/* routes. The NEXT_PUBLIC_API_KEY
 * environment variable is no longer injected as an Authorization header for
 * in-browser requests; cookies handle that. MCP clients still use the API key
 * via the Authorization header directly against the server.
 *
 * Every hook and component that needs to call an Ascend API route should import
 * `apiFetch` (or `api`) from this module. Direct `fetch()` with manual headers
 * is banned in `apps/web/lib/hooks/`.
 */

import { createApiClient, ApiError } from "@ascend/api-client";

// Re-export the package types so consumers in apps/web can narrow errors.
export { ApiError } from "@ascend/api-client";
export type { ApiClient, ApiClientConfig } from "@ascend/api-client";

/**
 * Shared configured API client instance.
 *
 * Provides `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()` convenience
 * methods plus the lower-level `.fetch()` for edge cases.
 *
 * Auth is handled by cookies (`credentials: "include"` on every request),
 * so no Authorization header is injected here.
 */
export const api = createApiClient({
  baseUrl: "",
  // No getAuthHeaders: browser auth is cookie-based. The @ascend/api-client
  // package sends requests without Authorization; the browser attaches cookies
  // via credentials: "include" (set by apiFetch below and by bare-fetch callers).
});

/**
 * Headers used for bare-fetch call sites that need Content-Type but not auth.
 *
 * Auth is now handled by cookies, so this only includes Content-Type.
 * Callers that previously relied on apiHeaders for Authorization should
 * switch to `apiFetch` or `api.post(...)` with `credentials: "include"`.
 */
export const apiHeaders: HeadersInit = {
  "Content-Type": "application/json",
};

// ---------------------------------------------------------------------------
// 401 refresh-and-retry interceptor (deduplicated)
// ---------------------------------------------------------------------------

/**
 * Module-level holder for the single in-flight refresh promise.
 * Multiple simultaneous 401s share this promise so only one POST /api/auth/refresh
 * is in flight at a time.
 */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempt to refresh the session by calling POST /api/auth/refresh.
 *
 * Uses bare `fetch` (NOT `apiFetch`) to avoid interceptor recursion.
 * Returns `true` if the server rotated the cookies (200 response),
 * `false` on 401 (session expired) or network error.
 *
 * Concurrent calls share a single in-flight promise; the `finally` block
 * clears the pointer after the promise settles so subsequent calls start fresh.
 */
async function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Handle a terminal session-expired state: emit a custom event for the app
 * layout to clear the React Query cache, then hard-redirect to the login page
 * with the current path preserved as a `redirect` query parameter.
 */
function handleSessionExpired() {
  if (typeof window === "undefined") return; // SSR safety

  // Emit event for the app layout to hear (clears React Query cache).
  window.dispatchEvent(new CustomEvent("ascend:session-expired"));

  // Hard-redirect to login with current path preserved.
  const currentPath = window.location.pathname + window.location.search;
  // Avoid a redirect loop if we are already on /login.
  if (!currentPath.startsWith("/login")) {
    window.location.href =
      "/login?redirect=" + encodeURIComponent(currentPath);
  } else {
    window.location.href = "/login";
  }
}

// ---------------------------------------------------------------------------
// apiFetch: the primary fetch function for all React Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetch JSON from an Ascend API route with cookie auth.
 *
 * This is the primary function imported by all React Query hooks. It delegates
 * to the `@ascend/api-client` package for the actual HTTP call. The signature
 * matches the legacy `apiFetch<T>(url, init?)` shape so no hook changes are
 * needed.
 *
 * Behavior:
 *   - Sends `credentials: "include"` so cookies are attached on every request.
 *   - Returns parsed JSON typed as T on 2xx.
 *   - Returns `undefined as T` on 204 No Content.
 *   - On 401 (and the URL is NOT `/api/auth/*`): attempts a single token
 *     refresh via POST /api/auth/refresh, then retries the original request.
 *     If refresh fails or the retry still returns 401, emits
 *     `ascend:session-expired` and redirects to /login.
 *   - Throws `Error` with the server's `error` field on non-2xx (preserving
 *     the existing error shape that hooks and components rely on).
 *   - Blocks write methods (POST/PUT/PATCH/DELETE) when offline to prevent
 *     silent mutation failures.
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

  // Inject Content-Type: application/json for string bodies (the pre-refactor
  // apiFetch always included it via apiHeaders). The platform-agnostic package
  // intentionally omits Content-Type so platforms can send FormData/Blob/etc.
  // We restore it here for the web layer only, and only when:
  //   1. There IS a body (POST/PUT/PATCH payloads).
  //   2. The body is a string (JSON.stringify'd by the caller).
  //   3. The caller did NOT already set Content-Type (caller wins).
  let mergedInit: RequestInit | undefined = init;
  if (init?.body != null && typeof init.body === "string") {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
      mergedInit = { ...init, headers };
    }
  }

  // Ensure cookies are sent with every request (the auth vector).
  const fetchInit: RequestInit = {
    ...mergedInit,
    credentials: "include",
  };

  try {
    return await api.fetch<T>(url, fetchInit);
  } catch (error) {
    // --- 401 intercept: refresh and retry ---
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !url.startsWith("/api/auth/")
    ) {
      const refreshed = await attemptRefresh();
      if (refreshed) {
        // Retry the original request once with fresh cookies.
        try {
          return await api.fetch<T>(url, fetchInit);
        } catch (retryError) {
          // If the retry still fails with 401, session is truly dead.
          if (retryError instanceof ApiError && retryError.status === 401) {
            handleSessionExpired();
            throw new Error("Session expired");
          }
          // Non-401 retry error: fall through to the normal error handling below.
          if (retryError instanceof ApiError) {
            const body = retryError.body as Record<string, unknown> | null;
            const message =
              (body && typeof body.error === "string" && body.error) ||
              `Request failed (${retryError.status})`;
            throw new Error(message);
          }
          throw retryError;
        }
      } else {
        // Refresh failed. Session is dead.
        handleSessionExpired();
        throw new Error("Session expired");
      }
    }

    // --- Normal error handling (non-401, or auth routes) ---
    // Preserve the existing error shape: hooks catch `Error` instances and
    // read `error.message`. The package throws `ApiError` (which extends
    // Error) with a structured message. We re-throw as a plain Error with
    // just the server's error field or a fallback, matching the legacy
    // behavior that hooks and toast messages depend on.
    if (error instanceof ApiError) {
      const body = error.body as Record<string, unknown> | null;
      const message =
        (body && typeof body.error === "string" && body.error) ||
        `Request failed (${error.status})`;
      throw new Error(message);
    }
    throw error;
  }
}
