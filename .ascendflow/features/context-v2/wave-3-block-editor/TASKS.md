# Implementation Tasks: Wave 3 — Block Editor

**Parent:** [PRD.md](./PRD.md) · [VISION.md](../VISION.md) · [LEXICAL-SPIKE.md](../wave-0-platform-foundation/LEXICAL-SPIKE.md)
**Sizing:** 12-18 working days solo (PRD targets 4-6 weeks; observed cadence at Waves 0-2 hits ~10x). Prerequisite: Wave 2 closed (`96769c1` + `11457d2`). No user-side blockers.
**All implementation delegated to `ascend-dev` with per-phase audits by `ascend-architect`, `ascend-migration-auditor`, `ascend-security`, `ascend-reviewer`.**

---

## Phase 1: Schema + migrations + Zod (Days 1-2)

### 1.1 Web-check current Lexical + Yjs versions

Per the Fast-Moving Identifiers rule, scrape:
- https://lexical.dev/docs/getting-started/react — current `lexical` + `@lexical/react` major versions
- https://www.npmjs.com/package/lexical — latest published version
- https://www.npmjs.com/package/@lexical/yjs — confirm exists, binding API surface
- https://www.npmjs.com/package/yjs — current Yjs version, confirm Node + browser compatible

Output: `MODEL-DECISION.md`-equivalent at `.ascendflow/features/context-v2/wave-3-block-editor/STACK-DECISION.md` pinning versions of `lexical`, `@lexical/react`, `@lexical/yjs`, `@lexical/code`, `@lexical/list`, `@lexical/markdown`, `yjs`, `y-protocols`, with last-verified date and source URL.

Confirm `@lexical/yjs` does NOT pull in `react-dom`. If it does, the binding moves to `apps/web` only and `packages/editor` exports framework-free node defs.

### 1.2 Hand-write schema migration

`apps/web/prisma/migrations/2026042600XXXX_add_block_document/migration.sql`:

```sql
-- ContextEntry gets a nullable FK to BlockDocument + denormalized extracted text.
ALTER TABLE "ContextEntry" ADD COLUMN "blockDocumentId" TEXT;
ALTER TABLE "ContextEntry" ADD COLUMN "extractedText" TEXT;
CREATE UNIQUE INDEX "ContextEntry_blockDocumentId_key" ON "ContextEntry"("blockDocumentId");

-- BlockDocument table.
CREATE TABLE "BlockDocument" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "entryId"   TEXT NOT NULL,
  "state"     BYTEA NOT NULL,
  "snapshot"  JSONB NOT NULL,
  "version"   INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlockDocument_userId_fkey"   FOREIGN KEY ("userId")  REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "BlockDocument_entryId_fkey"  FOREIGN KEY ("entryId") REFERENCES "ContextEntry"("id") ON DELETE CASCADE,
  CONSTRAINT "BlockDocument_entryId_key"   UNIQUE ("entryId")
);

CREATE INDEX "BlockDocument_userId_entryId_idx" ON "BlockDocument"("userId", "entryId");

ALTER TABLE "ContextEntry"
  ADD CONSTRAINT "ContextEntry_blockDocumentId_fkey"
  FOREIGN KEY ("blockDocumentId") REFERENCES "BlockDocument"("id") ON DELETE SET NULL;
```

### 1.3 Hand-write search_vector trigger update

Second migration `2026042600XXXX_extend_search_vector_trigger/migration.sql`. Read the existing `search_vector` trigger function; add `extractedText` to the tsvector concat with COALESCE on null. Verify pre/post via `\df+ context_entry_search_vector_trigger` on dev DB.

**DZ-2 critical:** do NOT drop the function; ALTER. The auditor must PASS.

### 1.4 Update `apps/web/prisma/schema.prisma`

Add `BlockDocument` model + `blockDocumentId` + `extractedText` on `ContextEntry`. Run `npx prisma generate` (NOT `migrate dev`).

### 1.5 Zod schemas in `@ascend/core`

