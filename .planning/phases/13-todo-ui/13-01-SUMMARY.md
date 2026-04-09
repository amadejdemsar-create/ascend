---
phase: 13-todo-ui
plan: 01
subsystem: ui
tags: [react, tanstack-table, lucide, shadcn, next.js]

requires:
  - phase: 12-todo-data-layer
    provides: "Todo API routes, hooks (useTodos, useCreateTodo), query keys, validation schemas (TodoFilters, CreateTodoInput)"
provides:
  - "/todos page with sortable list, filter bar, quick-add, and navigation entry"
  - "TodoListItem type and column definitions for reuse in other views"
  - "TodoFilterBar component with status, priority, category, and goal dropdowns"
  - "TodoQuickAdd component for inline to-do creation"
  - "TodoListView with TanStack Table and sortable headers"
affects: [13-02-todo-detail, dashboard, mobile-layout]

tech-stack:
  added: []
  patterns: ["Todo filter state lifted to page level (not Zustand)", "Reuse SortableHeader and GoalPriorityBadge across features"]

key-files:
  created:
    - app/(app)/todos/page.tsx
    - components/todos/todo-list-columns.tsx
    - components/todos/todo-list-view.tsx
    - components/todos/todo-filter-bar.tsx
    - components/todos/todo-quick-add.tsx
  modified:
    - components/layout/nav-config.ts

key-decisions:
  - "Todo filter state managed with local useState instead of Zustand, keeping it simpler than goals since todos have no view switcher or horizon tabs"
  - "Reused GoalPriorityBadge and SortableHeader from goals components to maintain visual consistency"
  - "Default sort order is due date ascending, then priority (high first), then status (pending first)"
  - "Right panel shows placeholder text; actual detail panel deferred to Plan 02"

patterns-established:
  - "TodoListItem interface as the shared type for todo list rendering"
  - "Filter props pattern (filters + onFiltersChange) for composable todo filtering"

requirements-completed: [TODO-10, TODO-11]

duration: 3min
completed: 2026-04-09
---

# Phase 13 Plan 01: Todo List Page Summary

**Sortable todo list page with 6 column table, 4 filter dropdowns, inline quick-add, and sidebar navigation entry using TanStack Table**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T10:59:38Z
- **Completed:** 2026-04-09T11:02:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added Todos navigation item to sidebar and mobile bottom tab bar (between Goals and Settings)
- Created sortable todo list with 6 columns: title (with Big3 star and recurring icon), status badge, priority badge, due date, category with color dot, and linked goal
- Built filter bar with 4 dropdowns (status, priority, category, goal) and "Clear all" button
- Built inline quick-add with title input, priority selector (H/M/L), and Enter key submission
- Created the /todos page with loading skeletons, empty state, and left/right panel layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Navigation update and todo list columns** - `7c8b16c` (feat)
2. **Task 2: Todo filter bar, quick-add, list view, and page** - `63d5159` (feat)

## Files Created/Modified
- `components/layout/nav-config.ts` - Added CheckSquare icon and Todos nav entry
- `components/todos/todo-list-columns.tsx` - TodoListItem type and 6 column definitions
- `components/todos/todo-list-view.tsx` - TanStack Table wrapper with row selection and empty state
- `components/todos/todo-filter-bar.tsx` - 4 filter dropdowns with clear all functionality
- `components/todos/todo-quick-add.tsx` - Inline todo creation with priority selector
- `app/(app)/todos/page.tsx` - Main todos page with filters, sorting, loading, and empty state

## Decisions Made
- Used local useState for todo filter state rather than Zustand, since the todo page is simpler than goals (no view switcher, no horizon tabs, no drag and drop)
- Reused GoalPriorityBadge and SortableHeader from the goals feature to maintain visual consistency across the app
- Default sort order: due date ascending (nulls last), then priority high to low, then pending before done/skipped
- Right panel displays placeholder text; the actual detail panel will be built in Plan 02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select onValueChange type mismatch**
- **Found during:** Task 2
- **Issue:** base-ui Select's onValueChange passes `string | null`, but priority state setter expects `string`
- **Fix:** Added null guard: `if (val) setPriority(val)` to prevent null assignment
- **Files modified:** components/todos/todo-quick-add.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 63d5159 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type safety fix, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Todo list page is functional and accessible from navigation
- Ready for Plan 02: todo detail panel, edit/complete/skip actions
- TodoListItem type and column definitions ready for reuse

## Self-Check: PASSED

All 6 files verified on disk. Both commit hashes (7c8b16c, 63d5159) found in git log.

---
*Phase: 13-todo-ui*
*Completed: 2026-04-09*
