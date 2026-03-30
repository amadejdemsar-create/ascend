---
phase: 01-foundation
plan: 04
subsystem: api
tags: [next-api-routes, bearer-auth, rest-api, zod-v4, route-handlers]

# Dependency graph
requires:
  - phase: 01-foundation-03
    provides: "Goal and category service layers with Zod validation schemas"
provides:
  - "Bearer token API key authentication (validateApiKey)"
  - "10 REST API endpoints: goals CRUD, progress logging, categories CRUD"
  - "Consistent error response helpers (401, 400 with Zod details, 500)"
  - "Thin route handler pattern delegating all logic to Service Layer"
affects: [mcp-server, ui, testing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Bearer token auth via User.apiKey lookup", "Thin route handlers: auth + parse + service call + response", "Next.js 16 async params (await params)", "Zod v4 error.issues for validation error responses"]

key-files:
  created:
    - lib/auth.ts
    - app/api/goals/route.ts
    - app/api/goals/[id]/route.ts
    - app/api/goals/[id]/progress/route.ts
    - app/api/categories/route.ts
    - app/api/categories/[id]/route.ts
  modified: []

key-decisions:
  - "Used Zod v4 error.issues (not error.errors) for validation error details in API responses"
  - "All route handlers follow identical pattern: validate auth, parse input, call service, return JSON"
  - "Progress endpoints nested under /api/goals/[id]/progress for RESTful resource hierarchy"

patterns-established:
  - "Auth pattern: const auth = await validateApiKey(request); if (!auth.success) return unauthorizedResponse();"
  - "Error handling pattern: try/catch wrapping service calls with handleApiError for consistent formatting"
  - "Route handler shape: export async function METHOD(request, { params }) for all endpoints"

requirements-completed: [INFRA-05]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 1 Plan 04: API Routes and Authentication Summary

**Bearer token API key authentication with 10 REST endpoints covering full goal CRUD, progress logging, and category CRUD, all verified against the live deployment at ascend.nativeai.agency**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T14:49:36Z
- **Completed:** 2026-03-30T14:54:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- API key authentication function that extracts Bearer tokens and validates against the User table
- 10 route handler endpoints covering goals (list, create, get, update, delete), progress (log, history), and categories (list tree, create, get, update, delete)
- Consistent error handling: 401 for auth failures, 400 with Zod v4 issue details for validation errors, 400 for service errors (hierarchy violations, not found), 500 for unexpected errors
- All endpoints verified against live deployment with curl tests covering auth rejection, CRUD operations, hierarchy validation, and cascading deletes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create API key authentication** - `5dd3c31` (feat)
2. **Task 2: Create API route handlers for goals and categories** - `177fb4b` (feat)

## Files Created/Modified
- `lib/auth.ts` - validateApiKey, unauthorizedResponse, handleApiError functions
- `app/api/goals/route.ts` - GET (list with filters) and POST (create with validation)
- `app/api/goals/[id]/route.ts` - GET (single), PATCH (update), DELETE for a specific goal
- `app/api/goals/[id]/progress/route.ts` - POST (log progress) and GET (progress history)
- `app/api/categories/route.ts` - GET (list as tree) and POST (create)
- `app/api/categories/[id]/route.ts` - GET (single with goal count), PATCH (update), DELETE

## Decisions Made
- **Zod v4 error.issues instead of error.errors:** The plan template referenced `error.errors` (Zod v3 API), but this project uses Zod v4.3.6 which exposes validation details on `error.issues`. Used the correct v4 API for accurate error responses.
- **Consistent thin handler pattern:** Every route handler follows the same structure: authenticate, parse, delegate to service, return JSON. No business logic in any route file.
- **RESTful progress nesting:** Progress endpoints are nested under `/api/goals/[id]/progress` rather than being a separate top-level resource, matching the ownership relationship.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used Zod v4 error.issues instead of error.errors**
- **Found during:** Task 1 (auth.ts error handler)
- **Issue:** The plan template used `error.errors` which is the Zod v3 property name. This project uses Zod v4.3.6 which exposes validation details on `error.issues`.
- **Fix:** Used `error.issues` in the handleApiError function
- **Files modified:** lib/auth.ts
- **Verification:** Validation errors return proper issue details in API responses (confirmed via curl)
- **Committed in:** 5dd3c31 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for correct Zod v4 API usage. No scope creep.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- All API endpoints are live and verified at ascend.nativeai.agency
- The MCP server (Phase 5) can consume these endpoints or call the Service Layer directly
- The web UI (Phase 2+) can use these endpoints for client-side data mutations
- Authentication pattern is established and reusable for any new endpoints

## Self-Check: PASSED

All 6 created files verified on disk. Both commit hashes (5dd3c31, 177fb4b) found in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-30*