`packages/core/src/schemas/blocks.ts`:
- `serializedEditorStateSchema` — minimal validation of the Lexical state JSON shape (root + children array). Permissive on inner block shapes since Lexical evolves.
- `blockOpAddSchema`, `blockOpUpdateSchema`, `blockOpMoveSchema`, `blockOpDeleteSchema` for the LLM-friendly mutation routes.
- `syncBlockUpdateSchema` for the `/sync` endpoint: `{ update: base64Schema, expectedVersion: int }`.
- `blockDocumentSnapshotSchema` for read responses.

Re-export everywhere (`packages/core/src/schemas/index.ts`, `apps/web/lib/validations.ts`).

### 1.6 Delegate audits

- `ascend-migration-auditor` on the 2 migrations. Must PASS, especially the trigger update.
- `ascend-architect` on the schema additions (no UI-only types in core).

### 1.7 Commit

`feat(db): Wave 3 Phase 1 — BlockDocument table + search_vector trigger extension + Zod`

DO NOT push yet (migrations are unapplied; we apply via deploy after the package + service code is in).

---

## Phase 2: `packages/editor` scaffold + node definitions + Markdown round-trip (Days 3-5)

### 2.1 Scaffold `packages/editor`

`/ax:package editor`. Verify `/ax:cross-platform-check` reports zero violations. tsconfig `lib: ["ES2022"]` (no DOM).

### 2.2 Install deps

In `packages/editor/package.json` add `lexical`, `@lexical/markdown`, `@lexical/code`, `@lexical/list`, `@lexical/link`, `@lexical/rich-text`, `@lexical/utils`, `@lexical/yjs`, `yjs`. Pin to versions from STACK-DECISION.md.

### 2.3 Custom node definitions

`packages/editor/src/nodes/`:
- `wikilink-node.ts` — `WikiLinkNode` extends `DecoratorNode`. Stores `relation: ContextLinkType`, `targetTitle: string`, `targetEntryId?: string`. `decorate()` returns a placeholder; the actual pill UI is in `apps/web/components/editor/wikilink-pill.tsx`.
- `mention-node.ts` — `MentionNode` for @users / @goals / @todos. Stores `kind`, `id`, `label`.
- `ai-block-node.ts` — `AIBlockNode` extends `DecoratorBlockNode`. Stores `prompt`, `state` ("idle" | "running" | "done"), `result?`.
- `embed-node.ts` — `EmbedNode` for URL unfurls. Stores `url`, `title?`, `description?`, `image?`. Renderer in app layer.
- `callout-node.ts` — `CalloutNode` (block) with variant: info / warning / success / danger.
- `toggle-node.ts` — collapsible block.
- `file-node.ts` — placeholder for Wave 4 file attachments. Stores `fileId`.
- `image-node.ts` — placeholder. Stores `src`, `alt?`, `caption?`.

Re-use built-in nodes (`HeadingNode`, `QuoteNode`, `ListNode`, `ListItemNode`, `LinkNode`, `CodeNode`, `CodeHighlightNode`, `HorizontalRuleNode`, `TableNode`, etc.) from `@lexical/*`.

### 2.4 Theme tokens

`packages/editor/src/theme.ts` — class-name map keyed by node type. Class names match `apps/web/styles/editor.css` defined in Phase 6. Tokens reference `@ascend/ui-tokens` (no hex literals).

### 2.5 Markdown round-trip

`packages/editor/src/markdown/`:
- `transformers.ts` — extend `@lexical/markdown` `TRANSFORMERS` with custom transformers for `WikiLinkNode` (matches `[[Title]]` and `[[relation:Title]]`, leverages `parseWikilinks` from `@ascend/core`), `MentionNode`, `CalloutNode`, `ToggleNode`, `EmbedNode`.
- `markdown-to-blocks.ts` — `markdownToBlocks(md: string): SerializedEditorState` using `$convertFromMarkdownString` with the extended TRANSFORMERS.
- `blocks-to-markdown.ts` — inverse via `$convertToMarkdownString`.
- Round-trip test fixtures (5-10 sample documents): paragraph, headings, lists, code with language, wikilinks (typed + plain), mentions, AIBlock placeholder, callout, image. Verify `markdownToBlocks(blocksToMarkdown(state))` equals `state` (within Lexical equivalence rules) and `blocksToMarkdown(markdownToBlocks(md))` equals `md`.

