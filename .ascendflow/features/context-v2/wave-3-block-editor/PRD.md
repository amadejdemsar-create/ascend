# Wave 3: Block Editor

**Slug:** `context-v2` / `wave-3-block-editor`
**Created:** 26. 4. 2026
**Status:** planning (Wave 2 closed at `96769c1` + parse-fix `11457d2`, Context Map verified end-to-end)
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W3 section starts ~line 295)
**Related decision:** [Wave 0 LEXICAL-SPIKE.md](../wave-0-platform-foundation/LEXICAL-SPIKE.md) (locks in Lexical-on-web, native editor on mobile, shared Markdown serialization)
**Wave sizing:** 4-6 weeks per VISION; target 12-18 working days at the cadence Waves 0-2 hit.
**Most complex single wave** per VISION.md.

## Problem

`ContextEntry.content` is a plain Markdown textarea. To match the vision (Notion-grade editing) the entry needs to be a structured block document: paragraphs, headings, lists, todos, toggles, callouts, code, quotes, dividers, images, files, tables, typed wikilinks, mentions, AI insertions, embeds. The textarea bottlenecks every other future capability: AI block insertions (Wave 2's AIBlock placeholder), file attachments inline (Wave 4), database row inline-edit (Wave 5), real-time collaboration (Wave 8).

Wave 3 introduces:

1. `packages/editor` — a platform-agnostic Lexical configuration: node definitions, transforms, Markdown round-trip serializer.
2. CRDT from day one — every block document is a Yjs doc, persisted as a binary state vector. Wave 8 layers WebSocket sync on top; Wave 3 ships single-user HTTP autosave that uses the same Yjs doc format.
3. A new `context-block-editor.tsx` web component replacing the textarea on the entry detail panel.
4. Slash menu + inline toolbar + Notion-equivalent keyboard shortcuts.
5. Non-destructive migration: existing markdown stays in `ContextEntry.content`; the new `BlockDocument` becomes the source of truth on first edit. Markdown export per node always produces valid Markdown for portability.
6. Block-level API + 5 new MCP tools so connected agents can manipulate documents at the block level instead of round-tripping the whole text.

## User Story

As a thinker, I want to write inside Ascend the way I write in Notion or Obsidian, so that my notes can have structure (headings, todos, callouts) and richness (typed wikilinks rendering as pills, images inline, code with syntax highlighting) without me leaving the app or losing portability. As an AI agent connected via MCP, I want to insert and modify blocks in a user's note without rewriting the entire document, so that my edits are surgical and auditable.

## Success Criteria

### Functional

- [ ] New `packages/editor` workspace package exports Lexical node definitions, theme, transforms, and Markdown serializer/deserializer. Platform-agnostic (no `react-dom`, no `next/*`, no `react-native`).
- [ ] **17+ block types** implemented: Paragraph, Heading 1-3, BulletedList, NumberedList, ToDo, Toggle, Callout, Code (with syntax highlight via `@lexical/code`), Quote, Divider, Image, File, Table, WikiLink (typed), Mention, AIBlock, Embed.
- [ ] Lexical + Yjs integration via `@lexical/yjs`. Editor state IS a Yjs doc; binary updates persisted to the server.
- [ ] New `BlockDocument` Prisma model: per-entry doc state (binary Yjs update vector + JSON snapshot for read-side queries + version int). Linked from `ContextEntry.blockDocumentId` (nullable FK).
- [ ] Slash-command menu (type `/`): block picker filterable by name. Inline toolbar (selection-based formatting): bold, italic, underline, strikethrough, inline code, link, color.
- [ ] Markdown round-trip: import existing `ContextEntry.content` to a Lexical block doc; export any block doc back to Markdown. Round-trip lossless for the supported node set; fallback to plain text for unsupported nodes (graceful degradation).
- [ ] Migration: opening an entry that has `content` but no `blockDocumentId` triggers a one-time markdown→blocks conversion + `BlockDocument` creation. Original Markdown is preserved in `ContextEntry.content` for fallback / search index.
- [ ] `search_vector` continues to work: write hook on `BlockDocument` save extracts plain text and updates `ContextEntry.content` (or a new `extractedText` column) so tsvector full-text search keeps indexing the doc.
- [ ] HTTP autosave: on blur or every N seconds, the editor POSTs the latest Yjs binary update to `/api/context/[id]/blocks/sync`. Server applies, persists, returns acknowledgment. Conflict resolution: Yjs merges automatically; the server is the single canonical state for now.
- [ ] Block-level API: `GET /api/context/[id]/blocks` returns the block tree as JSON. `POST /api/context/[id]/blocks` adds a block. `PATCH /api/context/[id]/blocks/[blockId]` updates one. `DELETE` removes one. `POST /api/context/[id]/blocks/move` reorders.
- [ ] **5 new MCP tools (round 3):** `get_blocks`, `add_block`, `update_block`, `move_block`, `delete_block`. All Zod-validated inside handlers, all invoke service-layer methods, all userId-scoped. **MCP tool count: 50 → 55.**
- [ ] Detail panel inline-edit pattern preserved: clicking a block opens it for inline editing; changes autosave on blur.
- [ ] Keyboard shortcuts (Notion-equivalent): Cmd+B bold, Cmd+I italic, Cmd+U underline, Cmd+E inline code, Cmd+Shift+1/2/3 heading, Cmd+Shift+8 bullet list, Cmd+Shift+9 numbered list, `[[` for wikilink autocomplete, `@` for mention autocomplete, `/` for slash menu, Cmd+Z / Cmd+Shift+Z undo/redo (Yjs-aware history).
- [ ] AI integration: typing `/ai` in the slash menu inserts an AIBlock that, when triggered, calls `llmService.chat` (Wave 2 substrate) with the surrounding context as input. Response streams in (or returns whole on first version) and the AIBlock is replaced by content blocks.
- [ ] WikiLink pill: rendering a `[[Title]]` (or `[[relation:Title]]`) shows a clickable pill that navigates to the target entry. Hovering shows the target's title + type. Inline `[[` triggers an autocomplete dropdown over titles.

### Quality

- [ ] Every existing entry on prod renders in the new editor without content loss. Migration script verifies round-trip on every entry; reports any lossy migrations.
- [ ] Yjs autosave latency < 200ms p99 on a typical paragraph edit.
- [ ] Block editor cold-load < 2s on `/context` detail panel for a 50-block document.
- [ ] Slash menu responds to keystrokes within 50ms.
- [ ] `npx tsc --noEmit` and `pnpm --filter @ascend/web build` pass with zero errors.
- [ ] `ascend-architect` audit on `packages/editor`: PASS with zero cross-platform violations.
- [ ] `ascend-security` audit on the `/api/context/[id]/blocks/*` routes: PASS (every Prisma query userId-scoped; Yjs binary inputs size-capped to prevent DoS; no XSS in block rendering).
- [ ] `ascend-migration-auditor` audit on the `BlockDocument` migration: PASS (additive, search_vector preserved, backfill is a no-op on entries without content, idempotent).
- [ ] `ascend-critic` verdict at GOOD or WORLD-CLASS at wave close.

### Cross-platform readiness

- [ ] `packages/editor` is platform-agnostic. Specifically:
  - Node definitions, theme tokens, Markdown serializer, transforms — all pure TS.
  - The web binding (using `@lexical/react`) lives in `apps/web/components/context/context-block-editor.tsx` and imports node definitions from `@ascend/editor`.
  - Wave 6 mobile editor (using `react-native-enriched` or equivalent native-rich-text library) will read/write the same Markdown, NOT the same Lexical state, per the Lexical Spike decision. The shared serialization is Markdown.
- [ ] Yjs binary state is platform-portable. A doc written from web can be read on mobile (Wave 6) once a Yjs-compatible binding is added. Wave 6 may choose to round-trip Markdown only (simpler) and skip Yjs on mobile until Wave 8 collaboration; that is the Wave 6 PRD decision.
- [ ] No blockers introduced for Wave 4 (Universal files) or Wave 6 (Mobile). Files block (Wave 4) plugs into the Image / File / Embed nodes that Wave 3 reserves placeholders for.

## Affected Layers

- **Prisma schema:**
  - New `BlockDocument` model: `id` cuid, `userId` FK CASCADE, `entryId` FK to ContextEntry CASCADE @unique, `state` Bytes (Yjs binary update vector), `snapshot` Json (read-side block tree for fast SSR + indexing), `version` Int (incremented on each save), `createdAt`, `updatedAt`.
  - `ContextEntry.blockDocumentId` String? @unique (nullable; populated on first edit).
  - `ContextEntry.extractedText` String? (denormalized plain text from the block doc; feeds `search_vector` trigger).
  - DZ-2 trap: hand-write the migration; do not let `prisma migrate dev` apply.
- **Packages:** new `packages/editor/` exporting:
  - Node classes: `WikiLinkNode`, `MentionNode`, `AIBlockNode`, `EmbedNode`, `CalloutNode`, `ToggleNode`, `FileNode`, `ImageNode` (`ImageNode` from `@lexical/image` if available, else custom), and re-exports of `@lexical/code`, `@lexical/list`, `@lexical/heading` etc.
  - `THEME` token map (CSS variable names — no actual styles, since UI tokens are at `@ascend/ui-tokens`).
  - `markdownToBlocks(md: string): SerializedEditorState` — uses `@lexical/markdown` `$convertFromMarkdownString` with custom transforms for wikilinks + mentions.
  - `blocksToMarkdown(state: SerializedEditorState): string` — inverse.
  - `extractText(state: SerializedEditorState): string` — flatten to plain text for `extractedText` column.
- **Service layer (`apps/web/lib/services/`):**
  - `blockDocumentService` — CRUD on `BlockDocument`, Yjs apply-update + version increment on save, snapshot regeneration on save. `userId` scoped on every method.
  - `blockMigrationService` — convert legacy markdown to blocks for one entry; idempotent.
  - Hook into `contextService.update`: when `content` changes externally (e.g., MCP `set_context`) without going through the editor, regenerate `BlockDocument` from the new markdown.
- **API routes:**
  - `GET /api/context/[id]/blocks` — return block snapshot.
  - `POST /api/context/[id]/blocks/sync` — accept Yjs binary update; persist; return latest version.
  - `POST /api/context/[id]/blocks` — add a block (LLM-friendly).
  - `PATCH /api/context/[id]/blocks/[blockId]` — update a block.
  - `DELETE /api/context/[id]/blocks/[blockId]` — delete a block.
  - `POST /api/context/[id]/blocks/move` — reorder blocks.
- **React Query hooks:** `useBlockDocument(entryId)`, `useSyncBlockDocument(entryId)` (mutation), `useBlockOps()` for the LLM-friendly path used by AIBlock.
- **UI components:**
  - `apps/web/components/context/context-block-editor.tsx` — full Lexical web binding (`<LexicalComposer>`, plugins for history, list, link, code, markdown, autosave, slash menu, inline toolbar).
  - `apps/web/components/editor/slash-menu.tsx` — block picker triggered by `/`.
  - `apps/web/components/editor/inline-toolbar.tsx` — selection-based formatting bar.
  - `apps/web/components/editor/wikilink-pill.tsx` — pill renderer for `WikiLinkNode`.
  - `apps/web/components/editor/mention-pill.tsx` — same for `MentionNode`.
  - `apps/web/components/editor/ai-block.tsx` — placeholder + trigger UI.
- **MCP tools:** 5 new tools in `apps/web/lib/mcp/tools/block-tools.ts`. New Set `BLOCK_TOOL_NAMES` in `apps/web/lib/mcp/server.ts` dispatch.
- **Zustand:** extend `uiStore` with editor settings (e.g., `blockEditorAutosaveMs`, default 1500). Keep slim.

## Data Model Changes

```prisma
model ContextEntry {
  // existing fields preserved
  blockDocumentId  String?         @unique
  blockDocument    BlockDocument?  @relation(fields: [blockDocumentId], references: [id])
  extractedText    String?         // denormalized plain text from blocks; feeds search_vector
}

model BlockDocument {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  entryId      String        @unique
  entry        ContextEntry?
  state        Bytes         // Yjs binary update vector (full doc state, not deltas)
  snapshot     Json          // read-side block tree for SSR + indexing
  version      Int           @default(1)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([userId, entryId])
}
```

**Migrations (hand-written, applied via `prisma migrate deploy`):**

1. `add_block_document` — create `BlockDocument` table + add `blockDocumentId` and `extractedText` to `ContextEntry`. NO touch on `search_vector`.
2. `update_search_vector_trigger` — extend the existing trigger so it indexes `extractedText` in addition to `content` when `extractedText` is non-null. (DZ-2: this is the most delicate migration; auditor must PASS.)

## API Contract

### `GET /api/context/[id]/blocks`

Authenticate. Return `{ snapshot: SerializedEditorState, version: number }` or 404 if `blockDocumentId` is null.

### `POST /api/context/[id]/blocks/sync`

Authenticate. Body: `{ update: base64-encoded Yjs update, expectedVersion: number }`. Server applies update to stored doc, increments version, regenerates snapshot, returns `{ version: number, conflict: false }`. If `expectedVersion` is stale (server has newer version), return `{ version, conflict: true, latest: SerializedEditorState }` and the client merges via Yjs CRDT semantics.

Size limit: 256 KiB per update. Larger payloads return 413.

### `POST/PATCH/DELETE /api/context/[id]/blocks/...`

LLM-friendly mutation routes. Each takes a Zod-validated body, applies the change to the stored Yjs doc, persists, returns the updated snapshot.

### `POST /api/context/[id]/blocks/move`

Body: `{ blockId, beforeId? | afterId? | parentId? }`. Reorders.

## UI Flows

### `/context` detail panel

Where the `<textarea>` was, the new `<ContextBlockEditor entryId={...} />` mounts. First render reads the snapshot via `useBlockDocument`. The Lexical composer initializes from the snapshot; binds a Yjs doc to the same ID. Edits trigger autosave debounced to 1.5s after last keystroke (configurable in settings).

Slash menu: typing `/` at the start of a paragraph (or after whitespace) opens a floating menu. Arrow keys + Enter to pick.

Inline toolbar: selecting any text shows a floating toolbar with Bold, Italic, Underline, Strikethrough, Inline Code, Link, Color. Cmd+K for link.

WikiLink autocomplete: typing `[[` opens a floating list of entry titles. Up/Down to pick. Enter inserts a `WikiLinkNode` pill. Backspace deletes the whole pill.

Mention autocomplete: typing `@` opens a list of users / goals / todos.

AIBlock: slash menu has `/ai` option. Inserts an `AIBlockNode` with a prompt input; on submit, calls `llmService.chat` (Wave 2), streams response, replaces with content blocks.

### First-edit migration UX

User opens an entry that has legacy markdown content but no block doc. The editor mounts, sees `blockDocumentId == null`, calls a one-time POST `/api/context/[id]/blocks/migrate` which converts the markdown → blocks → creates the `BlockDocument`. User sees the block-rendered version immediately. Original markdown stays in `content` as fallback.

### Keyboard shortcuts

Listed in Success Criteria. Help dialog on `?` (Shift+/) lists all shortcuts.

## Cache Invalidation

- `POST /api/context/[id]/blocks/sync` → invalidate `queryKeys.context.blocks(entryId)` and `queryKeys.context.detail(entryId)`. Do NOT invalidate the search results (search_vector trigger handles index update).
- Block-level mutation routes → same invalidations.
- Migration trigger → invalidate `queryKeys.context.detail(entryId)`.

## Danger Zones Touched

- **DZ-2 (search_vector):** the migration extends the search_vector trigger to also index `extractedText`. This is a delicate change. The auditor must verify the trigger update is additive (UNION the new column into the existing tsvector concat) and does NOT drop the existing column from the index expression.
- **DZ-7 (no error boundaries):** the block editor is a non-trivial render surface. A bad Yjs state could throw on mount. Add a per-entry error boundary around `<ContextBlockEditor>` that falls back to the legacy markdown textarea if Lexical fails.
- **NEW: DZ-10 (Yjs binary state size).** A pathological doc could grow large. Mitigation: hard cap on `state` column at 1 MiB per doc; reject saves over the cap; flag in monitoring. Also: the Yjs `update` payloads on `/sync` are capped at 256 KiB per call.
- **NEW: DZ-11 (block tree XSS).** `Embed` nodes accept URLs the user provides. The renderer MUST sanitize URLs (deny `javascript:`, `data:`, etc.) and render embeds in a sandboxed iframe with `sandbox="allow-scripts allow-same-origin"` only when explicitly opted in. The `WikiLink` pill renders trusted internal entry IDs only.

## Out of Scope (deferred)

- **Real-time collaboration / WebSocket sync** → Wave 8. Wave 3 is Yjs single-user; the doc model is already CRDT but the transport is HTTP autosave.
- **Mobile editor** → Wave 6. Different native editor, shared Markdown.
- **Rich Image node with cropping / resizing UI** → Wave 4. Wave 3 ships a placeholder Image node that just stores a URL.
- **File attachments inline** → Wave 4. Wave 3 ships a File node placeholder.
- **Database row inline edit** → Wave 5.
- **Comments on blocks** → Wave 8.
- **Versioning / revision history** → Wave 7+.
- **Export to formats other than Markdown** (PDF, HTML, DOCX) → not in this wave.

## User-Side Prerequisites

None. Wave 3 is fully runtime-internal: no new API keys, no infra changes. The build will pull `@lexical/*` packages on first install; no env vars or secrets needed.

## Open Questions

- **Yjs storage strategy:** store `state` as one binary blob (full doc state) or as an append-only log of update vectors with periodic compaction? Phase 1 decision; recommendation: full state blob for simplicity, since collaboration is not in scope yet.
- **Snapshot regeneration cadence:** every save vs background job? Phase 3 decision; recommendation: every save, since docs are small.
- **AIBlock streaming:** stream tokens (Server-Sent Events) or return the full result? Phase 7 decision; recommendation: return full result first; streaming is polish for a later wave.
- **`@lexical/yjs` peer dep on `react-dom`:** confirm at Phase 1 that the bindings package does NOT bleed `react-dom` into `packages/editor`. If it does, the binding moves to `apps/web` and `packages/editor` only exports framework-free node defs.
