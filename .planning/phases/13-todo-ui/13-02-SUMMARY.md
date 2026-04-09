---
phase: 13-todo-ui
plan: 02
subsystem: ui
tags: [react, tanstack-table, shadcn, base-ui, lucide, alert-dialog, dropdown-menu]

requires:
  - phase: 13-todo-ui
    provides: "Todo list page with sortable table, columns, filter bar, quick-add (Plan 01)"
  - phase: 12-todo-data-layer
    provides: "Todo API routes, hooks (useTodos, useCompleteTodo, useSkipTodo, useDeleteTodo, useBulkCompleteTodos, useUpdateTodo)"
provides:
  - "Checkbox row selection with select-all header and floating bulk action bar"
  - "Bulk-complete and bulk-delete actions with confirmation dialog"
  - "Overdue visual indicators (red date text, red left border on rows) with reschedule dropdown"
  - "Todo detail side panel with status, priority, due date, category, linked goal, recurring info, and complete/skip/delete actions"
  - "Mobile full-screen overlay for todo detail"
affects: [dashboard, mobile-layout]

tech-stack:
  added: []
  patterns: ["TodoTableMeta interface for passing selection state via TanStack Table meta option", "isOverdue helper used consistently across columns, list view, and detail panel"]

key-files:
  created:
    - components/todos/todo-bulk-bar.tsx
    - components/todos/todo-overdue-actions.tsx
    - components/todos/todo-detail.tsx
  modified:
    - components/todos/todo-list-columns.tsx
    - components/todos/todo-list-view.tsx
    - app/(app)/todos/page.tsx

key-decisions:
  - "Used native HTML checkbox inputs styled with Tailwind instead of creating a new Checkbox UI component, since the project does not have one and a full component would be over-engineered for this use case"
  - "Bulk delete uses Promise.all over individual useDeleteTodo calls since no bulk-delete API endpoint exists"
  - "Overdue detection compares dueDate against midnight today (setHours(0,0,0,0)) to avoid false positives for to-dos due today"
  - "TodoTableMeta interface defined in columns file and imported by list view, keeping the selection contract co-located with the column definitions"

patterns-established:
  - "TodoTableMeta: typed TanStack Table meta for passing selection state through table.options.meta"
  - "isOverdue helper: reusable overdue check (dueDate < today AND status PENDING) used in columns, list view, and detail"

requirements-completed: [TODO-12, TODO-13]

duration: 3min
completed: 2026-04-09
---

# Phase 13 Plan 02: Todo Bulk Actions, Overdue Handling, and Detail Panel Summary

**Checkbox row selection with floating bulk bar, overdue visual indicators with reschedule dropdown, and side panel showing full to-do details with complete/skip/delete actions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T11:04:50Z
- **Completed:** 2026-04-09T11:07:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added checkbox column with select-all header, enabling multi-select across the entire to-do list
- Created floating bulk action bar that appears when items are selected, with complete and delete (with confirmation dialog) actions
- Built overdue to-do highlighting: red left border on rows, red date text in the due date column, and an inline dropdown with "Reschedule to today", "Reschedule to tomorrow", and "Complete now" options
- Created TodoDetail side panel following the goals detail pattern, showing all to-do fields (status, priority, due date, category, linked goal, recurring streak/consistency) with complete, skip, and delete actions
- Integrated mobile full-screen overlay for the detail panel

## Task Commits

Each task was committed atomically:

1. **Task 1: Bulk action bar, overdue actions, and updated columns with checkboxes** - `d9554f5` (feat)
2. **Task 2: Todo detail panel and page integration** - `05880f0` (feat)

## Files Created/Modified
- `components/todos/todo-bulk-bar.tsx` - Floating bar with complete/delete buttons and AlertDialog confirmation
- `components/todos/todo-overdue-actions.tsx` - DropdownMenu with reschedule (today/tomorrow) and complete options
- `components/todos/todo-detail.tsx` - Side panel with full to-do info, complete/skip/delete actions, delete confirmation
- `components/todos/todo-list-columns.tsx` - Added checkbox column, TodoTableMeta interface, overdue date styling with inline actions
- `components/todos/todo-list-view.tsx` - Added selection props, table meta, overdue row highlighting
- `app/(app)/todos/page.tsx` - Integrated selection state, bulk bar, detail panel (desktop side + mobile overlay)

## Decisions Made
- Used native HTML checkbox inputs styled with Tailwind (accent-primary, size-4) rather than building a dedicated Checkbox UI component. The project has no Checkbox component in components/ui/ and adding one purely for this feature would be unnecessary.
- Bulk delete iterates with Promise.all over individual deleteTodo calls since there is no bulk-delete API endpoint. This is acceptable for reasonable selection sizes.
- Overdue detection compares against midnight today (setHours(0,0,0,0)) so to-dos due today are not flagged as overdue.
- TodoTableMeta is defined in the columns file (co-located with column definitions) and imported by the list view, keeping the type contract centralized.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 (Todo UI) is now complete with all features: list, filters, quick-add, checkbox selection, bulk actions, overdue handling, and detail panel
- Ready for Phase 14 or whichever phase follows in the roadmap

## Self-Check: PASSED

All 7 files verified on disk. Both commit hashes (d9554f5, 05880f0) found in git log.

---
*Phase: 13-todo-ui*
*Completed: 2026-04-09*