### 2.6 Plain text extraction

`packages/editor/src/extract.ts`:
- `extractText(state: SerializedEditorState): string` — recursively flatten text nodes; skip non-text decorator nodes; preserve newlines between blocks. Used for the `extractedText` denormalization.

### 2.7 Public API

`packages/editor/src/index.ts` re-exports: nodes, theme, transformers, `markdownToBlocks`, `blocksToMarkdown`, `extractText`, plus `ALL_NODES` array (the list of node classes to register on a Lexical composer).

### 2.8 Verify + audit

- `pnpm --filter @ascend/editor build` — PASS
- `pnpm --filter @ascend/editor typecheck` — PASS
- `/ax:cross-platform-check` — zero violations
- `ascend-architect` audit — must PASS

### 2.9 Commit

`feat(editor): Wave 3 Phase 2 — packages/editor with Lexical nodes + Markdown round-trip`

---

## Phase 3: Service layer + autosave + Yjs persistence (Days 6-7)

### 3.1 `apps/web/lib/services/block-document-service.ts`

Methods:
- `getByEntryId(userId, entryId): Promise<BlockDocument | null>` — userId-scoped read.
- `applySync(userId, entryId, base64Update, expectedVersion): Promise<{version, conflict, latest?}>` — decode update, apply via Yjs (`Y.applyUpdate(doc, update)`), regenerate snapshot, increment version, persist.
- `replaceSnapshot(userId, entryId, newSnapshot, version): Promise<BlockDocument>` — used by LLM-friendly mutation routes that operate on the snapshot directly (not as Yjs updates).
- `extractAndPersistText(userId, entryId): Promise<void>` — call `extractText` on the latest snapshot, write to `ContextEntry.extractedText`. Called as a write hook.
- `delete(userId, entryId): Promise<void>` — for entry deletion CASCADE; usually handled by FK CASCADE but expose for explicit ops.

Constraints:
- Every Prisma query userId-scoped (safety rule 1).
- 1 MiB cap on `state` column; reject saves that would exceed.
- 256 KiB cap on individual `update` payloads at the route layer.

### 3.2 `apps/web/lib/services/block-migration-service.ts`

- `migrateEntryToBlocks(userId, entryId): Promise<BlockDocument>` — reads entry's `content`, calls `markdownToBlocks`, creates a Yjs doc from the snapshot (`Y.Doc.applyUpdate` from a snapshot helper), persists `BlockDocument`, sets `ContextEntry.blockDocumentId`. Idempotent; returns existing if already migrated.

### 3.3 Hook into `contextService`

- `contextService.update`: if `content` changed AND a `BlockDocument` exists, regenerate the doc from the new markdown. (External writes via MCP or admin tools should still produce a coherent block view.)
- `contextService.delete`: FK CASCADE handles BlockDocument cleanup.

### 3.4 `extractedText` write path

Whenever `BlockDocument` is saved (sync or replace), update `ContextEntry.extractedText` in the same transaction. The search_vector trigger picks it up.

### 3.5 Audits

- `ascend-security` PASS — no bypass, userId scoped, size caps enforced, base64 decoding safe (handle malformed input).
- Trace cost: NO LLM calls in this service. The block editor itself does not incur LLM cost; only AIBlock-triggered chats do, and those go through `llmService.chat` (DZ-9 single gate, established in Wave 2).

### 3.6 Commit

`feat(services): Wave 3 Phase 3 — blockDocumentService + blockMigrationService + Yjs persistence`

---

## Phase 4: API routes (Day 8)

### 4.1 `GET /api/context/[id]/blocks`

Authenticate. Read via service; return snapshot or 404.

### 4.2 `POST /api/context/[id]/blocks/sync`

Authenticate. Parse body via `syncBlockUpdateSchema`. Call `blockDocumentService.applySync`. Return version + conflict flag. Reject if base64 decoded > 256 KiB.

### 4.3 `POST/PATCH/DELETE /api/context/[id]/blocks/[blockId]`

LLM-friendly routes for surgical block edits. Each parses a Zod schema, mutates the snapshot, persists.

