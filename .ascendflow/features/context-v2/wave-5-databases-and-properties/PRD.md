# Wave 5: Databases + properties

**Slug:** `context-v2` / `wave-5-databases-and-properties`
**Created:** 2. 5. 2026
**Status:** planning
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W5 section ~line 365)
**Wave sizing:** 4-5 weeks per VISION; target 14-20 working days at the cadence Waves 0-4 hit.

## Problem

Ascend has notes, todos, goals, the calendar, the graph, the block editor, and files. What it does not have is **structured data**. A user cannot model a CRM, a reading list, a media tracker, a wine cellar, a research-log, a sales pipeline, an expense ledger, or any other "rows-with-fields" workflow. Every Notion competitor has databases; without them Ascend is "almost a personal OS" but always one step short for users who think in tables.

Wave 5 introduces databases as a first-class node type, with typed fields, multiple views, full filter/sort/formula semantics, and many-to-many relations that flow through the existing graph substrate. Each database is a node. Each row is a node. Both are searchable, linkable, embeddable, and addressable as wikilinks. The database is not a separate world; it IS the graph, with a typed schema overlay.

## User Story

As a user, I want to model any structured workflow as a typed database with fields, views, filters, sorts, and formulas, so that I can replace external trackers (CRM in HubSpot, reading list in Notion, expense log in a spreadsheet) with native Ascend rows that participate in the same graph as my notes, goals, and todos. As an AI agent connected via MCP, I want to query a user's databases by filter, create rows, edit fields, and reshape schemas, so I can manage structured data on the user's behalf.

## Success Criteria

### Functional

- [ ] **`Database` entity** — a `ContextEntry` of type `DATABASE` with a linked `Database` row carrying schema metadata. Wikilinkable, graph-visible, search-indexed.
- [ ] **`DatabaseRow` entity** — every row is a `ContextEntry` of type `RECORD` with a linked `DatabaseRow` row carrying typed property values. Each row has a block-editor body (its `BlockDocument`) for free-form notes.
- [ ] **14 field types fully implemented**: `text`, `number`, `date`, `select`, `multi-select`, `relation`, `formula`, `user`, `checkbox`, `rating`, `url`, `email`, `phone`, `file`. Each with a write-time Zod validator and an inline cell editor.
- [ ] **5 views fully implemented**: `Table`, `Board`, `Calendar`, `Gallery`, `Timeline`. Each persists view-specific config (filter, sort, hidden fields, group-by, cover field, date-range fields) on a `DatabaseView` row.
- [ ] **Formula engine v1** — recursive-descent parser + evaluator; functions: `+`, `-`, `*`, `/`, `%`, comparison `< <= > >= == !=`, logical `and or not`, `concat()`, `if(cond, t, f)`, `today()`, `now()`, `dateAdd(date, n, unit)`, `dateDiff(a, b, unit)`, `length()`, `upper()`, `lower()`, `prop("field name")`. Server-side evaluation on read; client-side evaluation cached. Dependency tracker re-evaluates on dependent property change.
- [ ] **Many-to-many relations** — RELATION fields use the existing `ContextLink` table with a new `DATABASE_RELATION` type and a `databaseFieldId` denormalized column. Bidirectional automatically via incoming/outgoing queries. Backlink panel on related rows shows incoming relations grouped by source database.
- [ ] **Filter builder (Notion-style)** — multi-clause with AND/OR group nesting, per-field-type operator set (TEXT: equals/contains/starts_with/ends_with/is_empty; NUMBER: equals/gt/lt/gte/lte/between/is_empty; DATE: equals/before/after/on_or_before/on_or_after/between/is_empty/today/this_week/this_month; SELECT/MULTI: equals/not_equals/contains_any/contains_all/is_empty; CHECKBOX: equals; RELATION: contains/not_contains/is_empty; USER: equals/is_me; URL/EMAIL/PHONE: equals/contains/is_empty; RATING: equals/gt/lt/is_empty; FILE: is_empty/is_not_empty). Persisted per view.
- [ ] **Sort builder** — multi-clause `[{ fieldId, direction }]`, persisted per view. Plus manual sort (drag rows in Table view) writes a `position` field.
- [ ] **Inline cell editing** — click a cell in Table view → in-place editor for that property (text input, number input, date picker, select dropdown, multi-select chips, relation autocomplete, checkbox, rating stars, URL/email/phone fields with validation, file picker, formula display read-only).
- [ ] **Add/edit/delete columns** in Table view via header context menu and a new "Add column" affordance.
- [ ] **Add row** via inline "+ Add row" at table bottom and via the slash menu on database entries.
- [ ] **Row detail panel** — click row → opens existing context entry detail panel (because each row IS a `ContextEntry`); shows a "Properties" section above the block editor with the same property editors as inline cells.
- [ ] **Column resize, reorder, hide/show** in Table view.
- [ ] **Group-by Board view** — group rows by SELECT or MULTI_SELECT field; drag card between columns updates the property; "+" at column bottom creates a new row pre-filled with that group value.
- [ ] **Calendar view** — month grid grouped by a chosen DATE field; rows render as chips on the date; drag chip to a different date updates the property.
- [ ] **Gallery view** — grid of cards; configurable cover field (FILE or URL); shows top-N visible properties under cover; click card → opens row detail.
- [ ] **Timeline view** — horizontal gantt-style timeline using two DATE fields (start, end); drag to move; drag edges to resize.
- [ ] **View switcher** — per-database tab strip showing all views; "+ Add view" creates a new view with a default config for that view type.
- [ ] **10 new MCP tools (round 5)**: `create_database`, `add_field`, `update_field`, `delete_field`, `create_row`, `update_row`, `delete_row`, `create_view`, `update_view`, `query_database`. Tool count: **58 → 68**.
- [ ] **Database participates in graph** — DATABASE-type entries appear as nodes in the graph view (already automatic via `ContextEntry`). RECORD-type entries also appear. RELATION fields render as typed edges.
- [ ] **Hybrid search includes rows** — RECORD entries' property values (text fields, formula outputs) are indexed into `extractedText` so the existing tsvector + semantic search find them.
- [ ] **No data loss on schema changes** — deleting a field warns before drop; renaming a field is a metadata-only operation; changing a field type prompts the user to confirm a coercion (e.g., TEXT → NUMBER fails on non-parseable values, surfaces a list of affected rows).

