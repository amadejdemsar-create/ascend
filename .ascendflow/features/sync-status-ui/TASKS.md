# Implementation Tasks: Sync Status UI

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Sync status hook

- [ ] Create `lib/hooks/use-sync-status.ts`. Uses `useQueryClient` and `useIsMutating` from `@tanstack/react-query`. Exports:
  ```ts
  export interface SyncStatus {
    isOnline: boolean;
    activeMutations: number;
    lastSynced: {
      goals: number | null;
      todos: number | null;
      context: number | null;
      dashboard: number | null;
      analytics: number | null;
      review: number | null;
      focus: number | null;
    };
  }
  
  export function useSyncStatus(): SyncStatus;
  ```
  Implementation:
  - `isOnline`: `useState` initialized from `navigator.onLine`, plus `useEffect` adding `online` and `offline` window listeners. SSR-safe: check `typeof window !== "undefined"`.
  - `activeMutations`: `useIsMutating()`.
  - `lastSynced`: read the query cache. For each domain, find all queries whose key starts with the domain name (e.g., `["goals", ...]`) and return the max `state.dataUpdatedAt` across them, or null if no queries found. Use `useState` + `useEffect` that subscribes to `queryCache.subscribe()` so the values update when queries refetch. Tick also via `setInterval(30_000)` to keep relative times fresh.

## Phase 2: Offline mutation guard in api-client

- [ ] Edit `lib/api-client.ts`. Before the `fetch` call inside `apiFetch`, add:
  ```ts
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.onLine === false && options?.method && options.method !== "GET") {
    throw new Error("You are offline. Changes will not save until your connection resumes.");
  }
  ```
  This short-circuits mutations when offline instead of waiting for the network timeout. GET requests still attempt (service worker may serve cached response).

## Phase 3: Sync indicator component

- [ ] Create `components/layout/sync-indicator.tsx`. A button that:
  - Shows `<Wifi className="size-3" />` when online and no mutations
  - Shows `<Loader2 className="size-3 animate-spin" />` + "Saving N..." when `activeMutations > 0`
  - Shows `<WifiOff className="size-3.5 text-amber-500" />` + "Offline" when `!isOnline`
  - Otherwise shows "Synced Xm ago" using the most recent `lastSynced` value across all domains
  - Click opens a `Popover` with `<SyncStatusPopover>` content
  
  Imports: `Popover, PopoverTrigger, PopoverContent` from `@/components/ui/popover`, `Wifi, WifiOff, Loader2` from `lucide-react`, `useSyncStatus` from `@/lib/hooks/use-sync-status`, `formatDistanceToNowStrict` from `date-fns` for the relative time label.

## Phase 4: Sync status popover

- [ ] Create `components/layout/sync-status-popover.tsx`. Receives sync status via the hook (or props from the parent). Renders:
  1. Connection header: large Wifi/WifiOff icon + "Online" or "Offline" text + color-dot indicator
  2. Domain rows: map over `lastSynced` keys. Label each domain + "synced Xm ago" or "not synced yet". Use lucide icons: `Target` for goals, `CheckSquare` for todos, `Brain` for context, `LayoutDashboard` for dashboard, `TrendingUp` for analytics, `ClipboardCheck` for review, `Clock` for focus.
  3. Mutation row (only if `activeMutations > 0`): "Saving N changes..." with spinner
  4. "Refresh all" button: calls `queryClient.refetchQueries()` and shows a toast. Wrap in a spinner-on-click state.

## Phase 5: Wire into layout

- [ ] Edit `app/(app)/layout.tsx`. Import `SyncIndicator` from `@/components/layout/sync-indicator`. Add it to the footer, to the right of `FocusTimerWidget`:
  ```tsx
  <div className="flex items-center gap-3">
    <span>Ascend</span>
    <FocusTimerWidget />
    <SyncIndicator />
  </div>
  ```

## Phase 6: Mobile badge (optional, small)

- [ ] Edit `components/layout/bottom-tab-bar.tsx`. If the mobile tab bar does not already have a place for a sync indicator, add a small amber dot in the corner of one of the tabs (or beside the more-menu icon) that shows when offline. Use `useSyncStatus().isOnline` in a tiny client component.

  If this is complex, **skip** the mobile badge for v1 and note it in the PRD. The desktop footer indicator is the primary deliverable.

## Phase 7: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Manually verify:
  - With dev server running and online, the sidebar footer shows "Synced Xm ago"
  - Chrome DevTools → Network → "Offline" toggle. Indicator flips to "Offline" chip within 1 second.
  - Try completing a todo while offline. Toast shows "You are offline..." message.
  - Click the indicator when online, popover shows per-domain sync times.
  - Click "Refresh all", queries refetch, toast confirms.
- [ ] Run `/ax:review` for safety audit.