### 4.4 `POST /api/context/[id]/blocks/move`

Reorder blocks.

### 4.5 `POST /api/context/[id]/blocks/migrate`

One-shot conversion of legacy markdown to blocks. Idempotent.

### 4.6 Audits

`ascend-security` on the route group — PASS required. Specifically: payload size caps, userId scoping, malformed base64 handling, no XSS in JSON responses.

### 4.7 Commit

`feat(api): Wave 3 Phase 4 — block-level routes + sync endpoint`

---

## Phase 5: React Query hooks (Day 9)

### 5.1 `apps/web/lib/hooks/use-block-document.ts`

- `useBlockDocument(entryId)` — GET /blocks
- `useSyncBlockDocument(entryId)` — POST /sync; mutation; debounced caller in editor component
- `useMigrateBlockDocument(entryId)` — POST /migrate
- `useBlockOps(entryId)` — wraps add / update / move / delete for AIBlock and MCP tools

### 5.2 Query keys

`apps/web/lib/queries/keys.ts`:
- `queryKeys.context.blocks(entryId)`
- `queryKeys.context.blockDocument(entryId)`

### 5.3 Cache invalidation

After successful sync: invalidate `queryKeys.context.blocks(entryId)` and `queryKeys.context.detail(entryId)`. (Not the search index — trigger handles it.)

### 5.4 Commit

`feat(hooks): Wave 3 Phase 5 — block document React Query hooks`

---

## Phase 6: UI — `context-block-editor.tsx` + slash menu + inline toolbar (Days 10-13)

### 6.1 `apps/web/components/context/context-block-editor.tsx`

Top-level: `<LexicalComposer>` with the node set from `@ascend/editor`'s `ALL_NODES`, the THEME from `@ascend/editor`. Plugins:
- `<HistoryPlugin>` (Yjs-aware undo/redo)
- `<RichTextPlugin>`
- `<ListPlugin>`, `<CheckListPlugin>`, `<LinkPlugin>`, `<MarkdownShortcutPlugin>`
- `<CodeHighlightPlugin>`
- Custom `<AutosavePlugin>` — debounces editor changes, fires `useSyncBlockDocument` mutation on quiescence
- Custom `<YjsPlugin>` — binds editor state to a Yjs doc
- Custom `<SlashMenuPlugin>`
- Custom `<InlineToolbarPlugin>`
- Custom `<WikiLinkAutocompletePlugin>`
- Custom `<MentionAutocompletePlugin>`
- Custom `<KeyboardShortcutsPlugin>`

First mount: read snapshot via `useBlockDocument`, initialize editor state. If `blockDocumentId` is null, fire `useMigrateBlockDocument` and load result.

### 6.2 Slash menu

`apps/web/components/editor/slash-menu.tsx`. ShadCN Command palette pattern. Triggered by `/` at start of paragraph. Fuzzy filter on block name. Arrow keys + Enter.

### 6.3 Inline toolbar

`apps/web/components/editor/inline-toolbar.tsx`. ShadCN floating UI (Popper). Position above selection. Buttons: Bold, Italic, Underline, Strikethrough, InlineCode, Link, Color.

### 6.4 WikiLink pill + autocomplete

`apps/web/components/editor/wikilink-pill.tsx` for the decorator render. `apps/web/components/editor/wikilink-autocomplete.tsx` triggered by `[[`.

### 6.5 Mention pill + autocomplete

Same shape, different data source (users / goals / todos lists).

### 6.6 AIBlock UI

`apps/web/components/editor/ai-block.tsx` — placeholder + prompt input + submit. On submit, calls `llmService.chat` (Wave 2 substrate) with surrounding doc context as input. On response, replaces the AIBlock with content blocks (parse the response text via `markdownToBlocks` and insert).

### 6.7 Replace textarea

`apps/web/components/context/context-entry-detail.tsx`: the existing markdown textarea is replaced by `<ContextBlockEditor entryId={entryId} />`. Fallback boundary catches errors and renders the legacy textarea reading from `ContextEntry.content`.

### 6.8 Editor styles

`apps/web/styles/editor.css` — class-name → CSS var bindings for theme tokens. ShadCN-compatible. Dark mode tested.

