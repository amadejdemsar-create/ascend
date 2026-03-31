---
phase: 05-mcp-server
plan: 01
subsystem: api
tags: [mcp, json-rpc, modelcontextprotocol-sdk, streamable-http, web-standard-transport]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma schema, service layer, auth middleware, Zod validations
provides:
  - MCP Server factory (createAscendMcpServer) with ListTools and CallTool handlers
  - 22 raw JSON Schema tool definitions covering all planned MCP operations
  - Goal tool handler dispatching to goalService for 6 CRUD operations
  - /api/mcp POST endpoint with auth-first MCP protocol handling
  - WebStandardStreamableHTTPServerTransport for stateless JSON responses
affects: [05-02, 05-03, 05-04, 05-05, 05-06]

# Tech tracking
tech-stack:
  added: ["@modelcontextprotocol/sdk@1.29.0"]
  patterns: ["Low-level Server class with raw JSON Schema (avoids Zod v3/v4 ambiguity)", "WebStandardStreamableHTTPServerTransport for Next.js App Router compatibility", "Auth-first pattern: validateApiKey before any MCP processing", "Per-request server+transport creation for stateless mode"]

key-files:
  created:
    - lib/mcp/schemas.ts
    - lib/mcp/server.ts
    - lib/mcp/tools/goal-tools.ts
    - app/api/mcp/route.ts
  modified:
    - lib/services/goal-service.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Used WebStandardStreamableHTTPServerTransport instead of manual JSON-RPC dispatch, since SDK v1.29 provides native Web Standard Request/Response support"
  - "Used low-level Server class with raw JSON Schema rather than McpServer.registerTool with Zod shapes, keeping the architecture the plan specified"
  - "Enabled enableJsonResponse:true on transport for clean JSON responses instead of SSE streams"
  - "Extended goalService.list() with optional skip/take pagination rather than querying Prisma directly from the tool handler"

patterns-established:
  - "MCP tool handler pattern: parse args with Zod v4, delegate to service layer, return JSON as text content"
  - "Stateless MCP transport: create fresh server+transport per request, close both after response"
  - "Tool routing: Set-based name lookup dispatching to domain-specific handler modules"

requirements-completed: [MCP-01, MCP-02]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 5 Plan 1: MCP Server Infrastructure Summary

**MCP server endpoint at /api/mcp using @modelcontextprotocol/sdk v1.29 with WebStandardStreamableHTTPServerTransport, 22 tool schemas, and goal CRUD wiring through the existing Service Layer**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T11:09:39Z
- **Completed:** 2026-03-31T11:16:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed MCP SDK as direct dependency and created full tool schema registry with 22 tool definitions
- Built goal tool handler dispatching 6 operations (create, get, update, delete, list, search) through goalService with Zod v4 runtime validation
- Wired /api/mcp endpoint with auth-first design using WebStandardStreamableHTTPServerTransport for stateless JSON responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Install SDK, create MCP server factory and JSON Schema definitions** - `5f76dc0` (feat)
2. **Task 2: Next.js route handler with auth-first MCP protocol handling** - `c62e482` (feat)

## Files Created/Modified
- `lib/mcp/schemas.ts` - 22 raw JSON Schema tool definitions covering goals, progress, categories, dashboard, bulk ops, data, and settings
- `lib/mcp/server.ts` - createAscendMcpServer factory with ListTools and CallTool request handlers
- `lib/mcp/tools/goal-tools.ts` - handleGoalTool dispatcher for 6 goal CRUD operations with cascade delete support
- `app/api/mcp/route.ts` - Next.js route handler with POST (MCP), GET (405), DELETE (405)
- `lib/services/goal-service.ts` - Extended list() with optional skip/take pagination parameter
- `package.json` - Added @modelcontextprotocol/sdk as direct dependency

## Decisions Made
- Used `WebStandardStreamableHTTPServerTransport` (new in SDK v1.29) instead of the manual JSON-RPC dispatch approach the plan suggested as fallback. This transport accepts Web Standard `Request` and returns `Response`, which maps directly to Next.js App Router handlers without any bridge code.
- Kept the low-level `Server` class with raw JSON Schema definitions as the plan specified, even though SDK v1.29 now supports Zod v4 natively in `McpServer.registerTool`. This maintains the architecture subsequent plans depend on.
- Set `enableJsonResponse: true` on the transport to return clean JSON responses rather than SSE streams, matching the stateless tool server pattern.
- Extended `goalService.list()` signature with optional `{ skip?, take? }` parameter rather than calling Prisma directly from the tool handler, keeping the service layer as the single data access point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added cascade delete implementation for goal trees**
- **Found during:** Task 1 (goal-tools.ts implementation)
- **Issue:** The plan mentioned cascade delete for delete_goal but did not detail the recursive implementation
- **Fix:** Implemented recursive `deleteCascade` function that traverses children depth-first before deleting the parent
- **Files modified:** lib/mcp/tools/goal-tools.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 5f76dc0 (Task 1 commit)

**2. [Rule 3 - Blocking] Used WebStandardStreamableHTTPServerTransport instead of manual JSON-RPC dispatch**
- **Found during:** Task 2 (route handler implementation)
- **Issue:** The plan suggested manual JSON-RPC dispatch or Node.js transport bridge as approaches, but SDK v1.29 ships `WebStandardStreamableHTTPServerTransport` which accepts Web Standard Request/Response natively
- **Fix:** Used the Web Standard transport directly, eliminating the need for any bridge or manual dispatch code
- **Files modified:** app/api/mcp/route.ts
- **Verification:** TypeScript compiles cleanly, transport.handleRequest() returns Response directly
- **Committed in:** c62e482 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both changes improve the implementation. The cascade delete adds necessary functionality. The Web Standard transport simplifies the route handler significantly by eliminating bridge code the plan anticipated would be needed.

## Issues Encountered
None. SDK v1.29 resolved the Zod v3/v4 compatibility concern from research, and the WebStandardStreamableHTTPServerTransport eliminated the Next.js adapter complexity that was the primary technical risk.

## User Setup Required
None. No external service configuration required.

## Next Phase Readiness
- MCP protocol infrastructure is operational with auth, tool listing, and goal CRUD
- Subsequent plans (05-02 through 05-06) can register additional tool handlers by creating handler modules and adding routing in server.ts
- The transport and auth layers are complete and will not need modification

## Self-Check: PASSED

All created files verified on disk. Both task commits verified in git log. Summary file exists.

---
*Phase: 05-mcp-server*
*Completed: 2026-03-31*
