# Sync Status UI

**Slug**: sync-status-ui
**Created**: 14. 4. 2026
**Status**: planning

## Problem

Ascend has an offline cache config (`lib/offline/cache-config.ts`) and a service worker (`public/sw.js`) that cache read API responses, but there is no UI telling the user whether they are online, when data was last synced, or whether any mutations are currently in flight. In PWA-style usage (offline on mobile, intermittent wifi on a laptop), this ambiguity creates trust issues: "Did my edit save? Is this list current?" Surfacing sync status closes that loop.

## Scope

This feature is the **lean** sync status UI. It does NOT build an offline mutation queue with retry (that would require IndexedDB + background sync and is multi-week work). It surfaces existing state and nudges the user clearly when offline. A proper offline queue can be added later as a separate feature.

## User Story

As a user, I want to see at a glance whether I am online, when my data was last synced, and whether any changes are still being saved, so that I trust what I am seeing.

## Success Criteria

- [ ] A small sync indicator in the sidebar footer (desktop) and as a badge on the bottom tab bar (mobile)
- [ ] When online and no mutations in flight: a subtle "Synced Xm ago" label
- [ ] When online with active mutations: a spinner with count ("Saving 3...")
- [ ] When offline: a prominent amber/orange "Offline" chip with WifiOff icon
- [ ] When offline AND the user attempts a mutation: a toast explaining the action could not save ("You are offline. Changes will NOT be saved until connection resumes.")
- [ ] Clicking the indicator opens a small popover showing: connection status, last sync times per data domain (goals, todos, context), active mutation count, and service worker cache version
- [ ] The indicator uses the browser `online` / `offline` events to react instantly
- [ ] An optional "Retry" button on the popover triggers `queryClient.refetchQueries()` to force a network sync

## Affected Layers

- **Prisma schema**: none
- **Service layer**: none
- **API routes**: none
- **React Query hooks**: new `lib/hooks/use-sync-status.ts` that reports connection status, per-domain last-sync time, and active mutation count via React Query's query cache metadata
- **UI components**: new `components/layout/sync-indicator.tsx`, new `components/layout/sync-status-popover.tsx`, modified `app/(app)/layout.tsx` (mount the indicator in the footer), modified `components/layout/bottom-tab-bar.tsx` (mobile badge)
- **MCP tools**: none
- **Zustand store**: none (transient state from React Query; no persistence needed)

## Data Model Changes

None.

## Detection Logic

### Connection status
- On mount: set initial state from `navigator.onLine`
- Add listeners for `window.addEventListener("online")` and `window.addEventListener("offline")` to update reactively

### Per-domain last-sync time
Use `queryClient.getQueryCache().findAll({ queryKey: ["goals"] })` to find the goals list query. Each query has a `state.dataUpdatedAt` timestamp (from React Query). Return the most recent timestamp per domain (goals, todos, context, dashboard, analytics, review, focus).

### Active mutations
Use React Query's `useIsMutating()` hook (returns the count of currently-pending mutations).

### Mutation offline guard
Add a listener that intercepts mutations attempted while offline and shows a toast. Simplest approach: a React Query `onError` callback at the `QueryClient` level that checks `!navigator.onLine` and shows the toast. This already fires when a mutation fails due to network error.

Alternatively (better UX): wrap the existing `apiFetch` helper to throw a specific "offline" error immediately when `!navigator.onLine`, and show a toast. This avoids the confusing 5-second timeout that `fetch` waits for before failing.

## UI Flows

### Sync indicator (sidebar footer, desktop)
- Idle online, no mutations: `<Wifi className="size-3" />` + "Synced Xm ago" (muted text)
- Online, 1+ mutations: `<Loader2 className="size-3 animate-spin" />` + "Saving N..."
- Offline: `<WifiOff className="size-3.5 text-amber-500" />` + "Offline" (bold amber chip)
- Click → opens the `SyncStatusPopover`

### Sync status popover
- Connection row: large icon + "Online" or "Offline" + colored indicator dot
- Last sync rows per domain: "Goals synced 2m ago", "Todos synced 30s ago", etc. Timestamps auto-tick via `useEffect` + `setInterval(30s)` to keep the "X ago" fresh.
- Mutation count row (only if > 0): "Saving 3 changes..." with spinner
- Cache version: "Service Worker: ascend-v1" (read from service worker status; fallback to label only)
- "Refresh all" button at the bottom: calls `queryClient.refetchQueries()` + toast "Refreshing..."

### Mobile (bottom tab bar)
- Small dot indicator on one of the tabs (e.g., a "sync" icon) that turns amber when offline. Simpler than a full popover on mobile.

## Cache Invalidation

Read-only feature. No invalidation from this feature; it reads cache state.

## Danger Zones Touched

**`fetchJson` duplicated** (CLAUDE.md). If we wrap `apiFetch` to throw early when offline, it affects every caller. Scope: update `lib/api-client.ts` once so the behavior applies everywhere. Should be safe since all writers already handle `apiFetch` throwing.

## Out of Scope

- IndexedDB-backed offline mutation queue with retry
- Conflict resolution (server-side wins for now)
- Sync history / logs
- Persisted "last sync" across sessions (only current session tracked)
- Connection quality / slow network detection
- Reducing fetch frequency when on metered connections

## Open Questions

None.