### 6.9 ax:verify-ui

Delegate `ascend-ui-verifier` to run a Playwright scenario:
- Open /context, pick an existing entry, see the new editor mount
- Type some content, blur, verify save round-trips
- Hit `/`, see slash menu
- Hit `[[`, see autocomplete, pick a target, see pill render
- Test heading, list, code, callout, toggle blocks
- Verify Markdown export still produces valid markdown

### 6.10 Commit

`feat(ui): Wave 3 Phase 6 — Lexical block editor + slash menu + inline toolbar + autocomplete`

---

## Phase 7: 5 MCP tools (Day 14)

### 7.1 Tool definitions

Add to `apps/web/lib/mcp/schemas.ts`:
- `get_blocks` — input `{ entryId: string }`, output: snapshot
- `add_block` — input `{ entryId, block: {type, content, ...}, afterBlockId? }`, output: updated snapshot
- `update_block` — input `{ entryId, blockId, patch }`, output: updated snapshot
- `move_block` — input `{ entryId, blockId, beforeId? | afterId? | parentId? }`, output: updated snapshot
- `delete_block` — input `{ entryId, blockId }`, output: updated snapshot

### 7.2 Handler

`apps/web/lib/mcp/tools/block-tools.ts` — Zod runtime validation, calls `blockDocumentService.replaceSnapshot` with patched state, returns McpContent.

### 7.3 Server routing

Add `BLOCK_TOOL_NAMES` Set to `apps/web/lib/mcp/server.ts`. Update tool count to 55.

### 7.4 Commit

`feat(mcp): Wave 3 Phase 7 — 5 block-level MCP tools (50 → 55)`

---

## Phase 8: Wave 3 close (Days 15-18)

### 8.1 `/ax:test`

`tsc --noEmit` + `pnpm build` PASS.

### 8.2 `/ax:review`

`ascend-reviewer` audit on the wave's commits. Must PASS.

### 8.3 `/ax:verify-ui`

Full Playwright scenario set including Wave 1 + Wave 2 surfaces (graph view, Map card, settings) to verify no regressions.

### 8.4 `/ax:critique`

`ascend-critic` verdict at GOOD or WORLD-CLASS required. Compare against Notion, Obsidian, Reflect, Mem.ai for editor quality.

### 8.5 Production smoke test

`/api/mcp tools/list` returns **55 tools**. Open prod /context → entry detail → see new editor. Verify Map card from Wave 2 still works. Verify hybrid search still works.

### 8.6 Update CLAUDE.md

- MCP tool count 50 → 55
- New entities: BlockDocument
- New views: block editor (replaces textarea on /context detail)
- Key File Lookup: `packages/editor/`, `block-document-service.ts`, `block-migration-service.ts`, `context-block-editor.tsx`
- Danger Zones: DZ-10 (Yjs state size cap), DZ-11 (block tree XSS / Embed sanitization)
- Cross-Platform Rules: `@ascend/editor` is shared; Wave 6 mobile uses different rendering binding but same Markdown serialization

### 8.7 Update BACKLOG.md

Wave 3 SHIPPED. Carry-overs:
- Streaming AIBlock tokens (Wave 4 polish)
- Real-time collaboration via WebSocket (Wave 8)
- Image / File rich UIs (Wave 4)
- Database row inline edit (Wave 5)
- Block comments (Wave 8)
- Revision history (Wave 7+)

### 8.8 Write CLOSE-OUT.md

Criterion-by-criterion status per the Wave 1 + Wave 2 pattern.

### 8.9 `/ax:deploy-check`

Final pre-push gate.

### 8.10 Commit + push

`chore(wave-3): close Wave 3 — block editor shipped`

### 8.11 Present deliverables checklist

---

## Handoff to Wave 4

Wave 4 (Universal files) assumes:
- `@ascend/editor` exposes `FileNode` and `ImageNode` placeholders that Wave 4 fills with real upload + preview UIs.
- `BlockDocument` is the source of truth; uploads attach to entries via blocks not via separate ContextEntry rows.
- Block-level MCP tools allow agents to insert files programmatically.
- 55 MCP tools live.
