/// <reference lib="webworker" />

const CACHE_NAME = "ascend-v1";
const API_CACHE = "ascend-api-v1";

// Duplicated from lib/offline/cache-config.ts (SW is plain JS, cannot import TS)
const CACHED_API_ROUTES = ["/api/dashboard", "/api/goals", "/api/categories"];

// Install: skip waiting to activate immediately
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate: clean old caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Check whether a request URL matches one of the cached API routes.
 * Uses startsWith so /api/goals/123 also matches /api/goals.
 */
function isCachedApiRoute(pathname) {
  return CACHED_API_ROUTES.some((route) => pathname.startsWith(route));
}

// Fetch: network-first for cached API routes, pass-through for everything else
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only cache GET requests to our API routes
  if (event.request.method === "GET" && isCachedApiRoute(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone before caching because a response body can only be consumed once
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() =>
          // Network failed; try the cache
          caches.match(event.request).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ error: "Offline", offline: true }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  // Non-GET and non-cached routes: pass through
  event.respondWith(fetch(event.request));
});
