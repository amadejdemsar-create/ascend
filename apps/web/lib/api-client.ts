/**
 * Configured API client instance for the Ascend web app.
 *
 * Wraps `@ascend/api-client` (the platform-agnostic HTTP client package) with
 * web-specific configuration: same-origin base URL and Bearer token auth from
 * the NEXT_PUBLIC_API_KEY environment variable.
 *
 * Every hook and component that needs to call an Ascend API route should import
 * `apiFetch` (or `api`) from this module. Direct `fetch()` with manual headers
 * is banned in `apps/web/lib/hooks/`.
 *
 * NOTE on NEXT_PUBLIC_API_KEY: this token ships in the client bundle and is
 * visible to anyone with devtools. The single-user design makes this an
 * acceptable choice today; multi-user would need a server-side session model
 * (Wave 6 switches to httpOnly cookies for browser + keeps API key for MCP).
 */

import { createApiClient, ApiError } from "@ascend/api-client";

// Re-export the package types so consumers in apps/web can narrow errors.
export { ApiError } from "@ascend/api-client";
export type { ApiClient, ApiClientConfig } from "@ascend/api-client";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

/**
 * Shared configured API client instance.
 *
 * Provides `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()` convenience
 * methods plus the lower-level `.fetch()` for edge cases.
 */
export const api = createApiClient({
  baseUrl: "",
  getAuthHeaders: (): Record<string, string> => {
    if (API_KEY) return { Authorization: `Bearer ${API_KEY}` };
    return {};
  },
});

/**
 * Headers used for every authenticated request from the browser.
 *
 * Exported because a few fire-and-forget call sites use bare `fetch` with these
 * headers (e.g., the dashboard recurring trigger, export section, onboarding
 * MCP guide).
 */
export const apiHeaders: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

/**
 * Fetch JSON from an Ascend API route with the bearer token attached.
 *
 * This is the primary function imported by all React Query hooks. It delegates
 * to the `@ascend/api-client` package for the actual HTTP call. The signature
 * matches the legacy `apiFetch<T>(url, init?)` shape so no hook changes are
 * needed.
 *
 * Behavior:
 *   - Returns parsed JSON typed as T on 2xx.
 *   - Returns `undefined as T` on 204 No Content.
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
  let mergedInit = init;
  if (init?.body != null && typeof init.body === "string") {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
      mergedInit = { ...init, headers };
    }
  }

  try {
    return await api.fetch<T>(url, mergedInit);
  } catch (error) {
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
