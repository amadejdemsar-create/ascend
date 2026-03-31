---
phase: 05-mcp-server
plan: 06
subsystem: api
tags: [mcp, cors, json-rpc, integration-test, production-hardening, standalone-build]

# Dependency graph
requires:
  - phase: 05-mcp-server
    provides: MCP server factory, 22 tool definitions, 6 tool handler modules, /api/mcp endpoint
provides:
  - Production-ready MCP endpoint with CORS, request validation, batch support, and error boundary
  - Verified end-to-end MCP protocol roundtrip (initialize, tools/list, tools/call for all 22 tools)
  - Standalone Next.js build that correctly bundles the MCP SDK via serverExternalPackages
affects: [deployment, mcp-client-configuration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CORS headers with OPTIONS preflight for cross-origin MCP clients", "JSON-RPC error codes (-32700, -32600, -32603) for protocol-compliant error responses", "Batch request processing for JSON-RPC arrays", "serverExternalPackages for MCP SDK in standalone builds", "Request body reconstruction after .json() consumption for SDK transport"]

key-files:
  created: []
  modified:
    - app/api/mcp/route.ts
    - lib/mcp/server.ts
    - next.config.ts

key-decisions:
  - "Added serverExternalPackages for @modelcontextprotocol/sdk because webpack cannot resolve the SDK internal .js extension imports during standalone build tracing"
  - "Fixed .js extension imports in server.ts local tool module imports for webpack compatibility while keeping SDK imports with .js extensions (handled by serverExternalPackages)"
  - "Request body reconstruction pattern: since request.json() consumes the body stream, reconstruct with new Request() before passing to SDK transport"

patterns-established:
  - "CORS configuration pattern: shared CORS_HEADERS constant applied to all response paths including errors"
  - "JSON-RPC validation pipeline: Content-Type check, JSON parse, structure validation, then SDK processing"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08, MCP-09, MCP-10, MCP-11, MCP-12, MCP-13, MCP-14, MCP-15, MCP-16, MCP-17, MCP-18, MCP-19, MCP-20]

# Metrics
duration: 9min
completed: 2026-03-31
---

# Phase 5 Plan 6: MCP Integration Validation Summary

**Production-hardened MCP endpoint with CORS, JSON-RPC validation, batch support, and verified end-to-end protocol roundtrip across all 22 tools**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T11:25:13Z
- **Completed:** 2026-03-31T11:34:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added CORS headers, OPTIONS preflight handler, JSON-RPC error codes, request validation, batch request support, error boundary, and development logging to the MCP endpoint
- Fixed standalone build failure by adding serverExternalPackages and removing .js extensions from local imports
- Verified all 22 MCP tools via live curl integration tests: auth rejection, initialize handshake, tools/list, full CRUD cycle (create/get/update/delete/search/list), progress logging, category management, dashboard/stats/priorities/timeline, bulk complete, move goal, export (JSON/CSV/Markdown), import, and settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Production hardening, CORS, and standalone build verification** - `549a878` (feat)
2. **Task 2: End-to-end integration test via curl** - No commit (validation-only task, no source changes needed)

## Files Created/Modified
- `app/api/mcp/route.ts` - CORS headers, OPTIONS handler, JSON-RPC validation (-32700, -32600, -32603), batch request processing, error boundary, dev logging
- `lib/mcp/server.ts` - Fixed local import paths (removed .js extensions for webpack compatibility)
- `next.config.ts` - Added serverExternalPackages for @modelcontextprotocol/sdk

## Decisions Made
- Added `serverExternalPackages: ["@modelcontextprotocol/sdk"]` to next.config.ts because webpack standalone tracing could not resolve the SDK's internal `.js` extension imports. The SDK uses Node.js ESM conventions (`.js` suffixed imports) which webpack does not handle without this configuration.
- Fixed local tool module imports in `lib/mcp/server.ts` by removing `.js` extensions. While the MCP SDK's own `.js` imports are handled by `serverExternalPackages` (excluded from bundling), the local project imports needed to work with webpack's module resolution.
- Used a request body reconstruction pattern (creating a new `Request` after `request.json()` consumes the body) because the SDK's `transport.handleRequest()` needs a fresh request body to read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed .js extension imports in server.ts**
- **Found during:** Task 1 (standalone build verification)
- **Issue:** `lib/mcp/server.ts` used `.js` suffixed imports for local modules (e.g., `"./schemas.js"`, `"./tools/goal-tools.js"`). Webpack cannot resolve these since the actual files are `.ts`.
- **Fix:** Removed `.js` extensions from all local imports in server.ts. SDK imports kept their `.js` extensions since `serverExternalPackages` excludes them from webpack bundling.
- **Files modified:** lib/mcp/server.ts
- **Verification:** `npm run build` succeeds, standalone output includes MCP SDK
- **Committed in:** 549a878 (Task 1 commit)

**2. [Rule 3 - Blocking] Added serverExternalPackages for MCP SDK**
- **Found during:** Task 1 (standalone build verification)
- **Issue:** `npm run build` failed with "Module not found" errors because webpack tried to bundle the MCP SDK which uses Node.js ESM conventions internally
- **Fix:** Added `serverExternalPackages: ["@modelcontextprotocol/sdk"]` to next.config.ts
- **Files modified:** next.config.ts
- **Verification:** `npm run build` succeeds, `.next/standalone/node_modules/@modelcontextprotocol/sdk` exists
- **Committed in:** 549a878 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking issues)
**Impact on plan:** Both fixes were necessary for the production build to succeed. The plan anticipated this possibility and included the verification step that caught these issues.

## Issues Encountered
- The MCP SDK transport requires an `Accept: application/json, text/event-stream` header in requests, which is standard for MCP clients but was not obvious when writing manual curl tests. This is not a code issue; MCP clients (Claude Code, Cursor) send this header automatically.

## User Setup Required
None. No external service configuration required.

## Next Phase Readiness
- MCP server is production-ready with all 22 tools verified
- Phase 5 (MCP Server) is complete. The endpoint is ready for deployment at ascend.nativeai.agency/api/mcp
- CORS configuration allows cross-origin MCP clients to connect
- Standalone build includes all dependencies

## Self-Check: PASSED

All modified files verified on disk. Task 1 commit (549a878) verified in git log. Task 2 had no commits (validation only). Summary file exists.

---
*Phase: 05-mcp-server*
*Completed: 2026-03-31*
