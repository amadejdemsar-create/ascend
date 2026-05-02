# Implementation Tasks: Wave 5 — Databases + properties

**PRD:** [PRD.md](./PRD.md)
**Sized:** 14-20 working days at the cadence Waves 0-4 hit.
**Phase count:** 14. Each phase ends with a green build and a focused commit.

Order matters within a phase. Phases 1-2 are sequential (everything depends on schema + service). Phases 3-13 are parallelizable in pairs. Phase 14 is the wave close.

## Phase 1: Schema + Zod schemas + migrations

- [ ] **1.1** Update `apps/web/prisma/schema.prisma`: add `DATABASE` and `RECORD` to `ContextEntryType` enum. Add `DATABASE_RELATION` to `ContextLinkType` enum.
- [ ] **1.2** Add `DatabaseFieldType` and `DatabaseViewType` enums.
- [ ] **1.3** Add `Database`, `DatabaseField`, `DatabaseRow`, `DatabaseView` models per the PRD shape. Add `databaseFieldId` nullable column + relation to `ContextLink`. Add `database`, `databaseRow` relations on `User` model.
- [ ] **1.4** Hand-write migration `20260502_extend_context_entry_type` with `ALTER TYPE ... ADD VALUE 'DATABASE'; ADD VALUE 'RECORD';`. Apply via `prisma migrate deploy` (NOT `migrate dev` — see CLAUDE.md safety rule 6 and `ax:migrate` skill).
- [ ] **1.5** Hand-write migration `20260502_extend_context_link_type` with `ALTER TYPE ... ADD VALUE 'DATABASE_RELATION';`.
- [ ] **1.6** Hand-write migration `20260502_create_database_models` — `CREATE TYPE` for the two new enums, `CREATE TABLE` for the four models, FK constraints, indexes, the `databaseFieldId` ALTER on `ContextLink`. Include `CHECK (octet_length(properties::text) <= 524288)` on `DatabaseRow`.
- [ ] **1.7** Hand-write migration `20260502_extend_search_vector_for_records` — `CREATE OR REPLACE FUNCTION` for the existing trigger, extending it to concatenate text-extractable property values from `RECORD` entries' linked `DatabaseRow.properties`. Use `setweight(to_tsvector(...), 'B')` for property text. **GIN index untouched.** Run `ax:migrate` and delegate the SQL review to `ascend-migration-auditor`.
- [ ] **1.8** Run `npx prisma generate` to refresh the client. Commit migration files.
- [ ] **1.9** Add `packages/core/src/schemas/databases.ts`:
  - Discriminated-union `databaseFieldSchema` keyed on `type` (one branch per `DatabaseFieldType`). Each branch validates the type-specific `config`.
  - Factory `databaseRowPropertiesSchema(fields)` that returns a Zod object schema constructed from the field list. Used by the service layer for write-time validation.
  - `databaseViewConfigSchema` per `DatabaseViewType` (table: column widths, hidden, frozen primary; board: groupByFieldId; calendar: dateFieldId; gallery: coverFieldId, visiblePropertyIds; timeline: startFieldId, endFieldId, zoom).
  - `filterSchema` (recursive AND/OR via `z.lazy`).
  - `sortSchema`.
  - Per-property-type size caps (TEXT 100k chars, URL 2k, EMAIL 320, PHONE 30).
- [ ] **1.10** Re-export from `packages/core/src/schemas/index.ts` and `apps/web/lib/validations.ts`.
- [ ] **1.11** Run `pnpm typecheck` and `pnpm build`. Both must pass before commit.
- [ ] **Commit:** `feat(db): Wave 5 Phase 1 — Database/DatabaseField/DatabaseRow/DatabaseView schema + migrations + Zod schemas`.

## Phase 2: Formula engine

