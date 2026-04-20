/** API routes that the service worker caches for offline reading */
export const CACHED_API_ROUTES = [
  "/api/dashboard",
  "/api/goals",
  "/api/categories",
];

/** Cache name for API responses (network-first strategy) */
export const API_CACHE_NAME = "ascend-api-v1";

/** Cache name for static assets (app shell) */
export const STATIC_CACHE_NAME = "ascend-v1";
