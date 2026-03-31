---
phase: 10-command-palette-and-data-management
plan: 4
subsystem: api, ui
tags: [pdfkit, docx, csv, markdown, pdf, export, data-portability]

# Dependency graph
requires:
  - phase: 10-command-palette-and-data-management
    provides: Settings page with ImportSection from Plan 10-03
provides:
  - Export service with JSON, CSV, Markdown, PDF, DOCX format functions
  - GET /api/export endpoint with format parameter and auth
  - ExportSection component with format dropdown and authenticated download
  - Shared export-helpers.ts eliminating CSV/Markdown duplication between MCP tools and export service
affects: []

# Tech tracking
tech-stack:
  added: [pdfkit, "@types/pdfkit", docx]
  patterns: [shared-export-helpers, blob-download-pattern, format-config-map]

key-files:
  created:
    - lib/services/export-helpers.ts
    - lib/services/export-service.ts
    - app/api/export/route.ts
    - components/settings/export-section.tsx
  modified:
    - next.config.ts
    - lib/mcp/tools/data-tools.ts
    - app/(app)/settings/page.tsx
    - package.json

key-decisions:
  - "Extracted CSV/Markdown formatting to shared export-helpers.ts for zero duplication between MCP tools and export service"
  - "Used FORMAT_CONFIG map pattern in API route for clean format dispatch"
  - "Blob download via fetch with Bearer token since anchor tags cannot set Authorization headers"
  - "Buffer to Uint8Array conversion for NextResponse body compatibility with binary formats"

patterns-established:
  - "Shared export helpers: CSV/Markdown formatting in lib/services/export-helpers.ts, imported by both data-tools.ts and export-service.ts"
  - "Blob download: fetch with auth, create blob URL, programmatic anchor click, revoke URL"

requirements-completed: [DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-08]

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 10 Plan 4: Data Export Summary

**Five-format export service (JSON, CSV, Markdown, PDF with progress bars, DOCX with checkboxes) with settings page UI and authenticated download endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T15:36:18Z
- **Completed:** 2026-03-31T15:40:55Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created export service supporting all five formats: JSON (full backup), CSV (spreadsheet), Markdown (readable), PDF (visual report with progress bars), and DOCX (document with Unicode checkboxes)
- Built settings page ExportSection with format dropdown and authenticated blob download
- Extracted shared export-helpers.ts eliminating CSV/Markdown formatting duplication between MCP data-tools and the new export service
- Added pdfkit to serverExternalPackages for correct standalone build font bundling

## Task Commits

Each task was committed atomically:

1. **Task 1: Install libraries, create export service, and add API endpoint** - `923968d` (feat)
2. **Task 2: Export section UI on settings page** - `ceb3a66` (feat)

## Files Created/Modified
- `lib/services/export-helpers.ts` - Shared CSV escape, formatCSV, and formatMarkdown functions
- `lib/services/export-service.ts` - Five export format functions (JSON, CSV, Markdown, PDF, DOCX)
- `app/api/export/route.ts` - GET endpoint with format parameter, auth, and correct Content-Type/Disposition
- `components/settings/export-section.tsx` - Format dropdown and authenticated download button
- `next.config.ts` - Added pdfkit to serverExternalPackages
- `lib/mcp/tools/data-tools.ts` - Refactored to import from shared export-helpers
- `app/(app)/settings/page.tsx` - Added ExportSection below ImportSection with space-y-6

## Decisions Made
- Extracted CSV and Markdown formatting to a shared export-helpers.ts file rather than keeping them private in data-tools.ts. Both the MCP tool handler and the export service import from this shared location, eliminating duplication.
- Used a FORMAT_CONFIG map in the API route for clean dispatch rather than a switch statement. Each format entry specifies the function, content type, and filename in one object.
- Implemented blob download pattern (fetch with Bearer token, blob URL, programmatic anchor click) because native anchor tags cannot set Authorization headers.
- Converted Buffer to Uint8Array for NextResponse body compatibility since Node Buffer is not directly assignable to BodyInit in the Next.js web API types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] McpContent type removed during refactor**
- **Found during:** Task 1
- **Issue:** When replacing the local CSV/Markdown functions with imports from export-helpers, the McpContent type definition was also removed because it was in the same block.
- **Fix:** Re-added the McpContent type definition after the imports.
- **Files modified:** lib/mcp/tools/data-tools.ts
- **Verification:** tsc --noEmit passed
- **Committed in:** 923968d (Task 1 commit)

**2. [Rule 1 - Bug] Buffer not assignable to NextResponse BodyInit**
- **Found during:** Task 1
- **Issue:** TypeScript error: `Buffer` is not assignable to `BodyInit | null | undefined` in NextResponse constructor.
- **Fix:** Added `Uint8Array` conversion for binary data: `const body = typeof data === "string" ? data : new Uint8Array(data);`
- **Files modified:** app/api/export/route.ts
- **Verification:** tsc --noEmit passed
- **Committed in:** 923968d (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for TypeScript correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed type errors above.

## User Setup Required
None. No external service configuration required.

## Next Phase Readiness
- Export functionality complete alongside the import from Plan 10-03, providing full data portability
- Settings page now has both Import and Export sections
- Plan 10-05 (final plan in phase) can proceed

---
*Phase: 10-command-palette-and-data-management*
*Completed: 2026-03-31*
