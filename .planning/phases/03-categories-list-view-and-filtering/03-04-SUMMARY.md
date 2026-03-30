---
phase: 03-categories-list-view-and-filtering
plan: 04
subsystem: ui
tags: [tanstack-table, react, zustand, filtering, sorting, shadcn]

# Dependency graph
requires:
  - phase: 03-categories-list-view-and-filtering
    provides: UIStore with activeView, activeFilters, activeSorting persist and TanStack Table installed
  - phase: 02-app-shell-and-goal-management
    provides: GoalPriorityBadge, Badge, goal hooks, category hooks
provides:
  - GoalListView table component with 7 sortable columns via TanStack Table
  - GoalFilterBar with 4 dimension dropdowns (horizon, status, priority, category) bound to Zustand store
  - SortableHeader reusable component with tri-state sort indicators
  - GoalListItem type interface for goal list data shape
  - shadcn Table primitives (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)
affects: [03-05-view-switcher, goal-dashboard-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [tanstack-table-column-defs, sortable-header-tri-state, filter-bar-zustand-binding]

key-files:
  created:
    - components/goals/sortable-header.tsx
    - components/goals/goal-list-columns.tsx
    - components/goals/goal-list-view.tsx
    - components/goals/goal-filter-bar.tsx
    - components/ui/table.tsx
  modified: []

key-decisions:
  - "GoalListItem interface defined locally in column definitions file rather than creating a shared types file, keeping the type close to its consumer"
  - "SortableHeader accepts generic Column type for reuse across different table implementations"
  - "base-ui Select onValueChange passes string|null so handleChange accepts nullable value and coerces to undefined for store"

patterns-established:
  - "Column definition pattern: ColumnDef array with SortableHeader for headers and custom cell renderers for rich content"
  - "Filter bar pattern: Select dropdowns bound bidirectionally to Zustand persisted state with Clear All reset"

requirements-completed: [VIEW-02, VIEW-08]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 3 Plan 04: List View and Filter Bar Summary

**TanStack Table goal list with 7 sortable columns, filter bar with 4 dimension dropdowns, and shadcn Table primitives**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T21:35:48Z
- **Completed:** 2026-03-30T21:38:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built a reusable SortableHeader component with tri-state sort indicators (ascending, descending, unsorted) using lucide-react icons
- Created 7 column definitions for the goal list table covering title, status, progress, priority, deadline, category, and horizon
- Implemented GoalListView using TanStack useReactTable with persistent sort state via Zustand store
- Built GoalFilterBar with 4 Select dropdowns (horizon, status, priority, category) that read from and write to the Zustand activeFilters state
- Created shadcn Table component primitives since they were not yet installed

## Task Commits

Each task was committed atomically:

1. **Task 1: Column definitions and sortable header** - `115473b` (feat)
2. **Task 2: List view table and filter bar** - `e71e783` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `components/goals/sortable-header.tsx` - Generic reusable sortable column header with ArrowUp/ArrowDown/ChevronsUpDown indicators
- `components/goals/goal-list-columns.tsx` - 7 column definitions with GoalListItem type, status badges, progress bar, priority badge, date formatting, category display, horizon badge
- `components/goals/goal-list-view.tsx` - Data table component using TanStack useReactTable with getCoreRowModel and getSortedRowModel, sort state bound to Zustand
- `components/goals/goal-filter-bar.tsx` - Filter bar with 4 Select dropdowns bound to activeFilters store, Clear All button visible when filters active
- `components/ui/table.tsx` - shadcn Table primitives (Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption)

## Decisions Made
- GoalListItem interface defined locally in the column definitions file rather than creating a shared types file, keeping the type close to its only consumer
- SortableHeader uses generic Column<TData, TValue> type so it can be reused across different table implementations in the future
- The filter bar handleChange function accepts `string | null` to match base-ui Select's onValueChange signature, coercing null/empty to undefined for the store

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing shadcn Table component**
- **Found during:** Task 2 (List view table and filter bar)
- **Issue:** The plan instructed checking for `components/ui/table.tsx` and creating it if missing; the component was indeed absent
- **Fix:** Created the full shadcn Table component set following the established shadcn/base-ui pattern used by other UI components in the project
- **Files modified:** components/ui/table.tsx
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** e71e783 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed onValueChange type mismatch in filter bar**
- **Found during:** Task 2 (List view table and filter bar)
- **Issue:** base-ui Select's onValueChange passes `string | null` but the handleChange function accepted only `string`, causing TypeScript error TS2345
- **Fix:** Updated handleChange parameter type to `string | null` which correctly coerces falsy values to undefined via the existing `value || undefined` logic
- **Files modified:** components/goals/goal-filter-bar.tsx
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** e71e783 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for compilation. The missing Table component was anticipated by the plan itself. The type mismatch was a minor adaptation to the base-ui Select API. No scope creep.

## Issues Encountered
None.

## User Setup Required
None, no external service configuration required.

## Next Phase Readiness
- GoalListView and GoalFilterBar are ready for integration into the main dashboard via the view switcher (Plan 05)
- GoalListItem type is exported for consumers that need to pass goal data to the list view
- SortableHeader can be reused by any future TanStack Table implementation
- Filter state persists across sessions via Zustand localStorage

## Self-Check: PASSED

All 5 created files verified present on disk. Both task commit hashes (115473b, e71e783) confirmed in git log.

---
*Phase: 03-categories-list-view-and-filtering*
*Completed: 2026-03-30*
