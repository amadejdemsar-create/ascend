---
phase: 10-command-palette-and-data-management
plan: 03
subsystem: api, ui
tags: [import, json, file-upload, settings, react-query, data-migration]

requires:
  - phase: 05-mcp-server
    provides: Import logic patterns (format detection, category mapping, horizon sorting)
  - phase: 02-app-shell-and-goal-management
    provides: Goal and category services, React Query hooks, API auth pattern
provides:
  - POST /api/import endpoint with old format detection and partial failure tolerance
  - Shared import helpers module (isOldTodosFormat, migrateOldFormat, HORIZON_ORDER)
  - ImportSection component with file upload and status feedback
  - Settings page with data import section
affects: [10-command-palette-and-data-management]

tech-stack:
  added: []
  patterns: [shared-helper-extraction, file-upload-via-hidden-input, collapsible-error-list]

key-files:
  created:
    - lib/services/import-helpers.ts
    - app/api/import/route.ts
    - components/settings/import-section.tsx
  modified:
    - lib/mcp/tools/data-tools.ts
    - app/(app)/settings/page.tsx

key-decisions:
  - "Extracted import helpers to shared module rather than duplicating logic between MCP tools and API route"
  - "File upload uses hidden input triggered by button for cleaner UI without native file input styling"
  - "Collapsible error list using base-ui Collapsible for partial import failure visibility"

patterns-established:
  - "Shared helper extraction: when MCP tools and API routes need the same logic, extract to lib/services/"

requirements-completed: [DATA-01]

duration: 2min
completed: 2026-03-31
---

# Phase 10 Plan 03: Data Import Summary

**JSON data import via /api/import endpoint with old todos.json format detection, shared import helpers extracted from MCP tools, and settings page with file upload UI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T15:31:08Z
- **Completed:** 2026-03-31T15:33:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted isOldTodosFormat, migrateOldFormat, and HORIZON_ORDER into a shared import helpers module, eliminating duplication between MCP data tools and the new API route
- Created POST /api/import endpoint that detects old todos.json format automatically, maps category and goal IDs, sorts by horizon for parent-before-child ordering, and tolerates per-item failures
- Built ImportSection component with file upload, loading spinner, success count display, collapsible error list, and React Query cache invalidation
- Updated settings page from placeholder to functional layout with Import Data section

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared import helpers and create import API endpoint** - `051317d` (feat)
2. **Task 2: Import section UI and settings page** - `c6c25fa` (feat)

## Files Created/Modified
- `lib/services/import-helpers.ts` - Shared format detection and migration functions
- `app/api/import/route.ts` - POST endpoint for JSON data import with auth, format detection, ID mapping
- `components/settings/import-section.tsx` - Client component with file upload, loading state, success/error feedback
- `lib/mcp/tools/data-tools.ts` - Updated to import from shared helpers instead of defining locally
- `app/(app)/settings/page.tsx` - Replaced placeholder with functional settings layout containing ImportSection

## Decisions Made
- Extracted import helpers to shared module rather than duplicating logic between MCP tools and API route
- File upload uses a hidden input triggered by a button for cleaner UI without native file input styling
- Collapsible error list using base-ui Collapsible for partial import failure visibility

## Deviations from Plan

None. Plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness
- Settings page is ready for Plan 10-04 to add the Export section alongside the existing Import section
- Shared import helpers module available for any future import functionality

## Self-Check: PASSED

- All 5 files verified present on disk
- Commit 051317d (Task 1) verified in git log
- Commit c6c25fa (Task 2) verified in git log

---
*Phase: 10-command-palette-and-data-management*
*Completed: 2026-03-31*