### Quality

- [ ] **Table view renders 1k rows in <500ms** with virtualization (`@tanstack/react-virtual` or equivalent).
- [ ] **Filter + sort applied within 100ms** for databases up to 10k rows. Beyond 10k, paginate at 200 per page.
- [ ] **Formula evaluation completes within 50ms** for typical row sets (100 rows, 5 formula fields).
- [ ] **Inline cell editor opens within 50ms** of click.
- [ ] **Drag operations (column reorder, board card drag, timeline drag) feel instant** — optimistic update at <16ms, reconciliation in background.
- [ ] **`tsc --noEmit` and `pnpm build` pass with zero errors at every commit.**
- [ ] **`ascend-security` audit on database routes: PASS.** userId scoping on every Prisma query touching `Database`, `DatabaseField`, `DatabaseRow`, `DatabaseView`. JSON property values validated against the typed schema before persistence; raw JSONB never trusted.
- [ ] **`ascend-migration-auditor` PASS** on the four migrations (enum extensions on `ContextEntryType` and `ContextLinkType`, `Database/DatabaseField/DatabaseRow/DatabaseView` tables, search_vector trigger extension for RECORD content, indexes).
- [ ] **`ascend-architect` PASS** on any new shared package (likely none; database logic stays in `apps/web`. Formula engine could live in `packages/formula/` if useful for mobile later — defer to Phase 2 review).
- [ ] **`ascend-critic` verdict at GOOD or WORLD-CLASS at wave close.**
- [ ] **`ax:verify-ui` PASS** on every view (Table, Board, Calendar, Gallery, Timeline) with a real database created mid-test.

### Cross-platform readiness

- [ ] **Mobile (Wave 6) consumes Table, Board, Gallery views as read + simple-edit.** Calendar and Timeline ship later if needed. Property editors share schemas via `@ascend/core`.
- [ ] **Formula engine is platform-agnostic.** Pure TS; no DOM/Node dependencies; should compile under React Native without changes.
- [ ] **Filter and sort schemas live in `@ascend/core`** so mobile reuses the validators.

## Affected Layers

