---
phase: 01-foundation
plan: 03
subsystem: service-layer
tags: [typescript, prisma, zod, service-layer, hierarchy-validation, recursive-cte]

# Dependency graph
requires:
  - phase: 01-foundation-02
    provides: "Prisma schema with 6 models, db.ts singleton, generated client"
provides:
  - "Goal CRUD service with hierarchy validation (list, create, getById, update, delete, getTree, search, logProgress, getProgressHistory)"
  - "Category CRUD service with tree building (list, listTree, create, getById, update, delete)"
  - "Hierarchy validation enforcing YEARLY > QUARTERLY > MONTHLY > WEEKLY chain"
  - "Zod schemas for all API inputs with exported TypeScript types"
  - "Recursive CTE tree queries for descendant and ancestor traversal"
  - "Horizon and XP constants for gamification"
affects: [api-routes, mcp-server, gamification, ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Service Layer as plain TypeScript object modules (not classes)", "All service functions take userId as first parameter for multi-user isolation", "z.input types for ergonomic callers with default fields", "Recursive CTEs via prisma.$queryRaw for tree traversal"]

key-files:
  created:
    - lib/constants.ts
    - lib/validations.ts
    - lib/services/goal-service.ts
    - lib/services/category-service.ts
    - lib/services/hierarchy-helpers.ts
    - lib/tree-queries.ts
  modified: []

key-decisions:
  - "Used z.input<> instead of z.infer<> for exported types so callers can omit fields with defaults (priority, color)"
  - "Goal service auto-sets completedAt when status transitions to COMPLETED"
  - "Progress logging increments currentValue and recalculates percentage against targetValue"
  - "Category listTree builds tree in memory from flat query (two-pass map approach)"

patterns-established:
  - "Service module pattern: export const fooService = { async method(userId, ...) {} }"
  - "Ownership verification: findFirst with { id, userId } before mutating operations"
  - "Hierarchy validation: lookup VALID_PARENT_HORIZONS map, fetch parent, compare horizon"
  - "Date handling: convert ISO string inputs to Date objects before passing to Prisma"

requirements-completed: [INFRA-01]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 1 Plan 03: Service Layer Summary

**Goal and category CRUD services with Zod validation, strict horizon hierarchy enforcement (YEARLY > QUARTERLY > MONTHLY > WEEKLY), progress tracking with auto-percentage calculation, and recursive CTE tree queries**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T14:42:12Z
- **Completed:** 2026-03-30T14:47:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete goal service with 9 methods covering CRUD, tree retrieval, search, and progress logging
- Category service with 6 methods including in-memory tree building for nested categories
- Hierarchy validation that enforces the strict YEARLY > QUARTERLY > MONTHLY > WEEKLY parent chain
- Zod validation schemas for all API inputs with properly typed exports using z.input for default ergonomics
- Recursive CTE queries for walking both down (descendants) and up (ancestors) the goal tree

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validation schemas and constants** - `11d4eda` (feat)
2. **Task 2: Build Service Layer (goal, category, hierarchy, tree queries)** - `dc6615a` (feat)

## Files Created/Modified
- `lib/constants.ts` - Horizon hierarchy rules, XP values per horizon, priority multipliers
- `lib/validations.ts` - Zod schemas for goal/category/progress inputs with exported TypeScript types
- `lib/services/goal-service.ts` - Goal CRUD with hierarchy validation, tree retrieval, search, progress logging
- `lib/services/category-service.ts` - Category CRUD with nested tree building
- `lib/services/hierarchy-helpers.ts` - validateHierarchy function enforcing parent horizon rules
- `lib/tree-queries.ts` - Recursive CTE queries (getDescendants, getAncestors) via prisma.$queryRaw

## Decisions Made
- **z.input vs z.infer for exported types:** Used `z.input<>` so that callers (API routes, MCP server, test scripts) can omit fields with Zod defaults (priority defaults to MEDIUM, color defaults to #4F46E5). The `z.infer<>` type makes default fields required in the output, which forces callers to always specify them.
- **Auto-set completedAt:** When a goal's status transitions to COMPLETED, the update method automatically sets `completedAt` to the current timestamp.
- **In-memory tree building for categories:** The `listTree` method fetches all categories in a single query and builds the tree in memory with a two-pass approach (create map, then link children). This avoids complex nested Prisma includes while supporting unlimited nesting depth.
- **No try/catch in service functions:** Following the plan's instruction, all errors propagate to the caller (API route handlers) which format them as HTTP responses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed z.input vs z.infer type export**
- **Found during:** Task 2 (verification)
- **Issue:** The `CreateGoalInput` type exported via `z.infer<>` made `priority` a required field even though the Zod schema has `.default("MEDIUM")`. This means callers would have to always specify priority, defeating the purpose of the default.
- **Fix:** Changed `z.infer` to `z.input` for `CreateGoalInput`, `UpdateGoalInput`, `CreateCategoryInput`, and `UpdateCategoryInput` so callers can omit fields that have Zod defaults.
- **Files modified:** lib/validations.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** dc6615a (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for correct type ergonomics. No scope creep.

## Issues Encountered
- **No local database for integration testing:** The DATABASE_URL points to `localhost:5432` but there is no local PostgreSQL instance. The production database runs on Dokploy VPS. This means the verification script from the plan could not be executed locally. Verification was limited to TypeScript compilation. Full integration testing will occur when the API routes are built in Plan 04 and requests are made against the deployed application.

## User Setup Required

None.

## Next Phase Readiness
- Service Layer is complete and ready for consumption by API route handlers (Plan 04)
- All service functions accept userId as the first parameter, ready for MCP server integration (Phase 5)
- Zod schemas can be reused for API route input parsing
- Tree queries are available for advanced hierarchy operations

## Self-Check: PASSED

All 6 created files verified on disk. Both commit hashes (11d4eda, dc6615a) found in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-30*
