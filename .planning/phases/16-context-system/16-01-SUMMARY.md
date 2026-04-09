---
phase: 16-context-system
plan: 01
subsystem: database, api
tags: [prisma, postgresql, tsvector, full-text-search, backlinks, zod, react-query]

# Dependency graph
requires:
  - phase: v1.0
    provides: "Prisma schema with User, Category models; service/API/hooks patterns"
provides:
  - "ContextEntry Prisma model with title, content, tags, linkedEntryIds, categoryId"
  - "PostgreSQL tsvector full-text search with GIN index and auto-update trigger"
  - "contextService with CRUD, search, and backlink resolution"
  - "3 API route files for context CRUD and search"
  - "6 React Query hooks for context data operations"
  - "Zod schemas for context validation"
affects: [16-02 context UI, 16-03 context MCP tools, 18 command palette extension]

# Tech tracking
tech-stack:
  added: []
  patterns: ["tsvector with weighted ranking (A: title, B: content, C: tags)", "backlink parsing via [[Title]] regex with ID resolution", "array_remove for cascading backlink cleanup on delete"]

key-files:
  created:
    - prisma/migrations/20260409114535_add_context_system/migration.sql
    - prisma/migrations/20260409114539_add_context_fts/migration.sql
    - lib/services/context-service.ts
    - app/api/context/route.ts
    - app/api/context/[id]/route.ts
    - app/api/context/search/route.ts
    - lib/hooks/use-context.ts
  modified:
    - prisma/schema.prisma
    - lib/validations.ts
    - lib/queries/keys.ts

key-decisions:
  - "tsvector auto-update via PostgreSQL trigger (not application-level) for guaranteed consistency"
  - "Backlinks stored as resolved entry IDs in linkedEntryIds[], not raw title strings, for O(1) lookup"
  - "Incoming backlinks computed at query time via `has` filter rather than maintaining bidirectional arrays"
  - "Delete cascades backlink cleanup via raw SQL array_remove across all referencing entries"

patterns-established:
  - "Context service follows same pattern as todoService/goalService (plain TS object, userId first param)"
  - "Full-text search via $queryRaw with plainto_tsquery and ts_rank for relevance ordering"
  - "Manual SQL migration alongside Prisma migration for database-level features (triggers, tsvector)"

requirements-completed: [CTX-01, CTX-02, CTX-03, CTX-04, CTX-05]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 16 Plan 01: Context System Data Layer Summary

**ContextEntry Prisma model with PostgreSQL tsvector full-text search, backlink resolution via [[Title]] syntax, and complete service/API/hooks layer**

## Performance

- **Duration:** 4min
- **Started:** 2026-04-09T11:44:10Z
- **Completed:** 2026-04-09T11:48:18Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- ContextEntry model with title, markdown content, categoryId (reusing Category model), string[] tags, and linkedEntryIds[] for backlinks
- PostgreSQL tsvector column with GIN index and auto-update trigger that weights title (A) > content (B) > tags (C)
- contextService with full CRUD, full-text search via ts_rank, [[backlink]] parsing and resolution, and cascading cleanup on delete
- Three API route files (list/create, single CRUD, search) following established auth/error patterns
- Six React Query hooks matching the use-todos.ts pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: ContextEntry Prisma model, migration with tsvector, and Zod schemas** - `b5401b2` (feat)
2. **Task 2: Context service, API routes, query keys, and React Query hooks** - `871b975` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added ContextEntry model, User and Category relations
- `prisma/migrations/20260409114535_add_context_system/migration.sql` - Base schema migration
- `prisma/migrations/20260409114539_add_context_fts/migration.sql` - tsvector column, GIN index, trigger function
- `lib/validations.ts` - createContextSchema, updateContextSchema, contextFiltersSchema, contextSearchSchema with types
- `lib/services/context-service.ts` - Full CRUD, full-text search, backlink parsing and resolution
- `app/api/context/route.ts` - GET (list with filters) and POST (create) endpoints
- `app/api/context/[id]/route.ts` - GET (with incoming backlinks), PATCH, DELETE endpoints
- `app/api/context/search/route.ts` - GET full-text search endpoint
- `lib/queries/keys.ts` - context namespace with all, list, detail, search keys
- `lib/hooks/use-context.ts` - useContextEntries, useContextEntry, useSearchContext, useCreateContext, useUpdateContext, useDeleteContext

## Decisions Made
- Used PostgreSQL trigger for tsvector auto-update rather than application-level updates, ensuring the search_vector stays in sync even if data is modified outside the application
- Stored resolved entry IDs in linkedEntryIds[] rather than raw title strings; titles are resolved at creation/update time for O(1) lookup
- Incoming backlinks (entries linking TO this entry) are computed at query time using the Prisma `has` array filter rather than maintaining bidirectional reference arrays
- Delete operation cleans up stale references in other entries' linkedEntryIds using raw SQL `array_remove`, preventing dangling backlink IDs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Started local PostgreSQL and created database**
- **Found during:** Task 1 (migration)
- **Issue:** PostgreSQL was installed via brew but not running; ascend database and role did not exist
- **Fix:** Started postgresql@16 via brew services, created ascend role with CREATEDB permission and ascend database
- **Files modified:** None (infrastructure only)
- **Verification:** Migration completed successfully

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Infrastructure setup required for local development; no impact on code or scope.

## Issues Encountered
None beyond the database startup addressed above.

## User Setup Required
None, the context system uses the same PostgreSQL database and API key auth as the rest of the application.

## Next Phase Readiness
- Context data layer is complete and ready for the web UI (Plan 02) and MCP tools (Plan 03)
- All 6 hooks are ready for React components to consume
- Full-text search is functional via the tsvector trigger
- Backlink resolution works bidirectionally

## Self-Check: PASSED

All 10 created/modified files verified on disk. Both task commits (b5401b2, 871b975) found in git log.

---
*Phase: 16-context-system*
*Completed: 2026-04-09*