- **Prisma schema:**
  - `ContextEntryType` enum extended with `DATABASE` and `RECORD`.
  - `ContextLinkType` enum extended with `DATABASE_RELATION`.
  - New `Database` model: `id`, `userId`, `contextEntryId @unique`, `defaultViewId String?`, `createdAt`, `updatedAt`.
  - New `DatabaseField` model: `id`, `userId`, `databaseId`, `name`, `type` (DatabaseFieldType enum), `position Int`, `config Json` (type-specific: select options, formula expression, relation target databaseId, rating max), `isPrimary Boolean`, timestamps. `@@unique([databaseId, position])` and `@@index([databaseId])`.
  - New `DatabaseRow` model: `id`, `userId`, `databaseId`, `contextEntryId @unique`, `position Int`, `properties Json`, timestamps. `@@index([databaseId])`.
  - New `DatabaseView` model: `id`, `userId`, `databaseId`, `name`, `type` (DatabaseViewType enum), `config Json` (filters, sorts, hidden field IDs, group-by field ID, cover field ID, calendar date field ID, timeline start/end field IDs), `position Int`, timestamps. `@@index([databaseId])`.
  - `ContextLink` extended with optional `databaseFieldId String?` (nullable FK to DatabaseField) so RELATION-derived links know which field they came from. `@@index([databaseFieldId])`.
  - New enums: `DatabaseFieldType` (TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, RELATION, FORMULA, USER, CHECKBOX, RATING, URL, EMAIL, PHONE, FILE) and `DatabaseViewType` (TABLE, BOARD, CALENDAR, GALLERY, TIMELINE).

