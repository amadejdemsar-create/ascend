---
phase: 11-onboarding-pwa-and-polish
plan: 03
subsystem: pwa
tags: [service-worker, indexeddb, idb, offline, caching, react-query]

# Dependency graph
requires:
  - phase: 11-02
    provides: "Service worker skeleton with install/activate/fetch lifecycle"
provides:
  - "Network-first API caching in service worker for offline reads"
  - "IndexedDB outbox module for queuing offline mutations"
  - "OfflineSyncProvider that drains outbox on connectivity restore"
  - "Cache configuration as single source of truth for cached routes"
affects: [11-05]

# Tech tracking
tech-stack:
  added: [idb]
  patterns: [network-first-caching, indexeddb-outbox-queue, online-event-drain]

key-files:
  created:
    - lib/offline/cache-config.ts
    - lib/offline/outbox.ts
    - components/pwa/offline-sync-provider.tsx
  modified:
    - public/sw.js
    - app/(app)/layout.tsx
    - package.json

key-decisions:
  - "Duplicated CACHED_API_ROUTES in sw.js because service worker is plain JS and cannot import TS modules"
  - "Module-level singleton for IndexedDB connection promise to avoid repeated openDB calls"
  - "OfflineSyncProvider wraps entire app layout to ensure React Query context is available for post-drain invalidation"

patterns-established:
  - "Network-first caching: try fetch, cache successful response, serve from cache on network failure"
  - "IndexedDB outbox pattern: enqueue mutations with timestamp, drain oldest-first on reconnect"
  - "Online event listener with mount-time drain for app reopen scenarios"

requirements-completed: [PWA-03, PWA-04]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 11 Plan 03: Offline Caching and Sync Summary

**Network-first service worker API caching with IndexedDB mutation outbox and automatic reconnection sync via idb library**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T19:28:56Z
- **Completed:** 2026-03-31T19:31:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Service worker caches API GET responses (dashboard, goals, categories) with network-first strategy, falling back to cache when offline
- IndexedDB outbox module queues mutations made while offline and replays them chronologically on reconnection
- OfflineSyncProvider listens for online events, drains the outbox, and invalidates React Query cache so the UI refreshes with synced data

## Task Commits

Each task was committed atomically:

1. **Task 1: Install idb library, create outbox module and cache configuration** - `67416f5` (feat)
2. **Task 2: Service worker caching strategies and offline sync provider** - `6ee2940` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `lib/offline/cache-config.ts` - Single source of truth for cached API routes and cache names
- `lib/offline/outbox.ts` - IndexedDB outbox with enqueue, drain, and getPendingCount exports
- `components/pwa/offline-sync-provider.tsx` - Client provider that drains outbox on online event
- `public/sw.js` - Enhanced with network-first caching for API routes
- `app/(app)/layout.tsx` - Wrapped in OfflineSyncProvider
- `package.json` - Added idb dependency

## Decisions Made
- Duplicated the CACHED_API_ROUTES array in sw.js because service workers run as plain JavaScript and cannot import TypeScript modules; the cache-config.ts remains the canonical source for application code
- Used a module-level singleton pattern for the IndexedDB connection promise to prevent repeated openDB calls across enqueue/drain/getPendingCount
- Placed OfflineSyncProvider as the outermost wrapper in the app layout to ensure it has access to React Query's QueryClient context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Offline read support is complete: dashboard, goals, and categories are cached after first successful fetch
- Offline write support is complete: mutations are queued in IndexedDB and replayed on reconnection
- Plan 05 (final polish) can proceed with full offline infrastructure available

## Self-Check: PASSED

All 6 files verified present. Both task commits (67416f5, 6ee2940) confirmed in git log.

---
*Phase: 11-onboarding-pwa-and-polish*
*Completed: 2026-03-31*
