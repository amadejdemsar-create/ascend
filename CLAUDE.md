# Ascend

Personal operating system built on the inputs/outputs framework. Goals are outputs (results you want), todos are inputs (actions that drive results), context is your AI knowledge base as a typed-edge graph, and the calendar ties it all into daily planning. The entire system is exposed via 79 MCP tools.

## Tech Stack

Next.js 16 (App Router), Prisma 7, PostgreSQL + pgvector, Zod 4, React 19, TanStack Query v5, Zustand 5, MCP SDK, rrule, date-fns, shadcn/ui, Tailwind CSS 4, lucide-react, canvas-confetti, marked, `@ascend/llm` (Gemini/OpenAI/Anthropic provider abstraction), `@ascend/editor` (Lexical nodes + Markdown round-trip), `@ascend/diff` (pure-TS version diff engine), Yjs (CRDT document state)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (catches TS errors, run before pushing)
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply a migration
npx prisma studio    # Visual database browser
```

## Safety Rules

1. **NEVER modify data without userId check.** Every Prisma query in services MUST include `userId` in the `where` clause (or be scoped by an unguessable internal secret like `refreshTokenHash` / `familyId` UUID, with justification in a code comment). The schema is multi-tenant; skipping this leaks data across users.
2. **NEVER skip Zod validation in API routes.** Every POST/PUT/PATCH body MUST be parsed through a schema from `apps/web/lib/validations.ts` (which re-exports from `@ascend/core`) before reaching the service layer.
3. **ALWAYS invalidate React Query cache after mutations.** Use `queryClient.invalidateQueries({ queryKey: queryKeys.<domain>.all() })`. Cross-domain invalidation is required when one mutation affects another domain (todo completion must invalidate `queryKeys.goals.all()` and `queryKeys.dashboard()`).
4. **ALWAYS use the service layer.** Never import `@/lib/db` or `@prisma/client` directly in API routes, middleware, components, hooks, or scripts. All database access goes through `apps/web/lib/services/`.
5. **ALWAYS run `pnpm --filter @ascend/web build` before pushing.** The build catches TypeScript errors that `pnpm dev` does not surface.
6. **NEVER run `prisma db push` or `prisma migrate reset`.** The `search_vector` tsvector column on ContextEntry was added via raw SQL migration and is invisible to Prisma. Schema-first operations will drop it and break full-text search. Wave 0 Phase 6 hand-wrote a migration and applied via `prisma migrate deploy` because `prisma migrate dev --create-only` attempted to DROP `search_vector`. When adding any future migration, either hand-write it or verify the generated SQL does not reference `search_vector` before applying.

## Execution Quality Bar (Ascend)

**The global `Execution Quality Bar (Mandatory)` rule in `~/.claude/CLAUDE.md` applies in full to every Ascend task. This section extends it with Ascend-specific quality checks. Both apply simultaneously.**

The standard is SpaceX engineering: if it is worth doing, it is worth doing right. No shortcuts, no half measures, no silent simplification. Amadej would rather you deliver 40% of a feature fully and transparently than 100% half-baked with gaps hidden.

### Before Starting Any Feature or Bug Fix

1. **Use `ax:plan` for anything that touches more than one file.** It produces a mandatory deliverables checklist (`.ascendflow/features/<slug>/TASKS.md`) and a PRD. No feature work starts without the checklist presented to the user and approved.
2. **Search the codebase for similar implementations first.** Before writing a new service method, hook, route, or component, Grep/Glob for the closest analog and read it end to end. The canonical references are:
   - Service method: read the closest method in `lib/services/<domain>-service.ts`
   - React Query hook: read `lib/hooks/use-goals.ts` for the `useMutation` + cache invalidation shape
   - API route: read any existing `app/api/**/route.ts` for the auth-parse-service-respond skeleton
   - Component: read `components/goals/goal-detail.tsx` (detail panel), `components/goals/goal-filter-bar.tsx` (filter), `components/goals/quick-add.tsx` (inline creation)
   - MCP tool: read `lib/mcp/schemas.ts` + `lib/mcp/tools/<domain>-tools.ts` + `lib/mcp/server.ts`
3. **Check `COMPONENT_CATALOG.md`** at `.claude/COMPONENT_CATALOG.md` before creating any new component. Duplicating existing components is the most common UI mistake.
4. **For UI-adjacent changes, plan to run `ax:verify-ui` before declaring done.** Any diff that touches `components/**`, `app/(app)/**`, `lib/hooks/**`, `lib/stores/**`, `lib/validations.ts`, `lib/api-client.ts`, or `lib/queries/keys.ts` must be verified end-to-end in a real browser via the `ascend-ui-verifier` agent (driven by Playwright). Type-checks and unit tests are not sufficient for the UI path.

### Ascend-Specific Quality Checks (mandatory before declaring done)

Every feature or fix must pass ALL of these before you may say "done":

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` passes with zero errors (this is safety rule 5; dev mode misses App Router route-level errors)
- [ ] Every Prisma query in touched services includes `userId` in the `where` clause
- [ ] Every touched POST/PUT/PATCH route parses the body through a Zod schema from `lib/validations.ts`
- [ ] Every touched mutation invalidates the correct query keys, including cross-domain invalidations
- [ ] No new direct imports of `@/lib/db` or `@prisma/client` outside `lib/services/`
- [ ] For UI-adjacent changes (`components/**`, `app/(app)/**`, `lib/hooks/**`, `lib/stores/**`, `lib/validations.ts`, `lib/api-client.ts`, `lib/queries/keys.ts`), `ax:verify-ui` returns PASS or PASS WITH NOTES with zero blocking scenarios. The verifier clicks through the app via Playwright, writes a report to `.ascendflow/verification/`, and surfaces runtime regressions, console errors, stale cache, and broken navigation that type-checks cannot catch. `ascend-ux` (visual design audits via chrome-devtools in Dia) and `ax:verify-ui` (behavioral verification via Playwright) are complementary: run `ax:verify-ui` for any behavioral change, `ascend-ux` for any visual polish.
- [ ] All relevant patterns from `.claude/rules/` followed (service-patterns, api-route-patterns, component-patterns, mcp-tool-patterns, accessibility)
- [ ] For any Prisma migration, run `ax:migrate` and delegate the SQL review to `ascend-migration-auditor`
- [ ] For any change to `packages/*`, run `ax:cross-platform-check` and delegate the audit to `ascend-architect`
- [ ] For any change to auth, file handling, or multi-tenant boundaries, delegate to `ascend-security`
- [ ] Before declaring a wave done, run `ax:critique` and require `ascend-critic` verdict at GOOD or WORLD-CLASS. NEEDS WORK or NOT READY blocks close.

### Forbidden Phrases When Any Check Fails

If the build fails, types fail, a safety rule is violated, or any item above is NOT DONE, you may NOT say:
- "Complete" / "All done" / "Finished" / "Ready to ship" / "Ready to deploy" / "Ready to commit"
- "Tests pass" (when TypeScript errors or build errors exist)
- "Approved" (from a reviewer when any FAIL exists)

You MUST say instead:
- "Partially complete. The build fails at X. Remaining: fix the type error in <file>:<line>, re-run `ax:test`."
- "Not ready to deploy. `ax:deploy-check` failed at step N because [reason]."

### Completion Checklist (mandatory)

Before declaring any feature or fix complete, re-list every task from the `TASKS.md` produced by `ax:plan` and mark each as: DONE / SKIPPED (with reason) / NOT DONE (with reason). If ANY are SKIPPED or NOT DONE, use "partially complete" and explain exactly what remains. This is the same pattern enforced by the global Execution Quality Bar and by `ax:deploy-check`.

## Mandatory Development Workflow

**CRITICAL: Claude is the orchestrator, not the implementor.** Never implement code changes directly. Claude reads the request, picks the right agents and skills, delegates the work, and synthesizes results. Direct code edits are only acceptable for trivial changes (constants, typos, config). Anything touching business logic, services, components, hooks, routes, or MCP tools MUST go through the appropriate agent.

### Agent Reference

| Agent | When to use | Tools |
|-------|-------------|-------|
| `ascend-dev` | Any code implementation: services, API routes, hooks, components, MCP tools, Prisma schema | Read, Write, Edit, Glob, Grep, Bash, WebFetch |
| `ascend-ux` | Visual design audits, layout reviews, design system checks, CSS/layout fixes (uses chrome-devtools in Dia) | Read, Glob, Grep, Write, Edit, Bash |
| `ascend-reviewer` | Code review against safety rules, pattern compliance, danger zone checks (DZ-1 through DZ-7) | Read, Glob, Grep, Bash |
| `ascend-ui-verifier` | End-to-end browser verification via Playwright after any UI change | Read, Bash, Grep, Glob, Write, Playwright MCP |
| `ascend-architect` | Cross-platform monorepo audits, `packages/*` boundaries, workspace config, platform-agnostic enforcement | Read, Glob, Grep, Bash |
| `ascend-migration-auditor` | Prisma migration safety: SQL review, search_vector verification, backfill plans, rollback paths | Read, Glob, Grep, Bash |
| `ascend-security` | Auth, multi-tenancy, userId scoping, secrets, file uploads, token handling audits | Read, Glob, Grep, Bash |
| `ascend-critic` | Product quality critique at wave close: UX friction, competitive parity, interaction coherence | Read, Glob, Grep |

### Required Workflow Steps

1. **Understand:** Read relevant files, check `.claude/COMPONENT_CATALOG.md`, search for similar implementations
2. **Plan:** Use `/ax:plan` for features touching 3+ files
3. **Implement:** Delegate to `ascend-dev` (or appropriate agent). For cross-surface features, launch multiple agents in parallel.
4. **Verify:** `/ax:test` after backend changes, `/ax:verify-ui` after frontend changes, `/ax:review` after any changes
5. **Report:** Summarize what changed, verification results, whether ready to commit

### Skill Reference

| Command | Purpose | When to use |
|---------|---------|-------------|
| `/ax:plan` | Feature planning pipeline | Before any multi-file feature (produces PRD + TASKS.md) |
| `/ax:test` | Type check + production build | After every code change, before declaring done |
| `/ax:review` | Safety rule + pattern compliance review | After implementation, before committing |
| `/ax:verify-ui` | Browser verification via Playwright | After any UI-adjacent change |
| `/ax:deploy-check` | Pre-deploy validation | Before pushing to main |
| `/ax:save` | Save session state | When context is running low or pausing work |
| `/ax:migrate` | Safe Prisma migration orchestrator | Any time `prisma/schema.prisma` is modified (replaces direct `prisma migrate dev`) |
| `/ax:package` | Scaffold a new monorepo package | When adding a new shared package under `packages/*` |
| `/ax:cross-platform-check` | Grep audit for banned imports in `packages/*` | After extracting code into or modifying a shared package |
| `/ax:wave-start` | Pre-flight check before starting a wave | At the beginning of every Context v2 wave |
| `/ax:wave-close` | Strict completion ritual for closing a wave | At the end of every wave, before starting the next |
| `/ax:critique` | Launch `ascend-critic` for product quality verdict | After `ax:verify-ui` passes, at wave close, before demos |

## Architecture

**Current scope:** pnpm monorepo shipped in Wave 0. The web app lives at `apps/web/`; shared packages live under `packages/*`. Future waves add `apps/mobile` (Expo) in Wave 6 and `apps/desktop` (Tauri) in Wave 9+. The 10-wave Context v2 roadmap is at `.ascendflow/features/context-v2/VISION.md`.

### Shared packages (`packages/*`)

- **`@ascend/core`**: Zod schemas, enums, constants. Pure TypeScript + Zod, platform-agnostic. Re-exported to `apps/web/lib/validations.ts` for web consumption.
- **`@ascend/api-client`**: platform-agnostic HTTP client with `createApiClient({ baseUrl, getAuthHeaders, fetch? })` factory. Uses `globalThis.fetch`. Throws `ApiError` on non-2xx. The web wrapper at `apps/web/lib/api-client.ts` adds cookie-based auth + offline guard + 401 refresh-and-retry interceptor.
- **`@ascend/storage`**: `StorageAdapter` interface + `webStorageAdapter` (localStorage-backed, SSR-safe). Used by Zustand stores so native and desktop apps can swap implementations.
- **`@ascend/ui-tokens`**: raw colors, spacing, typography, and radii tokens. No Tailwind dependency. `apps/web/tailwind.config.ts` imports from here.
- **`@ascend/llm`**: LLM provider abstraction. Exports `EmbeddingProvider` and `ChatProvider` interfaces, Gemini/OpenAI/Anthropic implementations, pricing tables, cost estimator, retry helper, and model catalog. Pure TypeScript + `globalThis.fetch`. Platform-agnostic (no Next/React/Prisma).
- **`@ascend/editor`**: Lexical node definitions (8 custom + built-in re-exports), CSS class-name theme, extended Markdown transformers (wikilinks, mentions, callouts, toggles), Markdown round-trip serializers (`markdownToBlocks`, `blocksToMarkdown`), and plain-text extraction (`extractText`). Pure TypeScript + Lexical. **Exception to cross-platform rule:** tsconfig includes `"lib": ["ES2022", "DOM"]` because Lexical's `DecoratorNode.createDOM()` and other node methods require DOM types at compile time. These types are never accessed at runtime in server/headless contexts. Mobile (Wave 6) consumes only the Markdown serialization layer, not the node classes, per `LEXICAL-SPIKE.md`.
- **`@ascend/diff`**: Pure-TS diff engine for versioning (Wave 7). Exports `diffNodeVersions(fromPayload, toPayload, nodeType): DiffResult`. Four strategies: block-diff (Lexical JSON tree), field-diff (key/value), property-diff (DatabaseRow type-aware), field-config-diff (DatabaseField). Uses `fast-diff` for text segments. No DOM/Node imports. 10/10 fixture tests pass.

### Service Layer (`apps/web/lib/services/`)
All business logic. Const objects with async methods. `userId` is always the first parameter. Services call Prisma directly. Modules: goal, todo, context, category, dashboard, gamification, export, import, recurring, todo-recurring, hierarchy-helpers, export-helpers, **auth (Phase 6)**, **file (Phase 7)**, user, **llm (Wave 2)**, **embedding (Wave 2)**, **context-map (Wave 2)**, **block-document (Wave 3)**, **block-migration (Wave 3)**, **versioning (Wave 7)**, **edge-event (Wave 7)**, **diff (Wave 7)**, **restore (Wave 7)**, **branch (Wave 7)**, **graph-history (Wave 7)**, **graph-snapshot (Wave 7)**, **retention-compactor (Wave 7)**.

### API Routes (`apps/web/app/api/`)
Thin wrappers: authenticate via `authenticate()` (3-path resolver: cookie JWT, Bearer JWT, Bearer API key; `validateApiKey` is a backward-compat alias), parse input with Zod, call service, return `NextResponse.json()`. Error handling via `handleApiError()` from `apps/web/lib/auth.ts`.

### React Query Hooks (`apps/web/lib/hooks/`)
One hook file per domain. `useQuery` for reads, `useMutation` for writes with `onSuccess` cache invalidation. Query key factory in `apps/web/lib/queries/keys.ts`. Cache config in `apps/web/lib/offline/cache-config.ts`. All fetches go through `apiFetch` from `apps/web/lib/api-client.ts`.

### MCP Server (`apps/web/lib/mcp/`)
76 tools across handler files (40 CRUD/dashboard + 7 Wave 1 graph tools: `get_context_graph`, `get_node_neighbors`, `get_related_context`, `list_nodes_by_type`, `create_typed_link`, `remove_typed_link`, `update_context_type` + 3 Wave 2 AI tools: `get_context_map`, `refresh_context_map`, `suggest_connections` + `detect_contradictions` and `summarize_subgraph` routed to `llm-tools.ts` = 50, + 5 Wave 3 block tools: `get_blocks`, `add_block`, `update_block`, `move_block`, `delete_block` = 55, + 3 Wave 4 file tools: `upload_file`, `get_file_content`, `list_files_by_type` = 58, + 10 Wave 5 database tools: `create_database`, `add_field`, `update_field`, `delete_field`, `create_row`, `update_row`, `delete_row`, `create_view`, `update_view`, `query_database` = 68, + 5 Wave 7 versioning tools: `list_versions`, `get_version`, `diff_versions`, `restore_version`, `branch_node` = 73, + 3 Wave 8 workspace tools: `list_workspaces`, `get_workspace`, `get_activity_events` = 76). Schemas in `apps/web/lib/mcp/schemas.ts` as raw JSON Schema (not Zod) for SDK compatibility. Handlers in `apps/web/lib/mcp/tools/` call the service layer. Routing in `apps/web/lib/mcp/server.ts` uses Set-based name matching to dispatch to handlers. Transport: Streamable HTTP at `/api/mcp`. Authenticated via API key through `authenticate()` — the API key path of the three.

### AI Layer (Wave 2)
- **`@ascend/llm`** (`packages/llm/`): platform-agnostic provider abstraction. Exports `EmbeddingProvider` (Gemini-only) and `ChatProvider` (Gemini, OpenAI, Anthropic) interfaces, a pricing table (`pricing.ts`), a cost estimator (`cost.ts`), a retry helper (`retry.ts`, capped exponential backoff, never retries 4xx), and a model catalog (`listModels(provider)`). No Next.js, React, or Prisma imports.
- **`llmService`** (`apps/web/lib/services/llm-service.ts`): resolves the user's selected provider + model from `UserSettings`, enforces the daily cost cap via `requestBudget()` (DZ-9 single gate), calls the provider, logs every call to `LlmUsage`.
- **`embeddingService`** (`apps/web/lib/services/embedding-service.ts`): wraps `GeminiEmbeddingProvider`. Generates 1536-dim vectors for `ContextEntry` rows via raw SQL (`Unsupported("vector(1536)")` in Prisma schema). Hooked into `contextService.create` and `contextService.update` for auto-embedding on content change. Provides `searchSemantic()` for pgvector cosine similarity search.
- **`contextMapService`** (`apps/web/lib/services/context-map-service.ts`): synthesizes a `{themes, principles, projects, tensions, orphans}` JSON payload from the user's entire context graph via the selected chat provider. Stored as a single `ContextMap` row per user (userId @unique, upsert on refresh). Chunked synthesis for graphs >200 nodes.
- **Cron:** nightly map refresh via GitHub Actions (`.github/workflows/nightly-map-refresh.yml`) hitting `POST /api/context/map/refresh` with `x-cron-secret` header (timing-safe compare). `CRON_SECRET` env in both Dokploy and GitHub Actions secrets.
- **Provider selection:** `UserSettings.chatProvider` (enum `GEMINI | OPENAI | ANTHROPIC`, default `GEMINI`) + `UserSettings.chatModel` (optional override). Settings UI at `/settings` with provider picker (green/amber availability dots) and model tier dropdown (Cheap / Balanced / Best).
- **Cost tracking:** every LLM call logged to `LlmUsage` table. Soft cap $2/day (warning toast), hard cap $10/day (refuses new calls). Usage panel at `/settings`.

### Block Editor (Wave 3)
- **`@ascend/editor`** (`packages/editor/`): platform-agnostic Lexical configuration. Exports 8 custom node classes (`WikiLinkNode`, `MentionNode`, `AIBlockNode`, `EmbedNode`, `CalloutNode`, `ToggleNode`, `FileNode`, `ImageNode`), re-exports built-in Lexical nodes, a CSS class-name theme, extended Markdown transformers (wikilinks, mentions, callouts, toggles), and `markdownToBlocks` / `blocksToMarkdown` round-trip serializers. `extractText(snapshot)` flattens a Lexical state to plain text for search indexing. 12/12 round-trip fixtures pass. Tsconfig includes `"lib": ["ES2022", "DOM"]` as the one exception in shared packages (Lexical's `createDOM()` interface requires DOM types at compile time; never accessed at runtime in server contexts).
- **`blockDocumentService`** (`apps/web/lib/services/block-document-service.ts`): CRUD on `BlockDocument`, Yjs state persistence, snapshot replacement, and LLM-friendly block tree manipulation (add, update, move, delete). Size-capped: 1 MiB on full state (DB CHECK constraint backstop), 256 KiB per update payload. Every method userId-scoped. Uses `prisma.$transaction` for atomic writes (BlockDocument + ContextEntry.extractedText).
- **`blockMigrationService`** (`apps/web/lib/services/block-migration-service.ts`): one-shot lazy migration of legacy `ContextEntry.content` markdown to a `BlockDocument`. Idempotent. Also handles external content rewrites (MCP `set_context` changing markdown regenerates the block doc).
- **Autosave (Phase 6a simplification):** snapshot-only sync. The client sends the full Lexical serialized editor state JSON alongside a minimal Yjs update. The server persists both. This is NOT full Yjs CRDT delta sync; Wave 8 collaboration will upgrade to `@lexical/yjs` V2 binding with real binary deltas. The Yjs binary format is preserved so the upgrade path is forward-compatible.
- **Web binding:** `apps/web/components/context/context-block-editor.tsx` mounts a `<LexicalComposer>` with 8 plugins (autosave, slash menu, inline toolbar, wikilink autocomplete, mention autocomplete, keyboard shortcuts, decorator, error boundary). The editor replaces the legacy markdown textarea on the `/context` entry detail panel.
- **Error boundary:** wraps `<ContextBlockEditor>`. On Lexical render failure, falls back to the legacy markdown textarea reading from `ContextEntry.content`. This is the first surface-level error boundary in the codebase.

### Auth (Phase 6 shipped in Wave 0)
- `apps/web/lib/services/auth-service.ts` owns scrypt password hashing, JWT signing/verification via `jose`, 256-bit opaque refresh tokens, `Session` rotation with reuse detection, in-process login rate limiter, cookie builders.
- `apps/web/app/api/auth/login`, `/refresh`, `/logout`, `/me` are the HTTP surface.
- `apps/web/middleware.ts` gates HTML page requests with edge `jose.jwtVerify`, redirects to `/login?redirect=<path>` on missing or invalid cookie.
- `apps/web/app/(auth)/login/page.tsx` is the minimal login form.
- Seed script `apps/web/scripts/set-password.ts` sets the password for a user by email (CLI only, no HTTP route).

### File storage + extraction pipeline (Wave 0 + Wave 4)
- **Storage primitives (Wave 0).** `apps/web/lib/services/file-service.ts` + `apps/web/app/api/files/presign` and `/confirm` provide presigned-URL uploads to R2. Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. 100 MiB size cap, MIME allowlist, 15-min URL expiry.
- **Upload UI (Wave 4).** `FileDropZone` mounted in `(app)/layout.tsx` overlays the page on drag (defers to in-editor drops via `e.defaultPrevented`). `/context` toolbar has an explicit Upload button (multi-select). `useUploadFile({ createEntry: true })` creates a `ContextEntry` of type `SOURCE` per file and links it via `File.contextEntryId`.
- **Extraction handlers (Wave 4).** Per-modality, in `apps/web/lib/extraction/`: `pdf-handler` (unpdf, up to 100 pages), `image-handler` (Gemini Vision caption + tags), `audio-handler` (Whisper transcript), `video-handler` (ffmpeg-static audio extraction → Whisper), `spreadsheet-handler` (csv/xlsx → "row N: ..." text), `plain-text-handler`. All gated by 60s wall-clock timeout and 50 MiB working-set cap; errors are sanitized before surfacing.
- **Queue + worker (Wave 4).** `extractionQueueService` is Postgres-backed (`ExtractionJob` table, `SELECT FOR UPDATE SKIP LOCKED`, retry up to 3 attempts with exponential backoff `5^attempts` minutes, per-user daily cap of 50 enqueued jobs). `extractionService` orchestrates dispatch by MIME. Worker tick is a stateless API route (`POST /api/files/extract/run`) called every 5 minutes by GitHub Actions; processes up to 5 jobs per tick within 25s wall-clock. Dual-auth: `x-cron-secret` header (timing-safe compare) OR user JWT.
- **Cleanup cron (Wave 4).** `POST /api/files/cleanup` (cron-only) runs daily at 04:00 UTC, deletes `File` rows in `PENDING` status older than 24h and DELETEs the corresponding R2 object if uploaded.
- **File serving (Wave 4).** `GET /api/files/[id]` does Accept-header content negotiation: HTML/JSON returns a 5-minute presigned download URL via 302 redirect; SVG MIME types stream bytes server-side with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` (DZ-11 mitigation). Status polling at `/api/files/[id]/status`. Manual re-extraction at `POST /api/files/[id]/extract`.
- **Block editor file blocks (Wave 4).** `FileNode` and `ImageNode` (Wave 3 stubs) are filled in. `FileBlock` does MIME-aware dispatch to `PdfPreview` (sandboxed iframe), `ImageBlock` (lightbox + arrow-key nav + zoom levels), `AudioPlayer` + `VideoPlayer` (transcript collapse), `SpreadsheetPreview` (5×5 inline table), or generic `FileCard`. Insertable via slash menu (`/upload`, `/file`, `/image`, `/pdf`, `/audio`, `/video`) or drag-drop into the editor canvas (`FileDropPlugin`).
- **Hooks (Wave 4).** `useUploadFile` (presign → R2 PUT → confirm), `useFileStatus` (auto-polls every 2s while EXTRACTING; stops on terminal status), `useReExtract`. All in `apps/web/lib/hooks/use-files.ts`.

### Databases (Wave 5)
- **Schema.** Four new models: `Database` (per `ContextEntry` of type `DATABASE`), `DatabaseField` (typed columns), `DatabaseRow` (per `ContextEntry` of type `RECORD`, properties as JSONB), `DatabaseView` (per saved view config). New enums `DatabaseFieldType` (14 values: TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, RELATION, FORMULA, USER, CHECKBOX, RATING, URL, EMAIL, PHONE, FILE) and `DatabaseViewType` (TABLE, BOARD, CALENDAR, GALLERY, TIMELINE). `ContextEntryType` extended with DATABASE and RECORD. `ContextLinkType` extended with DATABASE_RELATION. `ContextLink.databaseFieldId` nullable FK so RELATION-derived links know which field they came from.
- **Zod surface (`packages/core/src/schemas/databases.ts`).** Discriminated-union `databaseFieldConfigSchema` per type, factory `databaseRowPropertiesSchema(fields)` that builds a row-shape validator dynamically, recursive `filterSchema` (AND/OR groups, depth-capped at 5), `sortSchema`, view config schemas per view type, and per-property value schemas with size caps (TEXT 100k, URL 2k, EMAIL 320, PHONE 30).
- **Formula engine (`apps/web/lib/formula/`).** Pure-TS hand-rolled lexer + recursive-descent parser + tree-walking evaluator. 9 built-in functions: `concat`, `if` (lazy), `today`, `now`, `dateAdd`, `dateDiff`, `length` (string OR array), `upper`, `lower`. DZ-14 mitigations: 1000-AST-node parse cap, 10k op counter, 50ms wall-clock timeout, 50-deep recursion cap, parse-time cycle detection via dependency extraction. 28/28 fixture tests pass.
- **Service layer (`apps/web/lib/services/`).** Six services: `databaseService` (5-step transactional create), `databaseFieldService` (FORMULA cycle check on write, two-phase reorder for unique-position constraint, type-coercion validator), `databaseRowService` (3-step transactional create with empty BlockDocument, dynamic property validation via factory schema, DZ-15 256 KiB pre-flight, ContextEntry.title + extractedText sync from primary + extractable property text), `databaseViewService`, `databaseRelationService` (`diffAndApply` writes ContextLink rows of type DATABASE_RELATION; raw SQL bulk delete with `userId` guard for DZ-16), `databaseQueryService` (Prisma where + orderBy from filter/sort AST with JSONB ops pushdown via Prisma.sql, in-memory FORMULA fallback for filter and sort).
- **API routes.** 13 routes: `/api/databases` (list, create), `/api/databases/[id]` (get, patch, delete), `/api/databases/[id]/fields` (add), `/api/databases/[id]/fields/[fieldId]` (patch, delete), `/api/databases/[id]/fields/[fieldId]/change-type` (post), `/api/databases/[id]/fields/reorder` (post), `/api/databases/[id]/rows` (query, create), `/api/databases/[id]/rows/[rowId]` (patch, delete), `/api/databases/[id]/rows/reorder` (post), `/api/databases/[id]/views` (create), `/api/databases/[id]/views/[viewId]` (patch, delete), plus 3 lookups: `/api/databases/by-entry/[entryId]`, `/api/databases/row-by-entry/[entryId]`, `/api/databases/relation-backlinks/[rowEntryId]`.
- **Hooks (`apps/web/lib/hooks/use-database*.ts`).** `useDatabase`, `useDatabases`, `useDatabaseByEntry`, `useDatabaseRowByEntry`, `useFields` (selects from detail cache), `useDatabaseRows` (stableHash query key per `{viewId, filter, sort, page, perPage}`), `useDatabaseViews`, `useRelationBacklinks`, plus full mutations with cross-domain invalidation (rows ARE RECORD-typed ContextEntries, so create/delete invalidates `context.list` + `context.search`; RELATION writes invalidate `contextLinks.all` + `context.graph`).
- **Views (`apps/web/components/databases/`).** Five view components, each with its own DZ-7 error boundary: `table-view/` (TanStack Table v8 + TanStack Virtual, sticky header + sticky primary column, click-to-edit cells dispatching to PropertyCell, column resize/reorder/hide via dnd-kit, "+ Add row" sticky footer, "+ Add column" popover with type-specific config including live FORMULA validation, change-type dialog), `board-view/` (kanban grouped by SELECT/MULTI_SELECT, drag between columns via dnd-kit), `calendar-view/` (month grid starting on Monday, drag chip to reschedule), `gallery-view/` (responsive auto-fill grid, configurable cover from FILE or URL field), `timeline-view/` (gantt-style horizontal canvas, dnd-kit for bar move + raw pointer events for edge resize, day/week/month zoom).
- **Property editors (`apps/web/components/databases/property-editors/`).** 14 editors + dispatcher. One per field type with Cell + Expanded modes. `PropertyCell` switch-on-type used by all five views and the row detail panel.
- **Filter + sort + view config (`apps/web/components/databases/view-config/`).** `filter-builder.tsx` recursive AND/OR clause UI with depth cap; `sort-builder.tsx` multi-clause; `view-config-popover.tsx` 4-tab popover (Filter, Sort, Properties visibility, view-type-specific Layout). Wired into all 5 views' headers; replaces Phase 7-11 stubs.
- **Detail integration.** `apps/web/components/context/context-entry-detail.tsx` dispatches on `entry.type`: DATABASE → `database-detail.tsx` (renders the view switcher + active view), RECORD → `database-row-properties.tsx` + `database-relation-backlinks.tsx` mounted above the existing block editor body. Each row IS a ContextEntry with its own BlockDocument body, so users can write free-form notes attached to a row.
- **Slash menu + New button.** `slash-menu-plugin.tsx` has a Database item that creates a DATABASE entry and inserts a wikilink. `/context` toolbar's "New" is a DropdownMenu with Note and Database options.
- **MCP tools (10).** `create_database`, `add_field`, `update_field`, `delete_field`, `create_row`, `update_row`, `delete_row`, `create_view`, `update_view`, `query_database`. Tool count 58 → 68. All Zod-validated, all userId-scoped, all delegate to the service layer.
- **Delight.** View switch in `database-detail.tsx` uses `motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1` (respects `prefers-reduced-motion`). `useCreateDatabase.onSuccess` fires `canvas-confetti` via `apps/web/lib/confetti.ts` (gentle 60-particle burst, 2s cooldown, reduced-motion-aware).

### Provenance + time travel (Wave 7)
- **Schema.** Three new tables: `NodeVersion` (append-only, polymorphic via `nodeType` enum + `nodeId`; stores full entity payload as JSONB, sha256 content hash, byte size, trigger reason, optional `parentVersionId` for branches, nullable `workspaceId` for Wave 8 prep), `EdgeEvent` (append-only log of every ContextLink mutation with `eventType` CREATED/REMOVED/UPDATED, full link snapshot, denormalized `fromEntryId`/`toEntryId`), `GraphDailySnapshot` (precomputed graph at midnight UTC for each user per day; nodes + edges JSONB, capped at 5 MiB CHECK). Three new enums: `NodeType` (CONTEXT_ENTRY, GOAL, TODO, DATABASE_ROW, DATABASE_FIELD), `VersionTrigger` (EDIT_DEBOUNCED, EDIT_BLUR, EDIT_EXPLICIT, RESTORE, BRANCH, BACKFILL, MIGRATION), `EdgeEventType` (CREATED, REMOVED, UPDATED). `ContextLinkType` extended with `DERIVED_FROM` for branching.
- **Services (8 new, `apps/web/lib/services/`).** `versioningService` (snapshot orchestrator with in-process debounce map, 60s window, hash-based dedup, 10 MiB cap), `edgeEventService` (log edge mutations, entry-scoped query), `diffService` (wraps `@ascend/diff`, ownership verification), `restoreService` (forward snapshot before mutate, per-nodeType dispatch to target service, warnings array for unresolved references), `branchService` (eligibility check, cycle detection via 100-hop DERIVED_FROM walk, 50 derivative hard cap, creates new entity + DERIVED_FROM ContextLink), `graphHistoryService` (live vs snapshot dispatch, 90-day window, 410 for older), `graphSnapshotService` (precompute daily graph by replaying NodeVersion + EdgeEvent up to cutoff, upserts on userId+date), `retentionCompactorService` (30d all → 30d 1/day → forever 1/week Monday-anchored, bulk DELETE with userId guard).
- **Snapshot trigger pattern.** After any qualifying mutation (context update, block autosave, goal/todo update/complete/delete, row/field update/delete), the service calls `versioningService.scheduleSnapshot`. The debounce map holds a 60s timer per `${nodeType}:${nodeId}`. EDIT_BLUR and EDIT_EXPLICIT triggers bypass the debounce and fire immediately. Hash-based dedup skips the write if the content hash equals the latest version for that node. Per-snapshot cap: 10 MiB CHECK constraint on the database column. The in-process debounce map is best-effort on serverless cold starts; the EDIT_BLUR trigger guarantees at-least-once per session.
- **Retention policy.** Keep all versions from the last 30 days, then thin to 1 per UTC-day for days 31 through 60, then 1 per UTC-week (Monday-anchored) forever. Implemented by `retentionCompactorService.compactAllUsers()`, called nightly at 03:00 UTC via `.github/workflows/version-retention.yml`.
- **Diff engine (`@ascend/diff`, `packages/diff/`).** Pure-TS shared package, platform-agnostic (no DOM/Node). Four diff strategies: `block-diff` (Lexical JSON snapshot tree walk, identifies blocks by deterministic key, per-block text-diff via `fast-diff`), `field-diff` (key/value object diff for entity metadata), `property-diff` (type-aware per-fieldId comparison for DatabaseRow), `field-config-diff` (config object diff for DatabaseField). Exports `diffNodeVersions(fromPayload, toPayload, nodeType): DiffResult`. 10/10 fixture tests pass.
- **API routes (8 new).** 5 user-facing: `GET /api/versions/[nodeType]/[nodeId]` (list, paginated), `GET /api/versions/by-id/[id]` (single version with full payload; renamed from `/api/versions/[id]` to avoid Next.js param collision), `POST /api/versions/diff`, `POST /api/versions/restore`, `POST /api/versions/branch`. 1 graph-at: `GET /api/graph/at?date=YYYY-MM-DD` (returns precomputed snapshot or live state). 2 cron-only: `POST /api/versions/compact` (retention), `POST /api/graph/snapshots/precompute` (daily snapshot at 03:30 UTC).
- **MCP tools (5 new, count 68 → 73).** `list_versions`, `get_version`, `diff_versions`, `restore_version`, `branch_node`. All Zod-validated, userId from server factory, delegate to service layer. Handler: `apps/web/lib/mcp/tools/version-tools.ts`. Routing set: `VERSION_TOOL_NAMES`.
- **UI.** `apps/web/components/versioning/`: `version-history-panel.tsx` (collapsible panel mounted in context-entry-detail, goal-detail, todo-detail, database-row-properties; shows last 20 versions with cursor pagination, trigger badges, inline Diff/Restore/Branch actions), `version-diff-modal.tsx` (full-screen Dialog with type-aware diff renderer, tabbed layout on narrow viewports with content preview + formatTrigger labels, Restore + Branch actions in header), `diff-renderers/` subfolder (block-diff-renderer, field-diff-renderer, property-diff-renderer, field-config-diff-renderer; WCAG AA contrast colors for inserts/deletes), `branch-dialog.tsx` (title input, soft warning > 5 derivatives, confetti on success), `restore-confirmation-dialog.tsx`. DatabaseField history surfaced via kebab menu item on `table-header-cell.tsx`.
- **Time slider on graph view.** `context-graph-time-slider.tsx` overlays the graph canvas. Horizontal slider spanning the last 90 days with tick marks every 7 days. `useUIStore.graphViewAtDate` (transient, not persisted) drives the position. Drag fires `useGraphAt(date)` which fetches `GraphDailySnapshot` (24h staleTime, retry:false). Banner: "Viewing graph as it was on D. M. YYYY. Edits disabled." with "Return to now" pill. Keyboard accessible (arrow keys step by day, Home/End for boundaries). Falls back to "Snapshot not yet computed" banner when no precomputed snapshot exists.
- **Branching.** BlockDocument-bearing nodes only (CONTEXT_ENTRY of NOTE/SOURCE/PROJECT/PERSON/DECISION/QUESTION/AREA, or DATABASE_ROW). Creates a new entity by copying the version payload, adds a `DERIVED_FROM` typed ContextLink from new node to original. Cycle detection walks backward up to 100 hops. Hard cap of 50 direct derivatives per source. Confetti on success.
- **Backfill script.** `apps/web/scripts/backfill-versions.ts`. One-shot, idempotent (skips nodes with existing versions). Creates a v1 BACKFILL snapshot for every ContextEntry, Goal, Todo, DatabaseRow, DatabaseField, and a CREATED EdgeEvent for every ContextLink.

### Workspaces + collaboration foundation (Wave 8)
- **Schema.** Three new tables: `Workspace` (slug, name, ownerId, timestamps; one per user in Wave 8 single-user), `WorkspaceMembership` (workspaceId + userId + role + status, `@@unique([workspaceId, userId])`; OWNER seeded for the personal workspace), `ActivityEvent` (workspaceId + userId + eventType + payload JSONB + createdAt; cursor-paginated reverse-chronological). Three new enums: `WorkspaceRole` (OWNER, ADMIN, EDITOR, VIEWER), `MembershipStatus` (PENDING, ACTIVE, REMOVED), `ActivityEventType` (10 values across node + link + member + workspace). `User.defaultWorkspaceId` nullable FK added in Phase 1, populated in the seed migration.
- **`workspaceId` on every entity.** Phase 2 added `workspaceId String` (NOT NULL after backfill) to 18 existing tables. The 3 Wave 7 tables (NodeVersion, EdgeEvent, GraphDailySnapshot) already had nullable workspaceId from Wave 7 prep; the column was flipped to NOT NULL in the same wave. The backfill query for each table joins through the user-scoped owner (or parent entity for ProgressLog + ExtractionJob); the migration sequence is 1) add nullable column 2) backfill 3) pre-flight NULL count check 4) `ALTER COLUMN SET NOT NULL`. The 4th migration aborts if any row remains NULL.
- **Auth flow.** `JwtPayload.currentWorkspaceId` added in Phase 3a. `signAccessToken` + `signRefreshToken` include it. `authenticate()` (3 paths) resolves workspaceId from the JWT claim when present, otherwise looks up `User.defaultWorkspaceId`, otherwise falls back to the first ACTIVE `WorkspaceMembership`. Every API route + every MCP handler now reads `{ userId, workspaceId }` from auth.
- **Services (5 new, `apps/web/lib/services/`).** `workspaceService` (create, getById, getBySlug, listForUser, update, delete, getUserDefaultWorkspaceId, all ownership-checked via WorkspaceMembership), `workspaceMembershipService` (addMember, getRole, listMembers, updateRole, remove; activity events on every membership write), `workspaceContextService` (resolveDefaultWorkspaceId, generateCrdtToken, verifyCrdtToken; CRDT_JWT_SECRET >=32 chars enforced at module init), `permissionService` (`canPerform(userId, workspaceId, action): Promise<boolean>` + `assertCanPerform` wrapper, role matrix with OWNER/ADMIN/EDITOR/VIEWER hierarchy; in-process membership cache per request), `activityEventService` (log fire-and-forget never blocks callers, list cursor-paginated reverse-chrono with `WorkspaceMembership ACTIVE` ownership pre-check). 8 existing services (context, goal, todo, database, databaseRow, contextLink, restore, branch, workspaceMembership) fire activity events on every create/delete/restore/branch/membership write.
- **Real-time editing (CRDT, separate Dokploy app).** `apps/crdt/` standalone Node 22 + Alpine app running Hocuspocus v4 on port 1234, health server on 1235. Deployed as `ascend-crdt` on `dokploy-personal`, domain `crdt.ascend.nativeai.agency` with Let's Encrypt. Authentication: `onAuthenticate` verifies CRDT JWTs (`aud === "crdt"`, signature via `CRDT_JWT_SECRET` distinct from `AUTH_JWT_SECRET`, `documentName === "blockdoc:" + entryId` claim binding for cross-document reuse protection DZ-23). Persistence: `@hocuspocus/extension-database` calls back to the web app via `POST /api/blockdocs/[entryId]/persist` (server-to-server, gated by `CRDT_PERSIST_SECRET` via timing-safe compare). Persist is debounced 5s, max 30s. The web app's `blockDocumentService.persistFromCrdt` intentionally bypasses userId/workspaceId scoping (the secret IS the boundary) with the deliberate bypass documented at DZ-24.
- **Web client binding.** `apps/web/lib/realtime/use-realtime-document.ts` hook owns the per-entry CRDT lifecycle: POSTs `/api/crdt/token` for a 5-min JWT, creates a `Y.Doc`, wraps it in `HocuspocusProvider`, wires `IndexeddbPersistence` for offline recovery, schedules proactive token refresh at `expiresAt - 30s` via `provider.setConfiguration({ token }) + provider.sendToken()` (Hocuspocus v4 API; not `setAuthentication`). `apps/web/components/editor/collaboration-plugin.tsx` is a thin wrapper that bridges the HocuspocusProvider into Lexical's stable `CollaborationPlugin` from `@lexical/react/LexicalCollaborationPlugin` (NOT the experimental V2 binding). `context-block-editor.tsx` is a three-state machine (pending/realtime/fallback) that mounts CollaborationPlugin when the WS is up and falls back to legacy `AutosavePlugin` after a 5s timeout with a one-shot toast. The legacy autosave path stays as graceful-degradation; the LexicalComposer re-mounts with `editorState: undefined` on the realtime path (CollaborationPlugin seeds via `initialEditorState`).
- **Presence + cursors.** Yjs awareness protocol surfaces `{ username, cursorColor }` to all clients on the same document. `apps/web/components/realtime/presence-avatars.tsx` reads `provider.awareness` events (`change`, `update`) and renders a stack of remote-client avatars (filtered by clientID to exclude self, max 5 visible + overflow chip). `apps/web/lib/realtime/awareness-color.ts` provides `getUserColor(userId)` via djb2 hash → HSL. Collaborative cursors render natively via Lexical's CollaborationPlugin (cursors container is an absolute-positioned `<div ref={cursorsContainerRef}>` overlay inside the editor shell). `packages/editor/src/theme.ts` exposes `theme.collaboration` class names that Lexical picks up at runtime: `editor-collab-cursor` (2px caret + CSS variable `--lexical-cursor-color`), `editor-collab-cursor-name` (name pill above the caret), `editor-collab-selection-bg` (20% opacity selection highlight). All cursor transitions respect `prefers-reduced-motion`. `useUIStore.presenceOverlayEnabled` (persisted, default true) gates the rendering with an Eye/EyeOff toggle button next to the avatars.
- **Activity feed.** `/activity` page renders `activity-feed-view.tsx` (two-column: filters left, feed right). Day-grouped (Today / Yesterday / D. M. YYYY) reverse-chronological list with cursor pagination ("Show older activity" button bound to `fetchNextPage`). Filters: event-type checkboxes grouped by category (Nodes / Links / Members), date-range radios (24h / 7d / 30d / All). Per-row `activity-event-row.tsx` renders avatar + verb + entity-link + `formatDistanceToNow` timestamp; verb formatting is event-type-specific (created / deleted / restored / branched / linked / unlinked / added member / etc). `useActivityFeed(workspaceId, filters)` is a `useInfiniteQuery`. Cross-domain cache invalidation: every Wave 8 mutation hook (use-context, use-goals, use-todos, use-databases, use-database-rows, use-versions) invalidates `queryKeys.activity.all()` on success.
- **Workspace UI.** `apps/web/components/workspace/workspace-switcher.tsx` is a sidebar-header dropdown (current workspace name + chevron + dropdown listing workspaces with check mark + "Workspace settings" link). `/settings/workspace` page combines name editing (click-to-edit, Enter to save, Escape to cancel), member list (avatar + name + email + role + joined), and a danger card (disabled delete with explanatory tooltip). `apps/web/components/workspace/member-list.tsx` reads `useWorkspaceMembers(workspaceId)`. Wave 8 ships single-workspace; the switcher's "Switch workspace" row is disabled today and Wave 8b's invite flow lights up the disabled buttons.
- **MCP tools (3 new, count 73 → 76).** `list_workspaces` (no args, returns user's workspaces), `get_workspace` (optional id arg, defaults to factory-bound workspaceId, rejects mismatched id with isError in Wave 8 single-workspace), `get_activity_events` (optional eventType[] / since / cursor / limit, Zod-validated via `activityFeedQuerySchema`, returns `{ events, nextCursor }`). Tool count 76. Routing: `WORKSPACE_TOOL_NAMES` set + dispatch branch in `apps/web/lib/mcp/server.ts`. Handler at `apps/web/lib/mcp/tools/workspace-tools.ts`. The factory-bound workspaceId is the only source; user-supplied workspaceId in args is ignored.
- **What's deferred to Wave 8b.** Invitations (data model present, UI absent), multi-member UX, per-node permission overrides, branching merge UI, public publishing, comments + threads, @mentions + notifications, NODE_UPDATED activity events, jump-to-cursor presence interaction, deep-linking on activity feed entity links, MCP CORS allowlist, CRDT_PERSIST_SECRET min-length enforcement. All tracked in `.ascendflow/BACKLOG.md`.

### State Management
Server state: React Query (all data fetching and caching).
UI state: Zustand store at `apps/web/lib/stores/ui-store.ts` (sidebar, active view, filters, sorting, timeline zoom, modal state). Persisted via `@ascend/storage` adapter (never direct localStorage in Wave 0+).

### Two-Panel Layout
`apps/web/app/(app)/layout.tsx` wraps all authenticated pages with sidebar + main content. `apps/web/components/layout/app-sidebar.tsx` renders nav links, category tree, and the logout button. Mobile: bottom tab bar + drawer. `SessionExpiredListener` mounted inside the layout clears React Query cache when the 401 interceptor fires `ascend:session-expired`.

## Entity Model

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| User | Single-user, API key auth | Has goals, todos, context, categories, stats |
| Goal | Hierarchical objectives (yearly > quarterly > monthly > weekly) | Self-ref parentId, has children, todos, progressLogs, category |
| Todo | Flat tasks, Big 3, streaks, recurrence | Links to one goal (goalId), category, self-ref recurringSourceId |
| ContextEntry | Markdown docs, tags, typed wikilinks, full-text search. Typed via `ContextEntryType` (NOTE default, SOURCE, PROJECT, PERSON, DECISION, QUESTION, AREA). `extractedText` denormalized column (plain text from block editor state; feeds `search_vector` trigger). `blockDocumentId` nullable FK to `BlockDocument`. | Category, outgoingLinks / incomingLinks (ContextLink), optional BlockDocument |
| ContextLink | Typed directed edge between two ContextEntries (11 `ContextLinkType` values; Wave 5 added DATABASE_RELATION, Wave 7 added DERIVED_FROM). Source: CONTENT (parsed from wikilinks), MANUAL (Quick Link dialog), DATABASE_RELATION (relation field), or DERIVED_FROM (branch). | fromEntry, toEntry, denormalized userId |
| ContextMap | Per-user AI-synthesized map of the context graph (`content` jsonb with themes/principles/projects/tensions/orphans). One row per user (userId @unique), overwritten on each refresh. Tracks provider, model, token usage, and cost. | Belongs to user |
| LlmUsage | Audit log of every LLM call (embedding or chat). Records provider, model, purpose, token counts, estimated cost in cents. Indexed on `(userId, createdAt)`. Used for daily cost cap enforcement and the settings usage panel. | Belongs to user |
| BlockDocument | Per-entry Yjs binary state + JSON snapshot + version counter for the block editor. One per ContextEntry (entryId @unique). Size-capped at 1 MiB. | Belongs to user, belongs to entry (FK CASCADE). ContextEntry.blockDocumentId nullable FK. |
| File | Uploaded file record (Wave 0 storage + Wave 4 extraction). Fields: `storageKey`, `bucket`, `mimeType`, `sizeBytes`, `extractionStatus` (PENDING / EXTRACTING / COMPLETE / FAILED), `extractedText`, `extractionError`, `extractedAt`, `pageCount`, `thumbnailKey`, `multimodalEmbedding` (vector(1536), nullable). Optional `contextEntryId @unique` so each file can become a `SOURCE`-typed `ContextEntry`. | Belongs to user; optional 1:1 with ContextEntry; one ExtractionJob per fileId @unique. |
| ExtractionJob | Per-file extraction queue row (Wave 4). Fields: `fileId @unique`, `status`, `attempts`, `lastError`, `createdAt`, `startedAt`, `completedAt`. Processed via `SELECT FOR UPDATE SKIP LOCKED`. | Belongs to file (CASCADE). |
| Database | Wave 5. Per `ContextEntry` of type DATABASE. Fields: `contextEntryId @unique`, `defaultViewId`. Has many fields, rows, views. | Belongs to user; 1:1 with ContextEntry; has many DatabaseField / DatabaseRow / DatabaseView. |
| DatabaseField | Wave 5. Typed column on a Database. Fields: `name`, `type` (DatabaseFieldType, 14 values), `position`, `config` (JSONB type-specific: select options, formula expression, relation target, rating max, etc.), `isPrimary`. `@@unique([databaseId, position])`. | Belongs to user, belongs to database CASCADE. |
| DatabaseRow | Wave 5. Per `ContextEntry` of type RECORD. Fields: `contextEntryId @unique`, `position`, `properties` (JSONB map of fieldId → value, 512 KiB CHECK constraint for DZ-15). Each row has its own BlockDocument body. | Belongs to user, belongs to database CASCADE, 1:1 with ContextEntry CASCADE. |
| DatabaseView | Wave 5. Saved view config. Fields: `name`, `type` (DatabaseViewType, 5 values), `position`, `config` (JSONB: filter, sort, hidden fields, view-type-specific layout — group-by, cover, dates, zoom). | Belongs to user, belongs to database CASCADE. |
| NodeVersion | Wave 7. Append-only snapshot of any versioned node. Fields: `nodeType` (NodeType enum, 5 values), `nodeId`, `versionNumber` (monotonic per node), `payload` (JSONB full entity), `contentHash` (sha256), `byteSize` (CHECK 0..10 MiB), `trigger` (VersionTrigger enum, 7 values), `parentVersionId` (for branches), `workspaceId` (nullable, Wave 8 prep). `@@unique([nodeType, nodeId, versionNumber])`. | Belongs to user; self-ref parentVersion for branch lineage. |
| EdgeEvent | Wave 7. Append-only log of ContextLink mutations. Fields: `eventType` (EdgeEventType: CREATED/REMOVED/UPDATED), `linkSnapshot` (JSONB), denormalized `fromEntryId`/`toEntryId`, `workspaceId` (nullable). | Belongs to user. |
| GraphDailySnapshot | Wave 7. Precomputed graph state at midnight UTC per user per day. Fields: `snapshotDate` (Date), `nodes` (JSONB), `edges` (JSONB), `nodeCount`, `edgeCount`, `workspaceId` (nullable). CHECK: combined nodes+edges ≤ 5 MiB. `@@unique([userId, snapshotDate])`. | Belongs to user. |
| Workspace | Wave 8. Multi-tenant container. Fields: `slug @unique`, `name`, `ownerId`. One per user in Wave 8 single-user. | Belongs to user (owner). Has many memberships, activity events, and every workspace-scoped entity (18 tables). |
| WorkspaceMembership | Wave 8. Per-user membership in a workspace. Fields: `workspaceId`, `userId`, `role` (WorkspaceRole: OWNER/ADMIN/EDITOR/VIEWER), `status` (MembershipStatus: PENDING/ACTIVE/REMOVED), `invitedAt`, `acceptedAt`, `removedAt`. `@@unique([workspaceId, userId])`. Wave 8 single-user has one ACTIVE OWNER row. | Belongs to workspace CASCADE, belongs to user CASCADE. |
| ActivityEvent | Wave 8. Append-only workspace activity log. Fields: `workspaceId`, `userId` (nullable, SetNull on user delete), `eventType` (ActivityEventType: 15 values incl. 4 canvas), `payload` (JSONB discriminated by eventType), `createdAt`. Indexed on `(workspaceId, createdAt desc)` and `(workspaceId, eventType, createdAt desc)`. | Belongs to workspace CASCADE, belongs to user SetNull. |
| CanvasLayout | Wave 9. Per-user named arrangement of context entries on a spatial canvas. Fields: `userId`, `workspaceId`, `name (1-200)`, `slug`, `isDefault Boolean`, `viewport Json` (`{x, y, zoom, showEdges, cardSize}`), `canvas Json` (Excalidraw scene: elements+appState+files). `@@unique([userId, slug])`. CHECK: `octet_length(canvas::text) <= 2 MiB`, `octet_length(viewport::text) <= 8 KiB`. Indexes on `[userId, updatedAt desc]` and `[workspaceId]`. | Belongs to user CASCADE, belongs to workspace CASCADE, has many CanvasNode. |
| CanvasNode | Wave 9. Binds a ContextEntry to a position within one CanvasLayout. Fields: `canvasLayoutId` (FK CASCADE), `userId`, `workspaceId`, `contextEntryId` (FK CASCADE), `x Float`, `y Float`, `w Float @default(240)`, `h Float @default(140)`, `excalidrawElementId String`. `@@unique([canvasLayoutId, contextEntryId])`, `@@unique([canvasLayoutId, excalidrawElementId])`. Indexes on userId, workspaceId, contextEntryId. | Belongs to canvasLayout CASCADE, user CASCADE, workspace CASCADE, contextEntry CASCADE. |
| Category | Shared taxonomy, hierarchical (self-ref parentId) | Used by goals, todos, context |
| ProgressLog | Time-series progress per goal | Belongs to goal |
| UserStats | Aggregated XP, level, streaks | Belongs to user |
| XpEvent | Individual XP awards | Belongs to user |

**Wave 8 workspaceId on every entity.** As of Wave 8, the following 18 tables have `workspaceId String` (NOT NULL): Goal, Todo, ContextEntry, Category, BlockDocument, File, ExtractionJob, ContextLink, ContextMap, Database, DatabaseField, DatabaseRow, DatabaseView, LlmUsage, ProgressLog, NodeVersion, EdgeEvent, GraphDailySnapshot. The 5 user-only models (UserStats, XpEvent, FocusSession, Session, UserSettings) intentionally remain user-scoped, not workspace-scoped, because they represent global user state (XP, sessions, settings).

## Views

| View | Entity | Component |
|------|--------|-----------|
| List | Goals, Todos, Context | `goal-list-view.tsx`, `todo-list-view.tsx`, `context-entry-list.tsx` |
| Tree | Goals | `goal-tree-view.tsx` |
| Timeline (Gantt) | Goals | `goal-timeline-view.tsx` |
| Graph | Context (Wave 1) | `context-graph-view.tsx` + `context-graph-node.tsx` (ReactFlow + d3-force via `@ascend/graph`) |
| Pinned | Context | Filtered list view (`isPinned = true`) |
| Backlinks | Context (Wave 1) | `context-backlinks-view.tsx` (entries sorted by incoming link count) |
| Context Map (card) | Context (Wave 2) | `context-map-card.tsx` (top-of-page card on `/context` with 5 sections: themes, principles, projects, tensions, orphans; not a separate view, mounted above the view switcher) |
| Block Editor (detail) | Context (Wave 3) | `context-block-editor.tsx` replaces the markdown textarea on the entry detail panel. Lexical-based with slash menu, inline toolbar, wikilink + mention autocomplete, AI block, error boundary fallback to legacy markdown. |
| File blocks (in editor) | Context (Wave 4) | `file-block.tsx` MIME-dispatch wrapper → `pdf-preview.tsx` (sandboxed iframe), `image-block.tsx` (lightbox + arrow-key nav + Fit/100%/200% zoom), `audio-player.tsx` / `video-player.tsx` (native + transcript collapse), `spreadsheet-preview.tsx` (5×5 table), generic `FileCard`. Slash items: `/upload`, `/file`, `/image`, `/pdf`, `/audio`, `/video`. |
| Database (detail) | Context (Wave 5) | When a ContextEntry has type DATABASE, `database-detail.tsx` mounts in the detail panel: view switcher + active view + "+ Add view" + "+ Add field". |
| Database row (detail) | Context (Wave 5) | When a ContextEntry has type RECORD, `database-row-properties.tsx` + `database-relation-backlinks.tsx` mount above the existing block editor body. |
| Table view | Database (Wave 5) | `table-view/` (TanStack Table v8 + Virtual). Sticky header + sticky primary column. Click-to-edit cells via PropertyCell. Resizable + reorderable + hideable columns via dnd-kit. "+ Add row" footer. "+ Add column" popover with type-specific config + live FORMULA validation. Change-type dialog with allowed-targets + force-conversion flow. |
| Board view | Database (Wave 5) | `board-view/` kanban. Group by SELECT or MULTI_SELECT. Drag-between-columns via dnd-kit (closestCenter, PointerSensor with 8px activation). Empty state shows Quick-pick fallback when groupByFieldId missing. |
| Calendar view (DB) | Database (Wave 5) | `calendar-view/database-calendar-view.tsx`. Month grid starting Monday. Up to 3 chips per cell + "+N more" popover. Drag chip to a different date → patches DATE property. Distinct from `apps/web/components/calendar/` (which is for goals/todos). |
| Gallery view | Database (Wave 5) | `gallery-view/`. CSS Grid auto-fill `minmax(220px, 1fr)`. Cover from FILE or URL field via `/api/files/[id]` route. `object-fit: contain` per global asset rule. |
| Timeline view | Database (Wave 5) | `timeline-view/`. Gantt-style horizontal canvas anchored to two DATE fields. dnd-kit for bar move (delta.x only); raw `onPointerDown`/`onPointerMove` with `setPointerCapture` for edge handles. Day/week/month zoom (40 / 12 / 4 pixels-per-day). |
| Version history panel | All versioned nodes (Wave 7) | `components/versioning/version-history-panel.tsx` mounted in context-entry-detail, goal-detail, todo-detail, database-row-properties. Collapsible, cursor-paginated, trigger badges, inline Diff/Restore/Branch actions. |
| Side-by-side diff modal | All versioned nodes (Wave 7) | `components/versioning/version-diff-modal.tsx`. Full-screen Dialog, type-aware diff renderer switch, tabbed on narrow viewports. |
| Time slider on graph view | Context graph (Wave 7) | `components/context/context-graph-time-slider.tsx` overlays graph canvas. 90-day horizontal slider, keyboard nav, drives `useGraphAt(date)`. |
| Activity feed | ActivityEvent (Wave 8) | `components/activity/activity-feed-view.tsx` at `/activity`. Two-column: filters left, day-grouped reverse-chrono feed right. Cursor pagination via "Show older activity". Per-row avatar + type-specific verb + entity link + timestamp. |
| Workspace settings | Workspace + WorkspaceMembership (Wave 8) | `components/workspace/workspace-settings-page.tsx` at `/settings/workspace`. Three cards: General (inline name edit), Members (avatar + role + joined), Danger (disabled delete). |
| Workspace switcher | Workspace (Wave 8) | `components/workspace/workspace-switcher.tsx` in sidebar header. Dropdown with current workspace + check mark, separator, "Workspace settings" link. Wave 8 single-workspace; switching disabled. |
| Map view (spatial canvas) | Context (Wave 9) | `components/context/canvas/context-canvas-view.tsx` with Excalidraw + card overlay + edge sync + 1.5s autosave + layout switcher dropdown + import/export. Mounted as the 5th option in `/context` view switcher. |
| Presence avatars | Awareness (Wave 8) | `components/realtime/presence-avatars.tsx` in editor header. Filtered by `awareness.clientID` to exclude self. Max 5 + overflow chip. Eye/EyeOff toggle bound to `useUIStore.presenceOverlayEnabled`. |
| Collaborative cursors | Awareness (Wave 8) | Native via Lexical `CollaborationPlugin`. Cursors portal into `cursorsContainerRef` overlay inside editor shell. Styles in `app/globals.css` keyed off `--lexical-cursor-color`. Reduced-motion respected. |
| Calendar | Todos, Goals | `calendar-month-grid.tsx`, `calendar-day-detail.tsx` |
| Dashboard | All | `dashboard-page.tsx` (5 widgets) |

Board/Kanban view components exist (`goal-board-*.tsx`) but are dead code; removed from the view switcher.

## Key File Lookup

| Need to... | File |
|------------|------|
| Change auth (3-path `authenticate`) | `apps/web/lib/auth.ts` |
| Auth service internals (scrypt, JWT, sessions) | `apps/web/lib/services/auth-service.ts` |
| Add/modify Prisma model | `apps/web/prisma/schema.prisma` |
| Add validation schema (re-export) | `apps/web/lib/validations.ts` |
| Add shared Zod schema (authoritative) | `packages/core/src/schemas/<domain>.ts` |
| Add React Query key | `apps/web/lib/queries/keys.ts` |
| Change cache timing | `apps/web/lib/offline/cache-config.ts` |
| Modify UI state | `apps/web/lib/stores/ui-store.ts` |
| Change middleware (auth redirect gate) | `apps/web/middleware.ts` |
| Change web HTTP client | `apps/web/lib/api-client.ts` |
| Change shared HTTP client primitive | `packages/api-client/src/client.ts` |
| Change storage adapter | `packages/storage/src/web.ts` (web impl) |
| Change design tokens | `packages/ui-tokens/src/{colors,spacing,typography,radii}.ts` |
| Change graph layout / node + edge colors | `packages/graph/src/{layout,colors}.ts` |
| Wikilink parser | `packages/core/src/wikilink.ts` |
| Context link CRUD + content-sync | `apps/web/lib/services/context-link-service.ts` |
| Graph + neighbors + related heuristic | `apps/web/lib/services/context-service.ts` (`getGraph`, `getNeighbors`, `getRelated`) |
| Graph MCP tools | `apps/web/lib/mcp/tools/context-graph-tools.ts` |
| Graph view UI | `apps/web/components/context/context-graph-view.tsx` + `context-graph-node.tsx` |
| Edges panel in detail | `apps/web/components/context/context-edges-panel.tsx` |
| Quick link dialog | `apps/web/components/context/context-quick-link-dialog.tsx` |
| Entry type selector | `apps/web/components/context/context-type-select.tsx` |
| Backlinks view | `apps/web/components/context/context-backlinks-view.tsx` |
| LLM provider interfaces + types | `packages/llm/src/types.ts` |
| LLM pricing table | `packages/llm/src/pricing.ts` |
| LLM service (provider resolution, cost cap, chat) | `apps/web/lib/services/llm-service.ts` |
| Embedding service (embed, upsert, semantic search) | `apps/web/lib/services/embedding-service.ts` |
| Context Map service (synthesis, refresh, cooldown) | `apps/web/lib/services/context-map-service.ts` |
| Context Map synthesis prompt | `apps/web/lib/services/context-map-prompt.ts` |
| Context Map card UI | `apps/web/components/context/context-map-card.tsx` |
| LLM provider picker (settings) | `apps/web/components/settings/llm-provider-picker.tsx` |
| LLM usage panel (settings) | `apps/web/components/settings/llm-usage-panel.tsx` |
| Embedding backfill script | `apps/web/scripts/backfill-embeddings.ts` |
| Nightly cron workflow | `.github/workflows/nightly-map-refresh.yml` |
| Editor package (nodes, theme, Markdown round-trip) | `packages/editor/src/index.ts` |
| Block document service (CRUD, sync, block ops) | `apps/web/lib/services/block-document-service.ts` |
| Block migration service (markdown to blocks) | `apps/web/lib/services/block-migration-service.ts` |
| Block editor component (Lexical web binding) | `apps/web/components/context/context-block-editor.tsx` |
| Editor plugins (slash menu, toolbar, autocomplete) | `apps/web/components/editor/*.tsx` (8 plugin files) |
| Editor styles | `apps/web/app/globals.css` (editor-specific classes at bottom) |
| Block-level API routes | `apps/web/app/api/context/[id]/blocks/**/route.ts` |
| Block-level MCP tools | `apps/web/lib/mcp/tools/block-tools.ts` |
| File MCP tools (upload, get content, list) | `apps/web/lib/mcp/tools/file-tools.ts` |
| Block document React Query hooks | `apps/web/lib/hooks/use-block-document.ts` |
| Add nav item | `apps/web/components/layout/nav-config.ts` |
| Add MCP tool schema | `apps/web/lib/mcp/schemas.ts` |
| Route MCP tool | `apps/web/lib/mcp/server.ts` |
| Change XP/level constants | `apps/web/lib/constants.ts` |
| Filter goal trees | `apps/web/lib/tree-filter.ts` |
| Timeline date math | `apps/web/lib/timeline-utils.ts` |
| Seed or reset a user's password | `apps/web/scripts/set-password.ts` (CLI only) |
| Add/change file upload routes | `apps/web/app/api/files/{presign,confirm}/route.ts` + `apps/web/lib/services/file-service.ts` |
| Database service (Wave 5: CRUD on Database, transactional create) | `apps/web/lib/services/database-service.ts` |
| Database field service (add/update/delete/reorder/changeType, formula cycle check) | `apps/web/lib/services/database-field-service.ts` |
| Database row service (transactional create with BlockDocument body, properties validation, DZ-15 pre-flight) | `apps/web/lib/services/database-row-service.ts` |
| Database view service | `apps/web/lib/services/database-view-service.ts` |
| Database relation service (DATABASE_RELATION ContextLink writes, DZ-16 raw SQL bulk delete) | `apps/web/lib/services/database-relation-service.ts` |
| Database query service (filter/sort AST → Prisma where + JSONB ops, in-memory FORMULA fallback) | `apps/web/lib/services/database-query-service.ts` |
| Database Zod schemas (per-type configs + value validators + factory + filter/sort + view config) | `packages/core/src/schemas/databases.ts` |
| Formula engine (lexer/parser/AST/evaluator/dependencies/functions) | `apps/web/lib/formula/` |
| Database React Query hooks | `apps/web/lib/hooks/use-database{s,-fields,-rows,-views}.ts` |
| Property editors (14 types × Cell + Expanded modes + dispatcher) | `apps/web/components/databases/property-editors/` |
| Database views | `apps/web/components/databases/{table,board,calendar,gallery,timeline}-view/` |
| Filter + sort + view config builders | `apps/web/components/databases/view-config/` |
| Database detail panel + view switcher + row properties + backlinks | `apps/web/components/databases/{database-detail,database-view-switcher,database-row-properties,database-relation-backlinks}.tsx` |
| Database MCP tools (10 handlers) | `apps/web/lib/mcp/tools/database-tools.ts` |
| Database API routes | `apps/web/app/api/databases/**/route.ts` |
| Versioning service (snapshot orchestrator, debounce, dedup) | `apps/web/lib/services/versioning-service.ts` |
| Edge event service (ContextLink mutation log) | `apps/web/lib/services/edge-event-service.ts` |
| Diff service (wraps @ascend/diff, ownership check) | `apps/web/lib/services/diff-service.ts` |
| Restore service (forward snapshot + per-nodeType dispatch) | `apps/web/lib/services/restore-service.ts` |
| Branch service (eligibility, cycle detection, DERIVED_FROM link) | `apps/web/lib/services/branch-service.ts` |
| Graph history service (live vs snapshot dispatch) | `apps/web/lib/services/graph-history-service.ts` |
| Graph snapshot precompute service | `apps/web/lib/services/graph-snapshot-service.ts` |
| Retention compactor service (30d/30d/weekly policy) | `apps/web/lib/services/retention-compactor-service.ts` |
| Diff engine package (pure-TS, 4 strategies) | `packages/diff/src/index.ts` |
| Versioning React Query hooks | `apps/web/lib/hooks/use-versions.ts` |
| Version history panel (collapsible, mounted in 4 details) | `apps/web/components/versioning/version-history-panel.tsx` |
| Version diff modal (full-screen, type-aware renderer) | `apps/web/components/versioning/version-diff-modal.tsx` |
| Diff renderers (block, field, property, field-config) | `apps/web/components/versioning/diff-renderers/` |
| Branch dialog | `apps/web/components/versioning/branch-dialog.tsx` |
| Restore confirmation dialog | `apps/web/components/versioning/restore-confirmation-dialog.tsx` |
| Graph time slider | `apps/web/components/context/context-graph-time-slider.tsx` |
| Version API routes (list, by-id, diff, restore, branch) | `apps/web/app/api/versions/**/route.ts` |
| Graph-at API route | `apps/web/app/api/graph/at/route.ts` |
| Cron: version retention | `.github/workflows/version-retention.yml` |
| Cron: graph daily snapshot precompute | `.github/workflows/graph-daily-snapshot.yml` |
| Version backfill script | `apps/web/scripts/backfill-versions.ts` |
| Versioning MCP tools (5 handlers) | `apps/web/lib/mcp/tools/version-tools.ts` |
| Workspace MCP tools (3 handlers) | `apps/web/lib/mcp/tools/workspace-tools.ts` |
| Workspace service (CRUD + listForUser) | `apps/web/lib/services/workspace-service.ts` |
| Workspace membership service | `apps/web/lib/services/workspace-membership-service.ts` |
| Workspace context + CRDT token issuance | `apps/web/lib/services/workspace-context-service.ts` |
| Permission service (RBAC matrix, canPerform) | `apps/web/lib/services/permission-service.ts` |
| Activity event service (log + list) | `apps/web/lib/services/activity-event-service.ts` |
| CRDT app source (Hocuspocus server) | `apps/crdt/src/{server,auth,persist,health}.ts` |
| CRDT token API route | `apps/web/app/api/crdt/token/route.ts` |
| CRDT persist API route (server-to-server) | `apps/web/app/api/blockdocs/[entryId]/persist/route.ts` |
| Realtime hook (Hocuspocus lifecycle) | `apps/web/lib/realtime/use-realtime-document.ts` |
| Awareness color hash | `apps/web/lib/realtime/awareness-color.ts` |
| Collaboration plugin wrapper | `apps/web/components/editor/collaboration-plugin.tsx` |
| Presence avatars | `apps/web/components/realtime/presence-avatars.tsx` |
| Activity feed components | `apps/web/components/activity/` |
| Workspace switcher + settings | `apps/web/components/workspace/` |
| Canvas Zod schemas (Wave 9) | `packages/core/src/schemas/canvas.ts` |
| Canvas layout service (CRUD + lazy default + 2 MiB pre-flight) | `apps/web/lib/services/canvas-layout-service.ts` |
| Canvas node service (upsert + bulk + raw-SQL delete with userId+workspaceId guards) | `apps/web/lib/services/canvas-node-service.ts` |
| Canvas import service (.excalidraw parse + merge) | `apps/web/lib/services/canvas-import-service.ts` |
| Canvas React Query hooks + autosave | `apps/web/lib/hooks/use-canvas.ts`, `apps/web/lib/hooks/use-canvas-autosave.ts` |
| Canvas view + overlay + edge sync + utils | `apps/web/components/context/canvas/` |
| Canvas API routes (7 endpoints) | `apps/web/app/api/canvas/` |
| Canvas MCP tools (3 handlers) | `apps/web/lib/mcp/tools/canvas-tools.ts` |
| Workspace hooks | `apps/web/lib/hooks/use-workspaces.ts` |
| Activity feed hooks | `apps/web/lib/hooks/use-activity.ts` |
| Current user hook | `apps/web/lib/hooks/use-me.ts` |
| Workspace API routes | `apps/web/app/api/workspaces/**/route.ts` |
| CLI entry + global flags + version + lazy command registration | `packages/cli/src/cli.ts` |
| CLI auth chain (flag → env → config) + fingerprint helper | `packages/cli/src/auth.ts` |
| CLI config file (~/.ascend/config.json, mode 0600) | `packages/cli/src/config.ts` |
| CLI ApiClient wrapper (error normalization, exit codes) | `packages/cli/src/client.ts` |
| CLI error classes + exit codes (1 usage, 2 api, 3 network) | `packages/cli/src/errors.ts` |
| CLI shared output lib (table chars, progress bar, date parsing, json/md/pretty fork) | `packages/cli/src/lib/output.ts` |
| CLI prefix-to-id resolver (cuids are awkward to type in full) | `packages/cli/src/lib/resolve-id.ts` |
| CLI MCP JSON-RPC transport + federated-name classifier | `packages/cli/src/lib/mcp.ts` |
| CLI todo commands (add, list, done, big3) | `packages/cli/src/commands/todo/` |
| CLI goal commands (list, show, progress) | `packages/cli/src/commands/goal/` |
| CLI context commands (search, add, get) | `packages/cli/src/commands/context/` |
| CLI calendar commands (day, week, agenda) | `packages/cli/src/commands/calendar/` |
| CLI today/dashboard command | `packages/cli/src/commands/today.ts` |
| CLI MCP escape hatch (list-tools, call) | `packages/cli/src/commands/mcp/` |
| CLI `open <route>` launcher | `packages/cli/src/commands/open.ts` |
| CLI auth commands (login, logout, whoami) | `packages/cli/src/commands/{login,logout,whoami}.ts` |
| CLI build config (tsup, CJS output, splitting on, date-fns inlined) | `packages/cli/tsup.config.ts` |
| CLI version constant (build-time, replaces import.meta.url path) | `packages/cli/src/version.ts` |
| CLI README (install, command reference, auth model, exit codes, troubleshooting, publish flow) | `packages/cli/README.md` |

## Cross-Platform Rules (Wave 0+)

The monorepo splits code into shared packages (`packages/*`) and platform-specific apps (`apps/*`). These rules enforce the boundary so shared code stays platform-agnostic.

### What may live in `packages/*`

Pure TypeScript, Zod schemas, date-fns utilities, platform-agnostic business logic, shared types, and workspace cross-package imports. Nothing in a shared package may assume a specific runtime (browser, Node, React Native).

### What may NOT live in `packages/*`

The following imports are **banned** in any file under `packages/`:

| Banned import | Reason |
|---------------|--------|
| `next/*`, `next-themes` | Next.js is web-only |
| `react`, `react-dom` | React is a UI framework; shared packages contain logic, not UI |
| `react-native` | Platform-specific |
| `@prisma/client`, `@/lib/db` | Database access belongs in the service layer inside `apps/web` |
| `zustand` | State management is app-level |
| `localStorage`, `sessionStorage` (direct access in shared APIs) | Use `@ascend/storage` adapter instead |
| `window`, `document` (unguarded) | Not available in non-browser runtimes |
| Tailwind class strings, shadcn component imports | CSS framework is web-specific |

**Exception:** `packages/storage/src/web.ts` may reference `localStorage` and `window` because the entire purpose of that module is to provide the web implementation of the storage adapter. It guards access with `typeof window !== "undefined"`.

### What may live in `apps/web/*`

Any web library: Next.js, React, React DOM, Prisma, Zustand, Tailwind, shadcn, sonner, recharts, lucide-react, etc. All imports that are banned in `packages/*` are allowed here.

### Placement rules

| Code type | Where it lives |
|-----------|---------------|
| API route handlers | `apps/web/app/api/`, never in packages |
| Zustand store | `apps/web/lib/stores/`, using `@ascend/storage` adapter (never `localStorage` directly) |
| React Query hooks | `apps/web/lib/hooks/`, using `@ascend/api-client` (never raw `fetch` or `fetchJson`) |
| Shared types and enums | `@ascend/core` |
| Client-server contract (typed API client) | `@ascend/api-client` |
| Design tokens (colors, spacing, typography, radii) | `@ascend/ui-tokens` |
| Storage adapter interface and implementations | `@ascend/storage` |
| LLM provider abstraction (embedding + chat) | `@ascend/llm` |
| Editor node definitions, Markdown round-trip | `@ascend/editor` |
| Diff engine (version comparison) | `@ascend/diff` |

### Enforcement

Run `ax:cross-platform-check` after any change to `packages/*`. The check greps for banned imports and fails if any are found. The `ascend-architect` agent verifies boundary compliance during code review.

## Danger Zones

**DZ-1: No transaction wrapping in todo completion.** `lib/services/todo-service.ts` and `lib/services/gamification-service.ts` perform status update, goal progress recalc, XP event creation, and stats update as separate Prisma calls. A mid-flow failure leaves data inconsistent.

**DZ-2: Context search_vector not in Prisma schema.** Added via raw SQL migration. Prisma does not know about it. See safety rule 6.

**DZ-3: Two separate recurring systems.** `lib/services/recurring-service.ts` (goals) and `lib/services/todo-recurring-service.ts` (todos) handle recurrence independently. Naming is confusing and there may be shared logic.

**DZ-4: Recurring instance generation is visit-triggered.** `todo-recurring-service.ts` only generates instances when the calendar page loads. If the user does not visit the calendar, recurring todos will not appear.

**DZ-5: fetchJson duplicated.** RESOLVED in Wave 0 Phase 4. Retained here as historical context only; no longer active. The hooks now import from `@ascend/api-client`.

**DZ-6: Board view components are dead code.** `components/goals/goal-board-card.tsx`, `goal-board-column.tsx`, `goal-board-view.tsx` were removed from the view switcher. Do not treat these as active components.

**DZ-7: No error boundaries.** A render error in any widget crashes the entire page. If adding a risky component or a new top-level page, wrap it in an error boundary. Mitigated for the `(auth)` route group via `apps/web/app/(auth)/error.tsx`.

**DZ-8: ContextLink.userId is denormalized.** Every query touching the ContextLink table MUST filter by userId (either directly in the where clause or via a preceding ownership check on the endpoint entries). The denormalized column exists specifically so Safety Rule 1 can be enforced on join-table queries without needing to traverse fromEntry/toEntry. See `apps/web/lib/services/context-link-service.ts` — every method verifies ownership before touching ContextLink. This was added in Wave 1 Phase 1.

**DZ-9: LLM cost runaway.** A bug in the cost-cap check, a retry storm on 5xx, or an infinite-loop cron could produce unexpected billing. Four mitigations: (1) Single `requestBudget` gate in `llmService` called synchronously BEFORE every provider invocation, no bypass path; (2) Retry helper caps at 3 retries and never retries 4xx client errors; (3) Cron route (`/api/context/map/refresh`) requires `x-cron-secret` header (timing-safe compare) OR user JWT, no unauthenticated path; (4) Provider-side monthly hard limits set in each provider's billing dashboard serve as the ultimate backstop. Added in Wave 2.

**DZ-10: Yjs state size cap.** A pathological block document could grow the `BlockDocument.state` column large enough to impact database performance. Four mitigations: (1) Database CHECK constraint `octet_length("state") <= 1048576` (1 MiB); (2) Service layer pre-flight in `blockDocumentService` checks `mergedState.length > MAX_STATE_BYTES` before the Prisma call; (3) Per-update cap: individual Yjs binary payloads on `/api/context/[id]/blocks/sync` capped at 256 KiB decoded (route also does pre-parse Content-Length check at 512 KiB); (4) Client-side autosave debounces to 1.5s. Added in Wave 3.

**DZ-11: Block tree XSS (Embed/Image/File URL sanitization).** RESOLVED in Wave 4 for the File/Image surface: all user-facing file URLs route through `/api/files/[id]` (auth + userId required) instead of raw R2 URLs; SVG MIME types are streamed with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`; PDFs render in a sandboxed `<iframe>`. The Embed node remains a placeholder with no user-facing URL input until a future wave adds embed-by-URL.

**DZ-12: Extraction queue runaway / cost.** A pathological loop, retry storm, or queue starvation could consume LLM budget or starve the worker tick. Mitigations: (1) `SELECT FOR UPDATE SKIP LOCKED` prevents double-processing; (2) retry capped at 3 attempts with exponential backoff `5^attempts` minutes; (3) per-user daily cap of 50 enqueued jobs; (4) per-tick cap of 5 jobs / 25s wall-clock; (5) every LLM call inside a handler still goes through DZ-9's `requestBudget` gate; (6) handlers gated by 60s wall-clock timeout and 50 MiB working-set cap. Added in Wave 4.

**DZ-13: R2 orphan risk in `fileService.uploadBytes`.** The MCP `upload_file` tool path is non-transactional: R2 PUT runs first, then Prisma `create`. If the Prisma write fails, the R2 object is orphaned permanently because `cleanupOrphanPending` only deletes rows in PENDING status. Low risk in single-user single-server (transient failures rare; orphan is harmless storage waste) but should land before Wave 8 multi-user. Mitigation deferred: add R2-side reconciliation (scan for keys without matching `File` rows) or wrap PUT + create in a try/catch that issues a compensating R2 DELETE on Prisma failure. Tracked in BACKLOG. Added in Wave 4.

**DZ-14: Formula CPU/memory runaway.** A user could write a pathological FORMULA expression (deeply nested recursion, huge concat, op-counter exhaustion) that DOSes the server. Five mitigations all enforced in `apps/web/lib/formula/`: (1) parse-time AST size cap of 1000 nodes (`parser.ts`); (2) evaluator step counter capped at 10k (`evaluator.ts`); (3) recursion depth cap of 50 (`evaluator.ts`); (4) wall-clock timeout of 50ms per evaluation (`evaluator.ts`); (5) parse-time cycle detection on the field dependency graph (`databaseFieldService.cycleCheck` via `extractDependencies`). The engine has zero use of `eval`, `Function()`, or dynamic SQL; it is a hand-rolled tree-walking interpreter. All five must trip before a malicious formula can affect server health. Added in Wave 5.

**DZ-15: JSONB property bloat on DatabaseRow.** A row's `properties` JSONB could grow unbounded if the user crams huge text values. Three mitigations: (1) per-property type-specific size caps in Zod (TEXT 100k chars, URL 2k, EMAIL 320, PHONE 30) enforced via `databaseRowPropertiesSchema(fields)` factory at write-time; (2) total properties JSON capped at 256 KiB at the service-layer pre-flight in `databaseRowService.create` and `update`; (3) database CHECK constraint `octet_length(properties::text) <= 524288` (512 KiB ceiling). Long content belongs in the row's `BlockDocument` body, not in a property. Added in Wave 5.

**DZ-16: RELATION cascade explosion.** Deleting a database with N rows × M relation fields creates O(N×M) `ContextLink` deletes. Mitigations: relation deletes use raw SQL `DELETE FROM "ContextLink" WHERE "databaseFieldId" IN (...) AND "userId" = ${userId}` instead of per-row Prisma calls. Three call sites: `databaseService.delete` (bulk for all of the database's RELATION fields), `databaseFieldService.delete` (single field), `databaseRelationService.diffAndApply` (per-row diff during property update). All three include the `userId` guard for defense-in-depth; the `onDelete: Cascade` FK on `ContextLink.databaseFieldId` is the backstop, not the primary path. Added in Wave 5.

**DZ-17: Snapshot storage runaway.** A pathological editing pattern (every 60s indefinitely across many nodes) could grow the NodeVersion table faster than the retention compactor thins it. Mitigations: (1) debounce window means actual writes are bounded by user activity gaps, not raw edit count; (2) hash-based dedup skips no-op snapshots; (3) per-snapshot 10 MiB CHECK constraint (`NodeVersion_byteSize_max`); (4) retention compactor caps steady-state at approximately 110 versions per node per year (30 daily + 4 weekly × N years); (5) single-user production has a natural activity ceiling. Future: per-user daily snapshot count cap (deferred to BACKLOG). Added in Wave 7.

**DZ-18: Restore semantics on cross-references and cascading state.** Restoring an entity to a historical snapshot may reference wikilinks to entries that no longer exist, or set a goalId FK to a deleted goal. Mitigations: (1) restore dispatches per-nodeType to the target service's update method, which validates FKs and returns clear errors; (2) ContextLinks are NOT time-traveled (current edges remain, stated explicitly in the confirmation dialog); (3) restore always writes a forward snapshot before mutating, so undo-restore is possible; (4) dryRun mode previews the payload without touching the DB; (5) the response includes a `warnings` array listing any references that could not be resolved. Added in Wave 7.

**DZ-19: "Graph as it was" performance and correctness.** Querying graph at date X without precomputed snapshots would require per-node "find latest version at or before date" plus per-edge "replay all events up to date," which is O(N+E) database round-trips. Mitigations: (1) `GraphDailySnapshot` precomputes the graph at midnight UTC daily (nightly cron at 03:30 UTC); (2) slider is 90-day capped (older requests return 410); (3) `useGraphAt` has 24h staleTime so repeat scrubs are cache hits; (4) snapshots are denormalized to the fields the graph view needs (id, label, type, color) rather than full entity payloads, so each snapshot stays under the 5 MiB CHECK constraint; (5) fallback banner when no precomputed snapshot exists ("Snapshot not yet computed"). Added in Wave 7.

**DZ-20: Branching circularity and derivation runaway.** A user could branch A to B, then B to C, then attempt C to A (cycle), or branch a single node hundreds of times. Mitigations: (1) cycle detection at branch time walks the DERIVED_FROM chain backward from the source for up to 100 hops, refuses if the chain contains the would-be new node's ancestor; (2) soft warning UI at > 5 derivatives ("This node already has N branches"); (3) hard cap of 50 direct derivatives per source node (server returns 400); (4) the 100-hop walk cap prevents infinite loops in pathological data even if a cycle were introduced outside the application. Added in Wave 7.

**DZ-21: Backfill correctness on the workspaceId NOT NULL flip.** If any row in any of 18 tables has `workspaceId IS NULL` when Wave 8 Migration 4 runs, the migration aborts with a clear error. Mitigations: (a) Migration 3 backfills via `UPDATE ... SELECT FROM "Workspace" WHERE "ownerId" = ...` which is deterministic for a single-user-per-row data model; (b) Migration 4 pre-flight runs a `COUNT(*) WHERE workspaceId IS NULL` for each table and refuses if any non-zero; (c) Dokploy database snapshot taken immediately before the migration set starts; (d) the four migrations are deployed as a single batch under `prisma migrate deploy` so failure rolls back consistently; (e) the Wave 7 saved sessions show retention is enforced and table sizes are bounded, so the backfill query window is small enough to finish in well under the build's 5-minute deploy window. Added in Wave 8 Phase 2.

**DZ-22: Cross-tenant data leak via incomplete workspaceId filter.** Wave 8 Phase 3 modifies ~30 service methods to add `workspaceId` to every `where` clause. Missing one means a future second user sees data from the first user's workspace. Mitigations: (a) `permissionService.canPerform` is the gate at every mutation, blocking writes that target wrong workspace; (b) read paths still need explicit `workspaceId` filter, audited by `ascend-reviewer` on every modified service; (c) integration smoke: spin up a second test user during the wave's UI verification, attempt to read User A's notes via User B's API key, expect 403/404; (d) `ascend-security` audits every modified handler at wave close. Added in Wave 8 Phase 3.

**DZ-23: Hocuspocus auth bypass / cross-document token reuse.** The CRDT JWT is short-lived (5 min) but if a token leaks or is misused, it could grant write access to the wrong document. Mitigations: (a) token's `entryId` claim is checked against `documentName === "blockdoc:" + entryId` in `onAuthenticate`; mismatch throws and the connection is rejected; (b) `CRDT_JWT_SECRET` is separate from `AUTH_JWT_SECRET` (compromise of one does not cascade) and is enforced ≥32 chars at module init in `apps/web/lib/services/workspace-context-service.ts` and `apps/crdt/src/auth.ts`; (c) the persist endpoint requires `CRDT_PERSIST_SECRET` via `x-crdt-secret` header, separate from JWT, server-to-server only, timing-safe compared via `verifyCrdtPersistSecret` in `apps/web/lib/auth.ts`; (d) audience claim `aud === "crdt"` is required on both issuance and verification, distinct from auth JWTs which use `aud === "ascend-web"`; (e) all CRDT traffic over WSS (Let's Encrypt TLS via Dokploy + Traefik); (f) tokens default to 300-second TTL with no override exposed by the route. Added in Wave 8 Phase 4.

**DZ-24: Yjs state divergence / persistence inconsistency.** If the persist endpoint fails or is slow, a tab that disconnects may lose edits that were CRDT-shared but not yet persisted. Mitigations: (a) Hocuspocus `extension-database` model: persist on every debounced 5s checkpoint AND on `onDisconnect` (debounce 5s, max debounce 30s configured in `apps/crdt/src/server.ts`); (b) persist endpoint is idempotent (full state writes overwrite); (c) `blockDocumentService.persistFromCrdt` decodes base64 and enforces the existing 1 MiB DZ-10 raw-state cap so a runaway Y-doc cannot blow the column; (d) the persist body Zod schema caps the base64 string at 2 MiB for defense-in-depth before decode; (e) the persist service method intentionally bypasses userId/workspaceId scoping because the server-to-server `CRDT_PERSIST_SECRET` is the auth boundary — this is the ONLY method in the codebase permitted to bypass Safety Rule 1, and the pattern must never be replicated for user-facing endpoints; (f) CRDT server retries are bounded (3 max, 5xx-only, exponential 1s/2s/4s backoff, terminal on 4xx, never throws so connection survives); (g) Phase 5 will add `y-indexeddb` on the client so a closed tab that did not flush has a local recovery snapshot before reconnect merges via Yjs CRDT semantics. Added in Wave 8 Phase 4.

**DZ-25: Canvas blob storage runaway.** A pathological autosave path or a user pasting a 50 MiB embedded image into the Excalidraw scene could blow the `CanvasLayout.canvas` JSONB column. Mitigations: (a) DB CHECK constraint at 2 MiB on `canvas`, 8 KiB on `viewport`; (b) service-layer pre-flight in `canvasLayoutService.update` serializes and rejects payloads larger than 2 MiB before the Prisma write so the user sees a clean error rather than a CHECK violation; (c) the autosave hook debounces at 1.5s with content-hash dedup, bounding write frequency; (d) Excalidraw's `files` map (embedded image base64) is reserved for future R2-backed images — the Wave 9 client does not paste raw base64 into the scene; (e) the upstream Next.js route Content-Length pre-check rejects bodies over 4 MiB at the boundary. The 2 MiB ceiling allows ~2k typical elements + freehand strokes per layout, well past normal use. Added in Wave 9.

**DZ-26: Edge creation noise on the canvas.** A pathological onChange loop or a buggy autosave path could detect "new arrows" repeatedly and spam `POST /api/context/links`. Mitigations: (a) the type-picker modal is the only path that actually CREATES a ContextLink; closing/cancelling removes the proposed arrow; (b) `useCreateContextLink`'s `mutate` is idempotent (server upserts by `(fromEntryId, toEntryId, type)`), so re-firing is safe; (c) the autosave handler tracks arrows by `customData.linkId` once tagged, so a re-issued onChange tick does not re-trigger the picker; (d) `permissionService.assertCanPerform` is the service-layer gate. Added in Wave 9.

**DZ-27: Excalidraw prop identity must stay stable across renders.** Excalidraw's internal tunnel-rat portal uses `useSyncExternalStore`. When a prop callback's identity changes between renders, tunnel-rat's `useIsomorphicLayoutEffect` re-subscribes inside the commit phase and forces every consumer to re-render via `forceStoreRerender`. Each forced re-render fires the layout effect again, producing an infinite loop that React bails out of with "Maximum update depth exceeded" (`Set.forEach` → `forceStoreRerender` → `tunnel.useIsomorphicLayoutEffect` in the trace). This silently broke the Map view on production from 14. 5. to 17. 5. 2026. Mitigations: (a) `apps/web/components/context/canvas/context-canvas-view.tsx` keeps the latest closure in `onSceneChangeRef` and exposes a `stableOnSceneChange` via `useCallback` with empty deps; same pattern for `stableExcalidrawAPI`. (b) The wrapper functions read from the ref so callers still see the latest state. (c) The inline comment in `context-canvas-view.tsx` documents the ref pattern + tunnel-rat behaviour so future refactors don't reintroduce the bug. (d) Any future addition of props to `<Excalidraw>` that are functions or React-tree-referencing objects MUST follow the same stabilization pattern. Added 17. 5. 2026.

## Spatial canvas (Wave 9)

The Map view is an infinite Excalidraw canvas where every `ContextEntry` can be dropped as a card, dragged to a fixed position, and connected to other cards with typed arrows that map back to `ContextLink` rows. Cards are React overlay `<div>`s synced to Excalidraw rectangle screen-coords every animation frame; the scene blob (elements + appState + files) is the storage source of truth alongside the `CanvasNode` table.

- **Schema (Wave 9 Phase 1).** Two new tables and one enum extension. `CanvasLayout` (`@@unique([userId, slug])`, 2 MiB JSONB `canvas` CHECK + 8 KiB JSONB `viewport` CHECK, indexes on `[userId, updatedAt desc]` + `[workspaceId]`). `CanvasNode` (`@@unique` on `[canvasLayoutId, contextEntryId]` AND `[canvasLayoutId, excalidrawElementId]`, indexes on userId, workspaceId, contextEntryId, all CASCADE FKs). `ContextLinkSource` enum extended with `CANVAS` for arrow-drawn-on-canvas links. Hand-written migrations `20260514000001`/`02`/`03`. Activity event enum extended with `CANVAS_LAYOUT_CREATED`, `CANVAS_LAYOUT_DELETED`, `CANVAS_NODE_ADDED`, `CANVAS_NODE_REMOVED` in migration `20260514000004`.

- **Engine.** `@excalidraw/excalidraw@^0.18.1` (MIT, React 19 supported as of 0.18.0). `.tldr` import was dropped from W9 scope in the Phase 0 spike: `@tldraw/file-format` on npm is a 3-year-old abandoned canary, and the real parser lives inside the proprietary tldraw SDK. Excalidraw component lives entirely in `apps/web`; no shared package consumes its types.

- **Services (3 new, `apps/web/lib/services/`).** `canvasLayoutService` (list omits the canvas blob; getById/getBySlug/getDefault include the canvas + nodes + entry metadata; getDefault lazily creates "Personal" with race-tolerance via P2002 catch + `didCreate` flag; create auto-derives slug; update pre-flights the 2 MiB + 8 KiB caps before the Prisma write; delete refuses if it would leave zero layouts). `canvasNodeService` (verifyLayoutOwnership + verifyEntryOwnership helpers; upsert + bulkUpsert via prisma.$transaction; removeFromLayout + removeMany via raw SQL DELETE with userId+workspaceId guards matching the DZ-16 pattern; only inserts/removes fire activity events, position-drag updates are intentionally silent). `canvasImportService` (pure parse: `.excalidraw` only, 4 MiB pre-parse cap, 5000-element cap, tolerant of optional envelope type field; `mergeScenes` does id-keyed element dedup). Permission gates: WRITE_NODE on upserts, DELETE_NODE on deletes.

- **API routes (7 endpoints across 5 files, `apps/web/app/api/canvas/`).** `layouts/route.ts` (GET list, POST create), `layouts/[id]/route.ts` (GET detail, PATCH update, DELETE), `layouts/[id]/nodes/route.ts` (POST bulk upsert/remove, 500 ops cap), `layouts/[id]/nodes/[contextEntryId]/route.ts` (DELETE single), `layouts/default/route.ts` (GET default-or-create), `import/route.ts` (POST JSON body with pre-parsed scene; rejects format != "excalidraw"). All five follow auth-parse-service-respond; security audit PASS with zero findings.

- **React Query hooks (`apps/web/lib/hooks/use-canvas.ts`).** `useCanvasLayouts` (30s staleTime, list, excludes canvas blob), `useCanvasLayout(id)` (30s, full scene + nodes), `useDefaultCanvasLayout(enabled?)`, `useCreateLayout` (confetti on success), `useUpdateLayout` (invalidates layouts list ONLY when metadata fields change; pure-canvas updates skip list invalidation so the autosave path doesn't thrash), `useDeleteLayout`, `useUpsertNodes`, `useRemoveNode`, `useImportFile`. `apps/web/lib/hooks/use-canvas-autosave.ts` owns the 1.5s debounced autosave: PATCH canvas blob + bulk-upsert any position deltas detected from card-rect elements. Flushes on beforeunload and unmount. Status pill: idle/saving/saved/failed.

- **Card overlay (`apps/web/components/context/canvas/canvas-card-overlay.tsx`).** For each `CanvasNode`, renders an absolutely-positioned `<button>` whose `transform: translate3d(x, y, 0)` is recomputed every rAF tick from `excalidrawAPI.getAppState()`. Three zoom regimes: full card (≥0.6×), compact (0.35-0.6×), mini-dot (<0.35×). Threshold gate (0.5px / 0.001 zoom) on state updates keeps React renders bounded.

- **Edge sync (`apps/web/components/context/canvas/canvas-edge-sync.ts`).** Existing ContextLinks whose endpoints both exist as CanvasNodes on the layout render as Excalidraw arrows with `customData.kind: "edge"` + `linkId` + `linkType`, colored via `@ascend/graph` `edgeColor`. User-drawn arrows binding two card rectangles fire the type picker; on confirm, `useCreateContextLink({ source: "CANVAS" })` runs and the arrow is tagged. Removed managed arrows fire `useDeleteContextLink`. `diffArrows(prev, next, cardElementIds)` is the core helper.

- **Layout switcher (`apps/web/components/context/canvas/canvas-layout-switcher.tsx`).** Top-left toolbar dropdown listing the user's layouts with click-to-switch + active checkmark + node count + per-row kebab menu. Footer "+ New layout" creates an empty layout inline. Rename and delete dialogs share standard shadcn Dialog/AlertDialog primitives.

- **Import + Export (`apps/web/components/context/canvas/canvas-import-dialog.tsx`, `canvas-export.ts`).** Import is JSON body (not multipart); client parses the `.excalidraw` file, validates the envelope, then POSTs to `/api/canvas/import`. Replace vs merge mode. `.tldr` files surface a tldraw→excalidraw export tip with an outbound link. Export serializes the scene via `excalidrawAPI.getSceneElementsIncludingDeleted` + `getAppState` + `getFiles` and triggers a Blob download.

- **MCP tools (3 new, count 76 → 79).** `get_canvas_layout`, `set_node_position`, `create_annotation` (six kinds: freehand / rectangle / ellipse / text / sticky / frame). Handler at `apps/web/lib/mcp/tools/canvas-tools.ts` patches BOTH the CanvasNode and the rectangle in the canvas blob so client renders reflect agent-driven changes.

- **Activity events.** Four canvas event types render in `/activity` with deep links to the affected entry where applicable. New "Canvas" filter group sits between Links and Members in the filter sidebar.

- **Snapshot triggers.** Canvas position changes do NOT trigger Wave 7 NodeVersion snapshots; canvas position is layout metadata, not entity content. Documented inline in canvas-node-service.

- **Time-travel banner.** When `useUIStore.graphViewAtDate` is set, the Map view goes read-only with a centered banner: "Map shows current state only. Switch to Graph for time-travel." Excalidraw mounts with `viewModeEnabled={true}` and disables all interactions.

- **Stable prop identity (17. 5. 2026 crash fix, DZ-27).** `<Excalidraw>` MUST receive callback props (especially `onChange` and `excalidrawAPI`) with stable identity across renders, otherwise its internal tunnel-rat `useSyncExternalStore` infinite-loops with "Maximum update depth exceeded". `context-canvas-view.tsx` solves this with `onSceneChangeRef.current` + `useCallback`-with-empty-deps wrappers (`stableOnSceneChange`, `stableExcalidrawAPI`). Future props that are functions or React-tree-referencing objects (e.g., `validateEmbeddable`, `renderTopRightUI`) MUST be wrapped the same way. See DZ-27 for the full incident.

- **Must-fix items shipped 17. 5. 2026 (Wave 9 close, real).** Card drag (was `locked: true`, now `locked: false` with rAF-tracked overlay), card click → detail Sheet (`selectedEntryId` + `<Sheet>` with `ContextEntryDetail`), `+ Add card` toolbar picker (`CanvasAddCardDialog` with search + keyboard nav + pan-to-existing-card-on-canvas + viewport-center placement). Plus copy polish, view-switcher tooltips, dot-grid loading skeleton, and the `CanvasViewErrorBoundary` that auto-resets `useUIStore.contextActiveView` to `"list"` on render failure (DZ-7 mitigation; eliminates "permanently locked out of /context" footgun). `ax:critique` verdict moved NEEDS WORK → GOOD.

- **Diagnostic scaffolding (kept in tree, no production impact).** `ContextCanvasViewMounted` is **exported** and accepts an optional `CanvasBisectionFlags` prop with 13 flags (`noOverlay`, `noSheet`, `noTypePicker`, `noOnChange`, `noInitialData`, `noApiCallback`, etc.). All flags default to false. The `ContextCanvasView` wrapper never threads bisection through, so production behavior is identical. `apps/web/app/test-canvas-full/page.tsx` mounts the full tree with fake QueryClient + Zustand state and URL-flag bisection (`?noOverlay&noOnChange&...`) for future Excalidraw-class debugging. `apps/web/app/test-canvas/page.tsx` is the bare-Excalidraw regression baseline.

## Deployment

Deployed via Dokploy (dokploy-personal) to `ascend.nativeai.agency`. Auto-deploys on push to main via GitHub provider. Docker build from the root `Dockerfile`.

@import rules/ascend-workflow.md
@import rules/service-patterns.md
@import rules/api-route-patterns.md
@import rules/component-patterns.md
@import rules/mcp-tool-patterns.md
@import rules/accessibility.md