- **Packages:**
  - `@ascend/core` (`packages/core/src/schemas/`): new `databases.ts` with `databaseSchema`, `databaseFieldSchema` per field type (discriminated union on `type`), `databaseRowPropertiesSchema` factory (takes the field list, returns a Zod schema for the row's property bag), `databaseViewConfigSchema` per view type, `filterSchema` (recursive AND/OR), `sortSchema`. Re-exported into `apps/web/lib/validations.ts`.
  - **Decision pending:** evaluate moving the formula engine into `packages/formula/` for mobile reuse. Default in v1: keep in `apps/web/lib/formula/`; revisit at Phase 6 review.

- **Service layer (`apps/web/lib/services/`):**
  - `databaseService.ts` (new) — CRUD on `Database`. `create(userId, name, parentEntryId?)` creates a `ContextEntry` of type `DATABASE` AND a `Database` row AND a default `Table` view AND a primary `text` field, all in a single `prisma.$transaction`. `delete(userId, id)` cascades. Plus rename, list, get.
  - `databaseFieldService.ts` (new) — CRUD on fields. `add`, `update`, `delete`, `reorder`, `changeType` (with coercion validation). `update` is metadata-only (rename/options) and does NOT rewrite property values. `delete` removes the field AND strips the field from every row's `properties` JSON.
  - `databaseRowService.ts` (new) — CRUD on rows. `create(userId, databaseId, properties?)` creates a `ContextEntry` of type `RECORD` + `DatabaseRow` + linked `BlockDocument` for the body, in a transaction. `update(userId, rowId, propertiesPatch)` validates the patch against the field schemas before writing. `delete` cascades the entry. Plus `reorderManual` for drag-sort.
  - `databaseViewService.ts` (new) — CRUD on views. `create`, `update`, `delete`, `setDefault`.
  - `databaseQueryService.ts` (new) — the read engine. `query(userId, databaseId, viewIdOrConfig, page, perPage)` applies filter + sort + pagination, returns rows with computed formula values. Server-side filter pushdown via Prisma + raw SQL where needed (JSONB contains/equals operators).
  - `databaseRelationService.ts` (new) — RELATION field handling. On row property write, diffs the relation array, creates/removes `ContextLink` rows of type `DATABASE_RELATION` with the `databaseFieldId` column set. Backlink queries.
  - `formulaService.ts` (new) — wraps `apps/web/lib/formula/` for service-level use; cycle detection on field dependency graph.

- **Formula module (`apps/web/lib/formula/`):**
  - `lexer.ts` — tokenizer (numbers, strings, identifiers, operators, parens, commas).
  - `parser.ts` — recursive-descent parser → AST.
  - `ast.ts` — AST node types.
  - `evaluator.ts` — interprets AST against a property bag + field metadata. Returns a `FormulaResult` discriminated union (number/string/date/boolean/error).
  - `dependencies.ts` — extracts `prop("name")` references from an AST; used to build the field dependency graph.
  - `functions.ts` — built-in function registry: `concat`, `if`, `today`, `now`, `dateAdd`, `dateDiff`, `length`, `upper`, `lower`.
  - `index.ts` — public API: `parseFormula(expr)`, `evaluateFormula(ast, ctx)`, `extractDependencies(ast)`.
  - 100% pure TS, no DOM/Node imports.

- **API routes (`apps/web/app/api/databases/`):**
  - `POST /api/databases` — create.
  - `GET /api/databases` — list (user's databases).
  - `GET /api/databases/[id]` — fetch with fields, views, default view config.
  - `PATCH /api/databases/[id]` — rename, set default view.
  - `DELETE /api/databases/[id]` — cascade delete.
  - `POST /api/databases/[id]/fields` — add field.
  - `PATCH /api/databases/[id]/fields/[fieldId]` — update field (rename, change type, reorder).
  - `DELETE /api/databases/[id]/fields/[fieldId]` — delete field.
  - `POST /api/databases/[id]/rows` — create row.
  - `GET /api/databases/[id]/rows` — query rows (`viewId?`, inline `filter` + `sort`, `page`, `perPage`). Returns rows with computed formula values.
  - `PATCH /api/databases/[id]/rows/[rowId]` — update row properties (Zod-validated patch).
  - `DELETE /api/databases/[id]/rows/[rowId]` — delete row.
  - `POST /api/databases/[id]/rows/reorder` — manual drag-sort batch update.
  - `POST /api/databases/[id]/views` — create view.
  - `PATCH /api/databases/[id]/views/[viewId]` — update view config.
  - `DELETE /api/databases/[id]/views/[viewId]` — delete view.

- **React Query hooks (`apps/web/lib/hooks/use-databases.ts`):**
  - `useDatabase(id)`, `useDatabases()`, `useCreateDatabase()`, `useUpdateDatabase()`, `useDeleteDatabase()`.
  - `useFields(databaseId)`, `useAddField()`, `useUpdateField()`, `useDeleteField()`.
  - `useDatabaseRows(databaseId, viewId?, filterOverride?, sortOverride?)` — the primary read hook with auto-refetch.
  - `useCreateRow()`, `useUpdateRow()`, `useDeleteRow()`, `useReorderRows()`.
  - `useDatabaseViews(databaseId)`, `useCreateView()`, `useUpdateView()`, `useDeleteView()`.
  - Cross-domain cache invalidation: every mutation invalidates `queryKeys.databases.*` AND `queryKeys.context.*` (because rows are entries) AND `queryKeys.context.search` AND (if RELATION write) `queryKeys.contextLinks.*` AND `queryKeys.context.graph`.

- **UI components (`apps/web/components/databases/`):**
  - `database-detail.tsx` — top-level component when an entry of type DATABASE is opened. Shows view tab strip, view-specific renderer, "Add view" button, "Add field" button.
  - `database-view-switcher.tsx` — pill tabs for each view + "+" to add.
  - `database-view-renderer.tsx` — switch on view type, render the appropriate view component.
  - **Table view (`table-view/`):**
    - `table-view.tsx` — virtualized table.
    - `table-header-cell.tsx` — sortable, resizable, draggable, with kebab menu (rename, change type, hide, delete).
    - `table-row.tsx` — keyed by row id.
    - `table-cell.tsx` — dispatches to the cell editor by field type.
    - `table-add-row.tsx` — inline "+ Add row" at the bottom.
    - `table-add-column.tsx` — "+" button at the right of header.
  - **Board view (`board-view/`):**
    - `board-view.tsx` — column container, drag context.
    - `board-column.tsx` — group header, draggable cards, "+ Add" at bottom.
    - `board-card.tsx` — minimal property summary (primary + 2-3 visible).
  - **Calendar view (`calendar-view/`):**
    - `database-calendar-view.tsx` — month grid (reuse `apps/web/components/calendar/calendar-month-grid.tsx` shell).
    - `calendar-row-chip.tsx` — draggable chip in a date cell.
    - `calendar-day-detail.tsx` — popover showing all rows on that date.
  - **Gallery view (`gallery-view/`):**
    - `gallery-view.tsx` — responsive card grid.
    - `gallery-card.tsx` — cover + property summary.
  - **Timeline view (`timeline-view/`):**
    - `timeline-view.tsx` — horizontal scrollable canvas with day/week/month zoom.
    - `timeline-bar.tsx` — draggable + resizable bar per row.
    - `timeline-axis.tsx` — top axis with dates.
  - **Property editors (`property-editors/`):** one component per field type. `text-editor.tsx`, `number-editor.tsx`, `date-editor.tsx`, `select-editor.tsx`, `multi-select-editor.tsx`, `relation-editor.tsx`, `formula-display.tsx`, `user-editor.tsx`, `checkbox-editor.tsx`, `rating-editor.tsx`, `url-editor.tsx`, `email-editor.tsx`, `phone-editor.tsx`, `file-editor.tsx`. Each has a compact "cell" mode for Table view and an "expanded" mode for the row detail panel.
  - **Filter + sort builder:**
    - `filter-builder.tsx` — recursive clause UI, AND/OR groups, per-field operator menu, value input by type.
    - `sort-builder.tsx` — list of `{field, direction}` clauses with add/remove/reorder.
    - `view-config-popover.tsx` — wraps both, plus hidden-field toggles, group-by selector, etc.
  - **Row detail integration:**
    - `database-row-properties.tsx` — properties panel mounted above the block editor on the row detail. Reuses property editors in expanded mode.
  - **Database backlinks panel:**
    - `database-relation-backlinks.tsx` — on a row's detail, lists incoming RELATION links grouped by source database.

- **MCP tools (`apps/web/lib/mcp/tools/database-tools.ts`):**
  - `create_database(name, parentEntryId?)`
  - `add_field(databaseId, name, type, config?)`
  - `update_field(fieldId, name?, config?, position?)`
  - `delete_field(fieldId, force?)`
  - `create_row(databaseId, properties?)`
  - `update_row(rowId, propertiesPatch)`
  - `delete_row(rowId)`
  - `create_view(databaseId, name, type, config?)`
  - `update_view(viewId, name?, config?)`
  - `query_database(databaseId, viewIdOrConfig?, filter?, sort?, page?, perPage?)`

- **Zustand store:** `lib/stores/ui-store.ts` extended with `databaseViewState` keyed by `databaseId` (active view id, transient unsaved filter/sort overrides). Persisted via `@ascend/storage` adapter so view state survives reloads.

- **Cron / queues:** none new in Wave 5.

## Data Model Changes

```prisma
enum ContextEntryType {
  NOTE      // existing
  SOURCE    // existing
  PROJECT   // existing
  PERSON    // existing
  DECISION  // existing
  QUESTION  // existing
  AREA      // existing
  DATABASE  // NEW — a typed collection
  RECORD    // NEW — a row in a database
}

enum ContextLinkType {
  // ... existing 9 values
  DATABASE_RELATION  // NEW — derived from a RELATION field on a row
}

enum DatabaseFieldType {
  TEXT
  NUMBER
  DATE
  SELECT
  MULTI_SELECT
  RELATION
  FORMULA
  USER
  CHECKBOX
  RATING
  URL
  EMAIL
  PHONE
  FILE
}

enum DatabaseViewType {
  TABLE
  BOARD
  CALENDAR
  GALLERY
  TIMELINE
}

model Database {
  id              String        @id @default(cuid())
  userId          String
  contextEntryId  String        @unique
  defaultViewId   String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  contextEntry    ContextEntry  @relation(fields: [contextEntryId], references: [id], onDelete: Cascade)
  fields          DatabaseField[]
  rows            DatabaseRow[]
  views           DatabaseView[]

  @@index([userId])
}

model DatabaseField {
  id          String              @id @default(cuid())
  userId      String
  databaseId  String
  name        String
  type        DatabaseFieldType
  position    Int
  config      Json                @default("{}")
  isPrimary   Boolean             @default(false)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  database    Database            @relation(fields: [databaseId], references: [id], onDelete: Cascade)

  @@unique([databaseId, position])
  @@index([databaseId])
  @@index([userId])
}

model DatabaseRow {
  id              String        @id @default(cuid())
  userId          String
  databaseId      String
  contextEntryId  String        @unique
  position        Int
  properties      Json          @default("{}")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  database        Database      @relation(fields: [databaseId], references: [id], onDelete: Cascade)
  contextEntry    ContextEntry  @relation(fields: [contextEntryId], references: [id], onDelete: Cascade)

  @@index([databaseId])
  @@index([userId])
}

model DatabaseView {
  id          String              @id @default(cuid())
  userId      String
  databaseId  String
  name        String
  type        DatabaseViewType
  config      Json                @default("{}")
  position    Int
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  database    Database            @relation(fields: [databaseId], references: [id], onDelete: Cascade)

  @@index([databaseId])
  @@index([userId])
}

model ContextLink {
  // ... existing fields preserved
  databaseFieldId  String?         // NEW — non-null for DATABASE_RELATION links
  databaseField    DatabaseField?  @relation(fields: [databaseFieldId], references: [id], onDelete: Cascade)

  @@index([databaseFieldId])
}
```

**Migrations (4 hand-written, applied via `prisma migrate deploy`):**

1. `20260502_extend_context_entry_type` — `ALTER TYPE "ContextEntryType" ADD VALUE 'DATABASE'; ADD VALUE 'RECORD';`
2. `20260502_extend_context_link_type` — `ALTER TYPE "ContextLinkType" ADD VALUE 'DATABASE_RELATION';`
3. `20260502_create_database_models` — `CREATE TABLE Database, DatabaseField, DatabaseRow, DatabaseView` + indexes + enum types `DatabaseFieldType`, `DatabaseViewType`.
4. `20260502_extend_search_vector_for_records` — extend Wave 3's `tsvector_update_trigger` to also concatenate the user-extractable string properties of `RECORD` entries (text, URL, email, phone, formula-string-result) into `extractedText` when a row's properties are updated. **DZ-2: hand-written `CREATE OR REPLACE FUNCTION`; the existing GIN index is untouched.**

## API Contract

(Routes spec'd above. Each follows the standard Ascend pattern: `authenticate()` → `schema.parse(body)` → `service.method(userId, ...)` → `NextResponse.json(...)`.)

### Inline filter/sort syntax (`GET /api/databases/[id]/rows`)

```
GET /api/databases/abc123/rows
  ?viewId=view123                  # if present, use view's filter+sort, else inline
  &filter={ "combinator": "AND",
            "clauses": [ { "fieldId": "f1", "op": "equals", "value": "Done" } ] }
  &sort=[{"fieldId":"f2","direction":"desc"}]
  &page=1&perPage=200
```

Filter and sort are JSON-stringified and URL-encoded. `page` is 1-indexed.

### Property patch shape (`PATCH /api/databases/[id]/rows/[rowId]`)

```json
{ "properties": { "<fieldId>": <value>, "<fieldId>": <value> } }
```

`null` clears the property. Server validates each value against the corresponding field's Zod schema before persisting.

## UI Flows

### Creating a database

1. User opens `/context`, types `/db` in the slash menu inside any entry's block editor (slash menu item: `Database` → creates a child entry of type DATABASE, links it inline) OR clicks "New" on the toolbar and picks "Database" type from the dropdown.
2. Backend creates the entry + database + default Table view + primary "Name" text field in one transaction.
3. UI navigates to the new database. Empty Table renders with the primary column and an "Add column" affordance.

### Adding a column

1. Click "Add column" header affordance. Popover opens.
2. Enter name, pick type, configure type-specific options (SELECT options, RELATION target database, RATING max, FORMULA expression).
3. Submit. Column appears.

### Adding a row

1. Click "+ Add row" at the bottom of Table view, or click "+" inside a Board column.
2. Empty row appears, inline cell editor opens on primary field.
3. Type primary value, press Tab to move to next cell, fill out as needed.
4. Esc or click outside to commit.

### Editing a cell

1. Click cell. Inline editor opens by type (text input, date picker, select dropdown, etc.).
2. Edit. Enter or click outside commits. Esc cancels.

### Switching views

1. Click a view tab. Renderer swaps. Filter/sort applied to the new view's config.
2. "+" → choose view type → name → submit. Default config for that view type applied.

### Filter and sort

1. Click the "Filter" pill in the view header.
2. Filter builder popover: add clause, pick field, pick operator, enter value. Add another clause, pick AND or OR. Group clauses by selecting and clicking "Group".
3. Apply. Rows filter immediately. Filter persists on the view.
4. "Sort" pill works the same: add clause, pick field, pick direction.

### Relation field

1. Add a RELATION column. Pick target database (or "Any context entry").
2. In the cell, click → autocomplete opens. Type to search target database rows (or any entry if unscoped). Select to add. Multi-select is implicit: relations are arrays.
3. Each selected target gets a `ContextLink` of type `DATABASE_RELATION` with `databaseFieldId` set to this field's id.
4. On the related row's detail panel, a "Backlinks" section lists incoming relations grouped by source database.

### Formula field

1. Add a FORMULA column. Enter expression in the config: `if(prop("Status") == "Done", "✓", "")`.
2. Save. Formula evaluates per row immediately.
3. Errors show as `#ERROR` in the cell with a tooltip: "Unknown property: Statys (did you mean Status?)".

### Inline detail edit

1. Click anywhere on a row that's not a cell (e.g., the row's "open" affordance on hover).
2. Existing context entry detail panel opens. The "Properties" section above the block editor shows all fields in expanded editor mode.
3. Below the properties, the entry's `BlockDocument` body renders as a regular Lexical editor — users can write free-form notes attached to the row.

## Cache Invalidation

Every mutation invalidates the keys below. Mutations marked with [graph] also invalidate the graph view.

| Mutation | Invalidates |
|----------|-------------|
| createDatabase | `queryKeys.databases.all()`, `queryKeys.context.lists()`, `queryKeys.context.detail(parentEntryId)` if any [graph] |
| updateDatabase | `queryKeys.databases.detail(id)`, `queryKeys.databases.all()` |
| deleteDatabase | `queryKeys.databases.all()`, `queryKeys.context.lists()`, `queryKeys.context.search`, `queryKeys.contextLinks.all()` [graph] |
| addField | `queryKeys.databases.detail(id)`, `queryKeys.databases.rows(id)` |
| updateField | `queryKeys.databases.detail(id)`, `queryKeys.databases.rows(id)` |
| deleteField | `queryKeys.databases.detail(id)`, `queryKeys.databases.rows(id)`, `queryKeys.contextLinks.all()` if RELATION [graph] |
| createRow | `queryKeys.databases.rows(id)`, `queryKeys.context.lists()`, `queryKeys.context.search` |
| updateRow | `queryKeys.databases.rows(id)`, `queryKeys.context.detail(rowEntryId)`, `queryKeys.context.search`, `queryKeys.contextLinks.all()` if RELATION values changed [graph] |
| deleteRow | `queryKeys.databases.rows(id)`, `queryKeys.context.lists()`, `queryKeys.context.search`, `queryKeys.contextLinks.all()` [graph] |
| reorderRows | `queryKeys.databases.rows(id)` |
| createView | `queryKeys.databases.views(id)`, `queryKeys.databases.detail(id)` |
| updateView | `queryKeys.databases.views(id)` |
| deleteView | `queryKeys.databases.views(id)`, `queryKeys.databases.detail(id)` |

Cross-domain rule: any RELATION write triggers `queryKeys.contextLinks.all()` and `queryKeys.context.graph` invalidation because relations participate in the graph.

## Danger Zones Touched

- **DZ-2 (search_vector):** Migration #4 extends the existing trigger. Hand-written, additive `CREATE OR REPLACE FUNCTION`. GIN index untouched. Per CLAUDE.md safety rule 6.
- **DZ-7 (no error boundaries):** Each view (Table/Board/Calendar/Gallery/Timeline) wraps in an error boundary so a render failure on one view doesn't crash the entire `/context` page. Reuse the Wave 3 error boundary pattern.
- **DZ-9 (LLM cost runaway):** Wave 5 adds zero LLM calls. No new exposure.
- **NEW DZ-14 (Formula CPU/memory runaway):** A user could write a pathological formula (deeply nested recursion, huge concat). Mitigations: (1) parse-time AST size cap (1000 nodes); (2) evaluator step counter (10k op cap per evaluation); (3) recursion depth cap (50); (4) timeout (50ms wall-clock per evaluation); (5) `prop()` cycle detection at parse time on the field dependency graph (refuse to save a formula that introduces a cycle). All five must trip before a malicious formula can DOS the server.
- **NEW DZ-15 (JSONB property bloat):** A row's `properties` JSONB could grow unbounded if the user crams huge text values. Mitigations: (1) per-property type-specific size caps enforced in Zod (TEXT 100k chars, URL 2k, EMAIL 320, PHONE 30); (2) total properties JSON capped at 256 KiB at the service-layer pre-flight; (3) database CHECK constraint `octet_length(properties::text) <= 524288` (512 KiB ceiling). Rows that exceed the cap should put long content in the `BlockDocument` body, not in a property.
- **NEW DZ-16 (RELATION cascade explosion):** Deleting a database with N rows × M relation fields creates O(N*M) `ContextLink` deletes. Mitigation: relation delete uses raw SQL `DELETE FROM ContextLink WHERE databaseFieldId IN (...)` instead of per-row Prisma calls; cascade through Prisma `onDelete: Cascade` only as a backstop.

## Out of Scope

- **Notion-style "rollups"** (aggregate property: sum/avg/min/max/count of a relation's property). Useful but a v6 polish item.
- **Synced/duplicated databases** (linked databases that share schema across pages). Wave 8 multi-workspace territory.
- **Database templates / starter schemas** (CRM template, reading list template). Worth shipping later as a polish item; out of scope for v1.
- **CSV import / export** (creating a database from a CSV upload, exporting database-as-CSV). Distinct feature; defer.
- **External database integrations** (Notion API import, Airtable API import, Google Sheets sync). Distinct integration; defer.
- **Database-level permissions / sharing** (per-row visibility rules, per-view sharing). Wave 8 multi-user.
- **Aggregations in the table footer** (sum / count / average row at the bottom of a column). Polish item; defer.
- **Column types not in v1**: any future field type (rich-text-property, code-property, dependency-property). Add as needed.

## Open Questions

1. **Move formula engine to `packages/formula/`?** Pure TS, useful for mobile (Wave 6) and desktop (Wave 9+). Default in PRD: keep in `apps/web/lib/formula/`. Decide at Phase 6 review.
2. **TanStack Table vs. custom?** TanStack handles virtualization, sorting, column resize/reorder out of the box. Adds ~50KB. Custom is leaner but loses ~3 days. Default: **TanStack** for the Table view; custom for Board/Calendar/Gallery/Timeline (none of which fit a tabular library).
3. **Drag-and-drop library?** Codebase already uses React's native HTML5 DnD (in graph view). For Board view drag-between-columns and Timeline drag-resize, `@dnd-kit/core` is the de facto choice. Default: **add `@dnd-kit/core` as a new dep**. ~15KB.
4. **Calendar view: reuse the existing `apps/web/components/calendar/` or build separate?** The existing one is goal/todo-specific. Default: **build a separate `database-calendar-view.tsx` that shares only the month-grid CSS pattern**.
5. **`USER` field in single-user mode.** Today only one user exists. The field is technically functional (user picks themselves) but not useful until Wave 8. Default: **ship the field type, with the picker showing only the current user, so the schema is forward-compatible with multi-user**.
6. **Inline edit vs. modal for adding a column.** Default: **popover anchored to the "+" button**, not a modal. Less disruptive.

## Success Test (smoke at wave close)

User creates a "Books" database. Adds 7 fields: `Title` (TEXT, primary), `Author` (RELATION → existing People database), `Status` (SELECT: Reading / Finished / Abandoned), `Rating` (RATING 5), `Started` (DATE), `Finished` (DATE), `Days to read` (FORMULA: `dateDiff(prop("Finished"), prop("Started"), "days")`). Adds 5 rows. Switches between Table, Board (group by Status), Calendar (group by Started), Gallery (cover from a FILE field they add), Timeline (Started → Finished). Filters by `Status equals Finished AND Rating gte 4`. Sorts by `Finished desc`. Edits a cell inline. Drags a card from "Reading" to "Finished" in Board view. Opens a row → adds a markdown note in the block editor. The book's author entry shows the book in its backlinks panel under "Books". Searches "great gatsby" — the row appears in hybrid search. AI agent calls `query_database({ databaseId, filter: { ... } })` and gets the right rows.

If all of that works in production, Wave 5 is closed.
