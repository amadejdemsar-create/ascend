---
phase: 12-todo-data-layer
plan: 01
subsystem: api, database
tags: [prisma, zod, nextjs, todo, xp, gamification]

# Dependency graph
requires:
  - phase: v1.0 (phases 1 through 11)
    provides: Prisma schema with User/Goal/Category models, goal-service, gamification-service, auth helpers, API route patterns
provides:
  - TodoStatus enum and Todo model in Prisma with full field set
  - todoService with CRUD, complete (XP + goal progress), skip, search
  - Zod validation schemas (createTodo, updateTodo, todoFilters) with exported types
  - REST API routes for to-do CRUD, completion, and skip
  - XP_PER_TODO constants for priority-based to-do XP
affects: [12-02 recurrence/streaks/Big3, 13 todo-ui, 14 calendar-view, 17 todo-mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [todo-service follows goal-service pattern, dedicated completion/skip endpoints with side effects]

key-files:
  created:
    - lib/services/todo-service.ts
    - app/api/todos/route.ts
    - app/api/todos/[id]/route.ts
    - app/api/todos/[id]/complete/route.ts
    - app/api/todos/[id]/skip/route.ts
  modified:
    - prisma/schema.prisma
    - lib/validations.ts
    - lib/constants.ts

key-decisions:
  - "XP for to-dos uses direct XP_PER_TODO values (5/10/15) without PRIORITY_MULTIPLIER, since the values already vary by priority"
  - "To-do completion creates XpEvent directly in todoService rather than calling gamificationService.awardXp, because the gamification service is goal-centric (expects horizon param)"
  - "Auto-increment of linked goal progress uses goalService.logProgress with value=1, meaning each to-do completion counts as one unit of goal progress"

patterns-established:
  - "Dedicated side-effect endpoints: POST /api/todos/[id]/complete and /skip keep completion semantics separate from PATCH updates"
  - "todoService ownership verification: every mutating operation checks userId ownership before proceeding"

requirements-completed: [TODO-01, TODO-02, TODO-03, TODO-04, TODO-05, TODO-06]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 12 Plan 01: Todo Data Layer Summary

**Prisma Todo model with CRUD service, XP-awarding completion with auto goal progress increment, and full REST API**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T10:38:31Z
- **Completed:** 2026-04-09T10:41:55Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Todo model with all fields (status, priority, goal/category links, scheduling, recurrence stubs, streak stubs, Big 3 stubs) and 8 database indexes
- Full service layer with list (7 filter dimensions), create, getById, update, delete, complete (XP + goal progress), skip, and search
- Completing a linked to-do auto-increments the parent goal's currentValue by 1 and recalculates progress percentage
- REST API with GET/POST /api/todos, GET/PATCH/DELETE /api/todos/[id], POST /api/todos/[id]/complete, POST /api/todos/[id]/skip

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma Todo model, Zod schemas, and XP constants** - `9d4b3b4` (feat)
2. **Task 2: Todo service layer with CRUD, completion side effects, and goal progress linking** - `dd11c07` (feat)
3. **Task 3: API routes for to-do CRUD, complete, and skip** - `af4a14c` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - TodoStatus enum, Todo model with relations and indexes, todos relation on User/Goal/Category
- `lib/validations.ts` - todoStatusEnum, createTodoSchema, updateTodoSchema, todoFiltersSchema, and exported TS types
- `lib/constants.ts` - XP_PER_TODO constants (LOW: 5, MEDIUM: 10, HIGH: 15)
- `lib/services/todo-service.ts` - Full CRUD + complete + skip + search service
- `app/api/todos/route.ts` - GET (list with filters) and POST (create) endpoints
- `app/api/todos/[id]/route.ts` - GET, PATCH, DELETE for single to-do
- `app/api/todos/[id]/complete/route.ts` - POST endpoint for completing with XP and goal progress side effects
- `app/api/todos/[id]/skip/route.ts` - POST endpoint for skipping without side effects

## Decisions Made
- XP for to-dos uses direct XP_PER_TODO values (LOW: 5, MEDIUM: 10, HIGH: 15) without the PRIORITY_MULTIPLIER, since the values already vary by priority and to-dos are intentionally lower than goals (which range 50 to 500).
- To-do completion creates XpEvent and upserts UserStats directly in todoService rather than routing through gamificationService.awardXp, because the gamification service expects a horizon param which to-dos do not have.
- Auto-increment of linked goal progress calls goalService.logProgress(userId, goalId, { value: 1 }), meaning each to-do completion counts as exactly one unit of progress. If a goal has targetValue=10, completing 10 linked to-dos reaches 100%.
- The database could not be reached locally (localhost:5432), so prisma generate was used to validate the schema and TypeScript compilation. The db push will apply when the app connects to the production database.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Database unreachable for db push**
- **Found during:** Task 1
- **Issue:** `npx prisma db push` failed because the PostgreSQL database at localhost:5432 was not running locally
- **Fix:** Used `npx prisma generate` to validate the schema and generate the client. The migration will apply when the app is deployed or the database is accessible.
- **Files modified:** None (schema is valid, just not pushed)
- **Verification:** `npx prisma generate` succeeded, `npx tsc --noEmit` passed with zero errors

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The schema is valid and TypeScript compiles. The only gap is the database migration has not been applied yet; it will apply on next `db push` or deployment.

## Issues Encountered
- Local PostgreSQL not running, so `prisma db push` could not apply the schema. This does not block development since the Prisma client was generated successfully and all TypeScript compiles.

## User Setup Required
None, but the database migration needs to be applied via `npx prisma db push` when the database is accessible.

## Next Phase Readiness
- Plan 12-02 can build recurrence (rrule), streak tracking, and Daily Big 3 enforcement on top of the Todo model and service layer created here
- All recurrence, streak, and Big 3 fields exist in the schema (stubs with defaults), ready for logic implementation

## Self-Check: PASSED

All 8 created/modified files verified on disk. All 3 task commits (9d4b3b4, dd11c07, af4a14c) verified in git history.

---
*Phase: 12-todo-data-layer*
*Completed: 2026-04-09*
