/// <reference lib="webworker" />

const CACHE_NAME = "ascend-v1";

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
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: pass through all requests (caching strategies added in Plan 03)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