- [ ] **2.1** Create `apps/web/lib/formula/lexer.ts` — tokenizer producing `Token[]`. Tokens: NUMBER, STRING, IDENTIFIER, OPERATOR (`+ - * / % == != < <= > >= and or not`), LPAREN, RPAREN, COMMA, EOF.
- [ ] **2.2** Create `apps/web/lib/formula/ast.ts` — node types: `Literal`, `PropRef`, `Binary`, `Unary`, `Call`, `Conditional`. Discriminated union.
- [ ] **2.3** Create `apps/web/lib/formula/parser.ts` — recursive-descent parser with precedence climbing for `+ - * / % comparison and or`. Reject expressions over 1000 AST nodes. Return `ParseResult` (success or `ParseError` with offset).
- [ ] **2.4** Create `apps/web/lib/formula/functions.ts` — registry: `concat(...args)`, `if(cond, t, f)`, `today()`, `now()`, `dateAdd(date, n, unit)`, `dateDiff(a, b, unit)`, `length(s)`, `upper(s)`, `lower(s)`. Use `date-fns` for date math.
- [ ] **2.5** Create `apps/web/lib/formula/evaluator.ts` — visit-AST evaluator with 10k op counter, 50ms wall-clock timeout, recursion depth cap of 50. Returns a `FormulaResult` discriminated union (`number | string | Date | boolean | { error: string }`). Coerces between numeric/date/string lazily.
- [ ] **2.6** Create `apps/web/lib/formula/dependencies.ts` — `extractDependencies(ast): string[]` returning all `prop()` references. Used by Phase 6 to detect cycles in the field dependency graph.
- [ ] **2.7** Create `apps/web/lib/formula/index.ts` — public API: `parseFormula`, `evaluateFormula`, `extractDependencies`.
- [ ] **2.8** Add a fixture file `apps/web/lib/formula/__test__/fixtures.ts` (12+ expressions covering arithmetic precedence, date ops, string ops, conditionals, error cases). Add a `__test__/round-trip.ts` script (Node-runnable, like `packages/editor`'s) that asserts every fixture parses + evaluates correctly. Add `@types/node` to `apps/web` if not already there.
- [ ] **2.9** Decide formula-engine location: keep in `apps/web/lib/formula/` for v1 vs move to `packages/formula/`. Run `ascend-architect` on the question: do we need it on mobile in Wave 6? Default: keep in `apps/web` until proven otherwise. If moved, run `ax:cross-platform-check`.
- [ ] **2.10** Run `pnpm typecheck` and `pnpm build`. Both must pass.
- [ ] **Commit:** `feat(formula): Wave 5 Phase 2 — formula parser + evaluator + dependency tracker`.

## Phase 3: Service layer

- [ ] **3.1** Create `apps/web/lib/services/database-service.ts`:
  - `create(userId, name, parentEntryId?)` — `prisma.$transaction([create ContextEntry of type DATABASE, create Database, create primary "Name" field of type TEXT, create default Table view])`. Returns the database with fields and views.
  - `getById(userId, id)` — fetch with fields, views.
  - `list(userId)`.
  - `update(userId, id, { name?, defaultViewId? })`.
  - `delete(userId, id)` — cascade. Pre-delete: bulk delete `ContextLink` rows where `databaseFieldId` IN (this database's field IDs) per DZ-16.
- [ ] **3.2** Create `apps/web/lib/services/database-field-service.ts`:
  - `add(userId, databaseId, { name, type, config? })` — auto-position to end. If `type === FORMULA`, parse expression at write time + cycle-check via `extractDependencies` against existing fields.
  - `update(userId, fieldId, { name?, config?, position? })` — metadata-only; never rewrites row property values. If config or formula expression changed, re-cycle-check.
  - `delete(userId, fieldId, { force? })` — strips the field from every row's `properties` JSONB. If RELATION, bulk deletes corresponding `ContextLink` rows. Refuses if `isPrimary` (return 400 with helpful error).
  - `changeType(userId, fieldId, newType)` — only allows safe coercions (TEXT → URL/EMAIL/PHONE if values valid; otherwise lists offending row IDs and refuses unless `force`). Documented in PRD.
- [ ] **3.3** Create `apps/web/lib/services/database-row-service.ts`:
  - `create(userId, databaseId, properties?)` — `prisma.$transaction([create ContextEntry of type RECORD, create DatabaseRow, create empty BlockDocument])`. Validates `properties` against the database's field list. Auto-position to end.
  - `update(userId, rowId, propertiesPatch)` — fetches the database's fields, builds the per-row Zod schema, validates patch, merges into `properties`, writes. If RELATION fields changed, calls `databaseRelationService.diffAndApply()`.
  - `delete(userId, rowId)` — cascade the entry.
  - `reorderManual(userId, databaseId, orderedRowIds)` — batch update positions in one transaction.
- [ ] **3.4** Create `apps/web/lib/services/database-view-service.ts`:
  - `create`, `update`, `delete`, `setDefault`. Validate `config` against `databaseViewConfigSchema(viewType)`.
- [ ] **3.5** Create `apps/web/lib/services/database-relation-service.ts`:
  - `diffAndApply(userId, rowId, fieldId, oldRelations, newRelations)` — computes `added` and `removed` arrays, writes `ContextLink` rows in a single transaction (use raw SQL for the bulk delete per DZ-16).
  - `getBacklinks(userId, rowEntryId)` — returns incoming `DATABASE_RELATION` links grouped by source `databaseId` and source `databaseFieldId`.
- [ ] **3.6** Create `apps/web/lib/services/database-query-service.ts`:
  - `query(userId, databaseId, { viewId?, filter?, sort?, page = 1, perPage = 200 })`:
    1. Fetches rows scoped by `userId` + `databaseId`, capped at `perPage`.
    2. Applies filter via Prisma where + raw JSONB ops where needed (JSONB contains for SELECT/MULTI, JSONB equals for atoms, range comparisons for NUMBER/DATE in JSONB cast). Build the `where` clause programmatically from the filter AST.
    3. Applies sort: prefer DB-side sort for top-level columns; fallback to in-memory sort for FORMULA columns and for JSONB property sorts that don't translate cleanly.
    4. Evaluates FORMULA columns per row using the cached AST.
    5. Returns `{ rows, total, page, perPage }`.
  - `count(userId, databaseId, filter?)`.
- [ ] **3.7** Run `pnpm typecheck` and `pnpm build`. Both must pass.
- [ ] **Commit:** `feat(services): Wave 5 Phase 3 — database/field/row/view/relation/query services`.

## Phase 4: API routes

- [ ] **4.1** Create `apps/web/app/api/databases/route.ts`:
  - `GET` — `databaseService.list(userId)`.
  - `POST` — `createDatabaseSchema.parse(body)` → `databaseService.create(userId, ...)`.
- [ ] **4.2** Create `apps/web/app/api/databases/[id]/route.ts`:
  - `GET`, `PATCH` (rename + setDefaultView), `DELETE`.
- [ ] **4.3** Create `apps/web/app/api/databases/[id]/fields/route.ts` (`POST`).
- [ ] **4.4** Create `apps/web/app/api/databases/[id]/fields/[fieldId]/route.ts` (`PATCH`, `DELETE`).
- [ ] **4.5** Create `apps/web/app/api/databases/[id]/rows/route.ts`:
  - `POST` — create.
  - `GET` — query with `?viewId=…`, `?filter=…`, `?sort=…`, `?page`, `?perPage`. URL-decode and JSON-parse `filter` and `sort`. Validate via `filterSchema` and `sortSchema`. Hand off to `databaseQueryService.query`.
- [ ] **4.6** Create `apps/web/app/api/databases/[id]/rows/[rowId]/route.ts` (`PATCH`, `DELETE`).
- [ ] **4.7** Create `apps/web/app/api/databases/[id]/rows/reorder/route.ts` (`POST`).
- [ ] **4.8** Create `apps/web/app/api/databases/[id]/views/route.ts` (`POST`).
- [ ] **4.9** Create `apps/web/app/api/databases/[id]/views/[viewId]/route.ts` (`PATCH`, `DELETE`).
- [ ] **4.10** All routes follow `apps/web/.claude/rules/api-route-patterns.md` (auth → parse → service → respond). All errors via `handleApiError`.
- [ ] **4.11** Run `ascend-security` on the route surface. Confirm no `userId` leaks (Wave 4 had two HIGH findings; Wave 5 must be PASS or PASS WITH NOTES).
- [ ] **4.12** Run `pnpm typecheck` and `pnpm build`. Both must pass.
- [ ] **Commit:** `feat(api): Wave 5 Phase 4 — database CRUD + query + view routes`.

## Phase 5: React Query keys + hooks

- [ ] **5.1** Extend `apps/web/lib/queries/keys.ts` with a `databases` namespace: `databases.all()`, `databases.detail(id)`, `databases.fields(id)`, `databases.views(id)`, `databases.rows(id, viewId? | filter+sort hash)`.
- [ ] **5.2** Create `apps/web/lib/hooks/use-databases.ts`:
  - `useDatabase(id)`, `useDatabases()`, `useCreateDatabase()`, `useUpdateDatabase()`, `useDeleteDatabase()`.
- [ ] **5.3** Create `apps/web/lib/hooks/use-database-fields.ts`:
  - `useFields(databaseId)`, `useAddField()`, `useUpdateField()`, `useDeleteField()`.
- [ ] **5.4** Create `apps/web/lib/hooks/use-database-rows.ts`:
  - `useDatabaseRows(databaseId, { viewId?, filter?, sort? })` — primary read hook.
  - `useCreateRow()`, `useUpdateRow()`, `useDeleteRow()`, `useReorderRows()`.
- [ ] **5.5** Create `apps/web/lib/hooks/use-database-views.ts`:
  - `useDatabaseViews(databaseId)`, `useCreateView()`, `useUpdateView()`, `useDeleteView()`.
- [ ] **5.6** Cross-domain invalidation per the PRD table. Mutations that touch RELATION fields invalidate `queryKeys.contextLinks.all()` and `queryKeys.context.graph()`. All mutations that create/delete rows invalidate `queryKeys.context.lists()` and `queryKeys.context.search()`.
- [ ] **5.7** Run `pnpm typecheck` and `pnpm build`. Both must pass.
- [ ] **Commit:** `feat(hooks): Wave 5 Phase 5 — database React Query hooks + cache invalidation`.

## Phase 6: Property editors (per field type)

Each editor lives in `apps/web/components/databases/property-editors/` and exports two modes: `Cell` (compact, for Table view) and `Expanded` (full, for the row detail panel).

- [ ] **6.1** `text-editor.tsx` — single-line input in Cell mode, multi-line `<textarea>` in Expanded.
- [ ] **6.2** `number-editor.tsx` — `<input type="number">` with thousands separator on display.
- [ ] **6.3** `date-editor.tsx` — `react-day-picker` (already a dep).
- [ ] **6.4** `select-editor.tsx` — dropdown with the field's options. Add new option inline.
- [ ] **6.5** `multi-select-editor.tsx` — chip input with autocomplete from options.
- [ ] **6.6** `relation-editor.tsx` — autocomplete searching the target database's rows (or all entries if unscoped). Multi-pick. Renders selected as `WikiLinkPill`-styled chips.
- [ ] **6.7** `formula-display.tsx` — read-only; renders the evaluated value with a tooltip showing the expression. `#ERROR` styling on errors.
- [ ] **6.8** `user-editor.tsx` — picker showing the current user only (single-user mode); ready for Wave 8 multi-user.
- [ ] **6.9** `checkbox-editor.tsx` — square checkbox.
- [ ] **6.10** `rating-editor.tsx` — N stars (configurable max from `config.max`).
- [ ] **6.11** `url-editor.tsx` — input + clickable link affordance in Cell mode (small external-link icon).
- [ ] **6.12** `email-editor.tsx` — input + `mailto:` affordance.
- [ ] **6.13** `phone-editor.tsx` — input + `tel:` affordance.
- [ ] **6.14** `file-editor.tsx` — file picker via `useUploadFile` (Wave 4); shows uploaded files as chips with the existing `FileCard` mini-mode.
- [ ] **6.15** Create `apps/web/components/databases/property-editors/index.tsx` — `getPropertyEditor(fieldType, mode)` dispatcher used by Table cells and the row properties panel.
- [ ] **6.16** Run `pnpm typecheck` and `pnpm build`. Both must pass.
- [ ] **Commit:** `feat(ui): Wave 5 Phase 6 — 14 property editors (Cell + Expanded modes)`.

## Phase 7: Table view

- [ ] **7.1** Add `@tanstack/react-table` and `@tanstack/react-virtual` dependencies (~50KB combined).
- [ ] **7.2** Create `apps/web/components/databases/table-view/table-view.tsx` — virtualized table with TanStack Table. Sticky header. Sticky primary column.
- [ ] **7.3** Create `apps/web/components/databases/table-view/table-header-cell.tsx` — sortable, resizable, draggable, kebab menu (rename, change type, hide, delete, sort asc, sort desc, filter by this column).
- [ ] **7.4** Create `apps/web/components/databases/table-view/table-cell.tsx` — dispatches to the right `Cell` editor by field type. Click → editor opens in place; Enter / Esc / blur commits.
- [ ] **7.5** Create `apps/web/components/databases/table-view/table-add-row.tsx` — sticky bottom row with "+ Add row".
- [ ] **7.6** Create `apps/web/components/databases/table-view/table-add-column.tsx` — popover anchored to "+" at the right of the header. Form: name + type picker; type-specific config fields appear conditionally (SELECT options, RELATION target, FORMULA expression, RATING max).
- [ ] **7.7** Hook up column resize → updates `view.config.columnWidths`. Column reorder → updates `view.config.columnOrder`. Hide → updates `view.config.hiddenFieldIds`. All persist via `useUpdateView`.
- [ ] **7.8** Manual sort: drag a row by its handle → `useReorderRows()` patches positions. Optimistic update. Disabled when a non-manual sort is active.
- [ ] **7.9** Wrap Table view in an error boundary (DZ-7).
- [ ] **7.10** Run `pnpm typecheck` and `pnpm build`.
- [ ] **Commit:** `feat(ui): Wave 5 Phase 7 — Table view with virtualization, inline edit, column ops`.

## Phase 8: Board view

- [ ] **8.1** Add `@dnd-kit/core` and `@dnd-kit/sortable` dependencies.
- [ ] **8.2** Create `apps/web/components/databases/board-view/board-view.tsx` — column container, drag context. Group rows by `view.config.groupByFieldId` (must point to a SELECT or MULTI_SELECT field).
- [ ] **8.3** Create `board-column.tsx` — header (group value + count), card list, "+ Add" at bottom. Adding pre-fills the group property.
- [ ] **8.4** Create `board-card.tsx` — primary field name + 2-3 visible properties (configured via `view.config.visiblePropertyIds`). Click → opens row detail.
- [ ] **8.5** DnD: drag card to another column → `useUpdateRow` patches the SELECT/MULTI_SELECT property. Optimistic update; revert on error.
- [ ] **8.6** Empty state: if no SELECT field exists, show a "Pick or add a SELECT/MULTI-SELECT field to group by" affordance.
- [ ] **8.7** Wrap in error boundary.
- [ ] **8.8** Run `pnpm typecheck` and `pnpm build`.
- [ ] **Commit:** `feat(ui): Wave 5 Phase 8 — Board view with drag-between-columns`.

## Phase 9: Calendar view

- [ ] **9.1** Create `apps/web/components/databases/calendar-view/database-calendar-view.tsx` — month grid grouped by `view.config.dateFieldId` (must point to a DATE field).
- [ ] **9.2** Create `calendar-row-chip.tsx` — draggable chip showing the row's primary field. Stack chips inside a date cell with overflow ("+ N more").
- [ ] **9.3** Create `calendar-day-detail.tsx` — popover showing all rows on a given date with click-to-open.
- [ ] **9.4** DnD: drag a chip to another date → `useUpdateRow` patches the DATE property.
- [ ] **9.5** Month nav (prev / next / today buttons in the view header).
- [ ] **9.6** Empty state if no DATE field exists.
- [ ] **9.7** Wrap in error boundary.
- [ ] **9.8** Run `pnpm typecheck` and `pnpm build`.
- [ ] **Commit:** `feat(ui): Wave 5 Phase 9 — Calendar view`.

## Phase 10: Gallery view

- [ ] **10.1** Create `apps/web/components/databases/gallery-view/gallery-view.tsx` — responsive grid (1-5 cols by viewport width).
- [ ] **10.2** Create `gallery-card.tsx` — cover from `view.config.coverFieldId` (FILE or URL). Renders the first FILE as `<img>` via Wave 4's `/api/files/[id]` route, or the URL via fetched OpenGraph image fallback to a generic placeholder. Below cover: primary + visible properties.
- [ ] **10.3** Cover field config dropdown in the view header.
- [ ] **10.4** Click card → opens row detail.
- [ ] **10.5** Wrap in error boundary.
- [ ] **10.6** Run `pnpm typecheck` and `pnpm build`.
- [ ] **Commit:** `feat(ui): Wave 5 Phase 10 — Gallery view`.

## Phase 11: Timeline view

- [ ] **11.1** Create `apps/web/components/databases/timeline-view/timeline-view.tsx` — horizontal scrollable canvas with day/week/month zoom controls.
- [ ] **11.2** Create `timeline-axis.tsx` — top axis with date labels at the chosen granularity.
- [ ] **11.3** Create `timeline-bar.tsx` — bar per row; left edge anchored to `startFieldId`, right edge to `endFieldId`. Drag bar → moves both. Drag left edge → resizes start. Drag right edge → resizes end.
- [ ] **11.4** Empty state if both start and end DATE fields aren't configured.
- [ ] **11.5** DnD: drag bar / edge → `useUpdateRow` patches the DATE property. Optimistic update.
- [ ] **11.6** Wrap in error boundary.
- [ ] **11.7** Run `pnpm typecheck` and `pnpm build`.
- [ ] **Commit:** `feat(ui): Wave 5 Phase 11 — Timeline view`.

## Phase 12: Filter + sort builder

- [ ] **12.1** Create `apps/web/components/databases/view-config/filter-builder.tsx` — recursive UI for AND/OR groups. Each clause: field picker, operator picker (filtered by field type), value editor (reuses property editors). "+ Add clause" and "+ Add group" buttons. Drag-to-nest (optional v1).
- [ ] **12.2** Create `view-config/sort-builder.tsx` — list of `{fieldId, direction}` clauses with up/down/remove and add.
- [ ] **12.3** Create `view-config/view-config-popover.tsx` — wraps filter, sort, hidden-field toggles, group-by selector (Board), date-field selector (Calendar), cover-field selector (Gallery), start/end-field selectors (Timeline).
- [ ] **12.4** Wire the popover into each view's header so the user can configure inline.
- [ ] **12.5** Apply changes optimistically; persist via `useUpdateView`.
- [ ] **12.6** Run `pnpm typecheck` and `pnpm build`.
- [ ] **Commit:** `feat(ui): Wave 5 Phase 12 — filter + sort + view config builders`.

## Phase 13: Database detail + row detail integration + slash menu + MCP tools

- [ ] **13.1** Create `apps/web/components/databases/database-detail.tsx` — top-level component when an entry of type DATABASE is opened. Mounts `DatabaseViewSwitcher` + the active view component.
- [ ] **13.2** Modify `apps/web/components/context/context-entry-detail.tsx` (or equivalent detail panel) so that:
  - Entries of type DATABASE render `DatabaseDetail` instead of the block editor.
  - Entries of type RECORD render a `DatabaseRowProperties` panel above the block editor.
- [ ] **13.3** Create `apps/web/components/databases/database-row-properties.tsx` — properties panel using `Expanded` editors for every field on the row's database.
- [ ] **13.4** Create `apps/web/components/databases/database-relation-backlinks.tsx` — on a row's detail, lists incoming RELATION links via `databaseRelationService.getBacklinks` grouped by source database.
- [ ] **13.5** Add a `Database` slash-menu item in `apps/web/components/editor/slash-menu-plugin.tsx` — inserts a child entry of type DATABASE, links it inline via wikilink, navigates to it.
- [ ] **13.6** Add a "Database" option to the `/context` New button dropdown so users can create top-level databases.
- [ ] **13.7** Create `apps/web/lib/mcp/tools/database-tools.ts` with the 10 tools per the PRD. Each handler validates args via the corresponding Zod schema from `@ascend/core` and returns `McpContent`. userId from server factory.
- [ ] **13.8** Add JSON Schemas in `apps/web/lib/mcp/schemas.ts` for all 10 tools.
- [ ] **13.9** Add `DATABASE_TOOL_NAMES` Set + routing in `apps/web/lib/mcp/server.ts`. Update tool count comments: 58 → 68. Update the count in CLAUDE.md.
- [ ] **13.10** Run `ascend-security` on the new MCP tools surface.
- [ ] **13.11** Run `pnpm typecheck` and `pnpm build`. Both must pass.
- [ ] **Commit:** `feat(ui+mcp): Wave 5 Phase 13 — database detail + row detail + slash menu + 10 MCP tools (58 → 68)`.

## Phase 14: Wave close

- [ ] **14.1** Run `/ax:test`. tsc + build must pass.
- [ ] **14.2** Run `/ax:review` against the cumulative wave diff via `ascend-reviewer`. Address any FAIL items.
- [ ] **14.3** Run `/ax:verify-ui` via `ascend-ui-verifier` with the success-test scenario from the PRD (create Books database, add 7 fields, 5 rows, switch all 5 views, filter, sort, edit cell, board drag, calendar drag, timeline resize, search hits row, MCP `query_database` returns rows).
- [ ] **14.4** Run `/ax:critique` via `ascend-critic`. Verdict must be GOOD or WORLD-CLASS to close. Address any must-fix items.
- [ ] **14.5** Push to `origin/main`. Wait for Dokploy auto-deploy. Smoke test in production:
  - `GET /api/mcp tools/list` returns 68.
  - All 10 new MCP tools listed.
  - Create a real database via the UI, populate, verify all 5 views work.
  - `query_database` MCP call returns expected rows.
  - Hybrid search returns row content.
- [ ] **14.6** Update `CLAUDE.md`: add Architecture subsection "Databases (Wave 5)" alongside the existing Block Editor and File storage subsections; add `Database`, `DatabaseField`, `DatabaseRow`, `DatabaseView` rows to the Entity Model table; add a row for Database views in the Views table; add Key File Lookup entries for the new files; document new danger zones (DZ-14 formula CPU/memory, DZ-15 JSONB property bloat, DZ-16 RELATION cascade explosion).
- [ ] **14.7** Update `.ascendflow/BACKLOG.md` with Wave 5 ship summary + carry-overs (rollups, synced databases, templates, CSV import/export, external integrations, footer aggregations).
- [ ] **14.8** Write `.ascendflow/features/context-v2/wave-5-databases-and-properties/CLOSE-OUT.md` per the Wave 4 template: criteria audit, critic verdict, pre-deploy checklist, Wave 6 onramp.
- [ ] **14.9** Final commit: `chore(wave-5): close Wave 5 — databases and properties shipped`.

## Verification phase (already covered by Phase 14 above)

Phase 14 is the verification phase. The wave does not close without:

- `pnpm typecheck` PASS
- `pnpm build` PASS
- `ascend-reviewer` PASS or PASS WITH NOTES (no FAIL)
- `ascend-security` PASS or PASS WITH NOTES on new routes + MCP tools
- `ascend-migration-auditor` PASS on all four Wave 5 migrations
- `ascend-ui-verifier` PASS on every view via Playwright with a real database
- `ascend-critic` GOOD or WORLD-CLASS

Run `/ax:review` after every phase. Run `/ax:test` before every commit. Run `/ax:deploy-check` before every push to main.
