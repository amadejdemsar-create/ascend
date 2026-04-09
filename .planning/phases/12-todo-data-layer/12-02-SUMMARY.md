---
phase: 12-todo-data-layer
plan: 02
subsystem: api, hooks, services
tags: [rrule, recurrence, streaks, big3, react-query, nextjs, prisma]

# Dependency graph
requires:
  - phase: 12-todo-data-layer plan 01
    provides: Todo model, todoService CRUD, completion with XP, REST API routes, Zod schemas
provides:
  - todoRecurringService with rrule instance generation, streak tracking, consistency score
  - todoService extended with getBig3, setBig3, getByDate, getByDateRange, bulkComplete, reorder
  - API routes for Big 3, date queries, recurring generation, bulk complete, reorder, search
  - React Query hooks for all to-do operations with cross-domain cache invalidation
  - Query key factories for todos (all, list, detail, byDate, byRange, big3, search)
affects: [13 todo-ui, 14 calendar-view, 17 todo-mcp-tools]

# Tech tracking
tech-stack:
  added: [rrule 2.8.1]
  patterns: [rrule string parsing for flexible recurrence, 30-day rolling consistency score, max-3 Big 3 enforcement, cross-domain query invalidation (todos -> goals)]

key-files:
  created:
    - lib/services/todo-recurring-service.ts
    - lib/hooks/use-todos.ts
    - app/api/todos/big3/route.ts
    - app/api/todos/by-date/route.ts
    - app/api/todos/by-range/route.ts
    - app/api/todos/recurring/generate/route.ts
    - app/api/todos/bulk-complete/route.ts
    - app/api/todos/reorder/route.ts
    - app/api/todos/search/route.ts
  modified:
    - lib/services/todo-service.ts
    - lib/queries/keys.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Consistency score counts the current completion (+1) before it is persisted to avoid off-by-one in the ratio"
  - "Streak broken detection uses rrule.before() to find the previous expected occurrence rather than date arithmetic"
  - "Big 3 Zod schema enforces max 3 at the API layer in addition to the service layer for defense in depth"

patterns-established:
  - "rrule string recurrence: templates store RFC 5545 rrule strings, instances are generated on demand via rrulestr()"
  - "Rolling consistency score: (completed in 30 days / expected in 30 days) * 100, recalculated on each completion"
  - "Cross-domain invalidation: todo completion invalidates goals.all() because linked goal progress changes"

requirements-completed: [TODO-07, TODO-08, TODO-09]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 12 Plan 02: Todo Data Layer Summary

**Recurring to-do support via rrule with streak tracking, Daily Big 3 enforcement (max 3 per date), date-range queries for calendar, and 15 React Query hooks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T10:45:48Z
- **Completed:** 2026-04-09T10:49:12Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Recurring to-do service using rrule library for RFC 5545 pattern parsing, instance generation, streak tracking with auto-reset on missed deadlines, and 30-day rolling consistency scores
- Daily Big 3 system with max-3 enforcement at both service and API layers, date-scoped queries, and atomic set/unset operations
- Seven new API routes covering Big 3 management, date and date-range queries (for calendar integration), recurring instance generation, bulk completion, reorder, and search
- Fifteen React Query hooks with correct cache invalidation including cross-domain invalidation (completing a to-do linked to a goal invalidates goals.all)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install rrule, create todo-recurring-service, add Big 3 and date methods to todo-service** - `f884c13` (feat)
2. **Task 2: API routes for Big 3, date queries, recurring generation, bulk operations, and search** - `4786217` (feat)
3. **Task 3: Query keys and React hooks for all to-do operations** - `76eea1a` (feat)

## Files Created/Modified
- `lib/services/todo-recurring-service.ts` - Recurring to-do service with getOccurrences, generateDueInstances, completeRecurringInstance, getStreakData
- `lib/services/todo-service.ts` - Extended with getBig3, setBig3, getByDate, getByDateRange, bulkComplete, reorder; complete() now triggers streak updates
- `lib/queries/keys.ts` - Added todos query key factories (all, list, detail, byDate, byRange, big3, search)
- `lib/hooks/use-todos.ts` - 15 React Query hooks for all to-do CRUD, completion, Big 3, date queries, search, bulk, reorder, recurring generation
- `app/api/todos/big3/route.ts` - GET/POST for Daily Big 3 retrieval and setting
- `app/api/todos/by-date/route.ts` - GET for calendar day view
- `app/api/todos/by-range/route.ts` - GET for calendar month view
- `app/api/todos/recurring/generate/route.ts` - POST for recurring instance creation
- `app/api/todos/bulk-complete/route.ts` - POST for batch completion
- `app/api/todos/reorder/route.ts` - POST for sort order updates
- `app/api/todos/search/route.ts` - GET for title/description search
- `package.json` - Added rrule dependency
- `package-lock.json` - Lock file updated for rrule

## Decisions Made
- Consistency score calculation includes the current completion (+1 to completedCount) before the instance status is saved, preventing an off-by-one where the just-completed instance would not be counted in the 30-day window.
- Streak broken detection uses rrule's `rule.before(today, false)` to find the previous expected occurrence date, then compares it against `lastCompletedDate`. This works correctly for irregular schedules (e.g., "every Tuesday and Thursday") where simple date arithmetic would fail.
- Big 3 validation is enforced at both the Zod schema layer (max 3 in the array) and the service layer (explicit length check with descriptive error), providing defense in depth.

## Deviations from Plan

None. The plan was executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None. The rrule library is a pure JavaScript dependency with no external configuration.

## Next Phase Readiness
- Phase 12 (Todo Data Layer) is fully complete with both plans executed
- Phase 13 (Todo UI) can now consume all 15 React hooks from use-todos.ts
- Phase 14 (Calendar View) can use useTodosByDate, useTodosByRange, and useTop3Todos for calendar integration
- Phase 17 (Todo MCP Tools) can call the API routes directly

## Self-Check: PASSED
