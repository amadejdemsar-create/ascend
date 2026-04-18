# Context v2 — The Context Layer for Human-AI Thinking

**Slug:** `context-v2`
**Created:** 18. 4. 2026
**Status:** vision (pre-implementation)
**Horizon:** ~6 months of focused work across 10 waves + Wave 0 foundation
**Quality bar:** world-class. The intended outcome is a product that a top-tier operator (Musk, Huang, senior operators of Fortune 500s) would choose personally and for their company over Notion, Obsidian, Drive, or any single-purpose alternative.

---

## 1. Mission

Build the one knowledge system that a person or a team uses for everything that used to be spread across Notion, Obsidian, Drive, Docs, Apple Notes, Roam, and Mem — and that is equally usable by any AI assistant that speaks MCP.

### The defining property

Every piece of knowledge is a first-class node in a typed graph. The graph is:

- **Equally navigable by humans** (rich UI with many views: outline, graph, map, timeline, table, board, tree, calendar).
- **Equally writable and readable by AI** (native MCP, symmetric access with the human).
- **Unified** across text, rich blocks, structured databases, and any uploaded file.
- **Portable** (import from anywhere, export as markdown + JSON, nothing locked in).
- **Provenance-aware** (every change versioned; time travel).

No existing product has all of these at once. That is the wedge.

### Positioning statements

- To a **power individual**: "The single context for your thinking. Everything you've ever written, clipped, captured, or decided — in one searchable, AI-aware graph."
- To a **team/business**: "Your company's working memory. Every policy, principle, decision, and document, usable by every employee and every AI agent you deploy."
- To a **developer/tool-builder**: "The first knowledge base designed around MCP. Any AI assistant you build can read, write, connect, query, and reason over the user's context natively."

---

## 2. The 10 Pillars

Each pillar is a structural commitment, not a feature. We ship incomplete versions on the way to each one, but we never ship a version that contradicts one.

### P1. Unified universal content model

Not just markdown. Every node in the graph is one of:

- **Block document** (ordered list of typed blocks: paragraph, heading, list, todo, toggle, callout, code, table, image, file embed, database view, AI block).
- **Structured record** (row in a database with typed fields: text, select, multi-select, date, relation, number, formula, user, file).
- **Uploaded file** (PDF, image, audio, video, spreadsheet, CAD, arbitrary binary) with extracted text/metadata that is itself searchable and linkable.
- **AI-generated** (Context Map, synthesis, agent output) — marked as such, versioned separately.

All four are nodes. All four can be linked, tagged, categorized, versioned, shared, and queried the same way.

### P2. Graph as the model; views as the surface

Internally: nodes + typed edges + optional hierarchy (categories, databases).

Externally: many views over the same data.

- **Outline** (current context view, list-like)
- **Graph** (force-directed network, Obsidian-style)
- **Map** (infinite spatial canvas, Heptabase/tldraw-style)
- **Timeline** (chronological, evolution over time)
- **Table** (database table view)
- **Board** (kanban, grouped by property)
- **Tree** (hierarchical, folders)
- **Calendar** (date-based)

Switch view, same data. A user picks the view that matches their task.

### P3. Typed semantic edges

Links are not opaque. Every edge has a relation type:

- `references` (default — mention)
- `extends` (this builds on that)
- `contradicts` (this disagrees with that)
- `supports` (evidence for)
- `example-of` (instance of a concept)
- `derived-from` (this came from that)
- `supersedes` (this replaces that — the old one stays, marked superseded)
- `applies-to` (principle applies to a goal, context applies to a project)
- `part-of` (composition, not hierarchy)

Edges are queryable via MCP and via the UI graph filter ("show me everything that contradicts X"). Relations are represented in markdown as extended wikilinks: `[[extends:Title]]`, `[[contradicts:Title]]`.

### P4. AI as a first-class user, via native MCP

Everything a human does in the UI, an AI does via MCP. Symmetric access, not a side integration.

MCP tools (built out across waves, target totals):

- **Read:** `get_node`, `list_nodes`, `search_nodes` (semantic + structural + text), `get_graph`, `get_related`, `get_backlinks`, `get_version_at`, `get_context_map`.
- **Write:** `create_node`, `update_node`, `delete_node`, `archive_node`, `add_block`, `move_block`, `create_link`, `remove_link`, `set_property`, `tag_node`, `pin_node`.
- **Reason:** `suggest_connections`, `detect_contradictions`, `summarize_subgraph`, `cluster_nodes`, `refresh_context_map`, `trace_derivation`.
- **Act:** `publish_view`, `share_node`, `export_subgraph`, `import_content`.

An AI with access can: answer "what do I know about X?", propose links the user forgot, detect contradictions between principles, rewrite a document while preserving its edges, cluster orphan notes into themes, and continuously maintain the Context Map.

### P5. Context Map (living synthesis)

A persistent, versioned AI-generated overview of your entire vault. Refreshed continuously on write (cheap diff-aware update) and on a schedule (nightly full resynth).

Answers at a glance:
- What are my current active themes?
- What are my standing principles?
- What projects am I working on?
- What contradictions exist in my thinking?
- What orphan ideas have I not connected to anything?
- What's changed in my thinking this week/month?

Rendered at the top of the /context page as a dismissible, collapsible card. Also exposed via MCP (`get_context_map`) so any AI agent starts every conversation with an accurate picture of you.

### P6. Semantic + structural search

One search box, three engines underneath:

1. **Full-text (Postgres tsvector)** — already present, stays. Precise keyword matches.
2. **Semantic (pgvector + embeddings)** — "what did I write about team dynamics that applies here?" Finds meaningfully related content even without matching words.
3. **Structural (graph traversal)** — "find principles that contradict goals tagged Q2" uses the typed edge graph.

Results blended with a learned ranker (heuristics in v1, lightweight model in v2).

### P7. Multi-modal capture

A node can be created from:

- Text (native editor)
- Voice memo (recorded or uploaded, auto-transcribed via Whisper)
- Photo (OCR for text + vision model for tags)
- Screenshot (content-aware: code → code block, webpage → structured clip)
- Forwarded email (parsed, entities extracted)
- Web clip (browser extension)
- Mobile quick-capture (PWA or native: 1-tap capture that syncs in seconds)
- API (programmatic, via MCP or REST)

All capture paths produce nodes of the same content model; they differ only in how content enters the system.

### P8. Provenance and time travel

Every node has a full version history. Every edge has a creation timestamp and the event that created it.

- **Diff** any two versions of a node.
- **Time slider** on graph view shows how your vault looked at any past date.
- **Branching**: fork a node to explore a rewrite without losing the original.
- **Audit**: who (human or AI) changed what, when, why.

Nothing is truly deleted; `delete` is soft, `archive` is the primary write-gone state, a `purge` operation exists but is explicit and rare.

### P9. Portability as a moat, not a lock-in

- **Import** from Notion (API), Obsidian (markdown folder), Roam (JSON), Apple Notes (AppleScript/SQLite), Drive (API), Google Docs (API), Mem (export), Evernote (ENEX), Logseq (folder). Preserves structure, tags, backlinks where possible.
- **Export** as markdown (lossy but portable), JSON (full fidelity), PDF (per-node or subgraph), or the entire graph as a zip (markdown files + edges.json + files/ directory).
- **No proprietary format.** All internal storage is Postgres + S3-compatible blob store, both industry standard.

Users stay because the product is better, not because they can't leave. That's the only kind of retention that compounds.

### P10. Permissions, collaboration, publishing

- Personal vault by default (single-tenant per user).
- **Workspaces** for business: shared vaults with member invitations.
- **Node-level permissions**: a node can be personal inside a workspace, shared to specific members, or open to all.
- **Real-time CRDT sync** (Yjs): multiple users edit the same document simultaneously; conflicts resolved automatically.
- **Published views**: mark a subgraph as public-readable; it gets a stable URL (`ascend.app/u/username/topic` or `workspace.ascend.app/topic`) with a clean reader-mode render. Notion-style public pages.

---

## 3. Platform Strategy

Decided: **Path A** — best-in-class per platform, monorepo with heavy shared logic.

| Target | Stack | Entry point |
|--------|-------|-------------|
| Web | Next.js 16 (App Router) + Tailwind + shadcn/ui | `apps/web/` |
| iOS | Expo (React Native) + NativeWind | `apps/mobile/` |
| Android | Expo (React Native) + NativeWind | `apps/mobile/` (same codebase) |
| macOS | Tauri wrapping web app (v1) → React Native macOS (v2 if needed) | `apps/desktop/` |
| Windows | Tauri wrapping web app (v1) → React Native Windows (v2 if needed) | `apps/desktop/` |
| Linux | Tauri wrapping web app | `apps/desktop/` |
| Browser extension | TypeScript + WebExtension API | `apps/extension/` (future) |
| MCP server | HTTP, part of `apps/web` Next.js API routes | `/api/mcp` |

### Monorepo structure (post Wave 0)

```
ascend/
  apps/
    web/                      # current Next.js codebase, moved here
    mobile/                   # Expo, added W6 or earlier
    desktop/                  # Tauri shell, added W8 or when desired
    extension/                # future
  packages/
    core/                     # Zod schemas, types, enums, business constants
    api-client/               # typed fetch wrapper (shared by every client)
    storage/                  # storage adapter interface + web/native impls
    ui-tokens/                # design tokens (colors, spacing, typography, radii)
    ui-primitives/            # cross-platform primitives (optional; tokens first)
    sync/                     # CRDT layer (Yjs) + sync protocol
    graph/                    # platform-agnostic graph: force sim, layout, typed edges
    editor/                   # Lexical nodes + commands shared across platforms
    llm/                      # LLMProvider interface + OpenAI/Anthropic impls
  docs/
    architecture/             # design decisions, wave notes
  prisma/
  .ascendflow/
```

### Non-negotiables for cross-platform viability

Commit these as rules in CLAUDE.md at Wave 0 end:

1. **Every user-visible action has a REST endpoint.** No Next.js Server Actions that mobile can't call. If it's not in the OpenAPI/typed client, it doesn't exist.
2. **Services are the sole source of business logic.** Web, mobile, desktop, and MCP all call services via HTTP; services themselves never import UI libs, browser APIs, or framework-specific primitives outside Prisma/auth utilities.
3. **No browser-only APIs in stores or shared packages.** `localStorage`, `window`, `document`, `navigator`, `fetch`-specific things must be behind an adapter in `packages/storage` or equivalent.
4. **No UI-framework-coupled data types.** Schemas, enums, and types live in `packages/core`. Hooks/components import from there.
5. **Files are uploaded to S3 via presigned URLs.** No Next.js-specific upload endpoint that mobile can't replicate.
6. **Auth uses tokens, not cookies.** Access token in `Authorization: Bearer` header, refresh token stored in secure storage (SecureStore on native, httpOnly cookie on web for CSRF defense).
7. **Routing parity.** Next.js App Router paths mirror Expo Router paths. `/context/[id]` on web → `app/context/[id].tsx` on mobile. No web-unique deep routes without an equivalent on mobile.

### Library choices (locked in)

| Concern | Choice | Why |
|---------|--------|-----|
| Block editor | **Lexical** (Meta) | Only serious editor with web + React Native support on the same node model. Harder DX than Tiptap but saves a second editor in native. |
| CRDT | **Yjs** + `y-websocket` or `y-protocols` over WebSocket | Battle-tested, works on web + RN, mature with Lexical bindings. Adopted in W3 when the block editor lands. |
| Graph layout | **d3-force** in `packages/graph` (platform-agnostic simulation) + **ReactFlow** (web rendering) + **react-native-skia** (native rendering, W6+) | Same layout algorithm, platform-specific renderer. |
| Embeddings | **OpenAI `text-embedding-3-small`** (cost-effective, 1536-dim) stored in Postgres via **pgvector** | Single-provider to start; `LLMProvider` abstracts so we can swap. |
| LLM | **OpenAI** first (model verified live per global rules), **Anthropic** as second provider behind the same `LLMProvider` interface | Multi-provider from day one avoids a rewrite at Wave 5. |
| Object storage | **S3-compatible** (Cloudflare R2 recommended for cost + egress) | Standard, portable, mobile-friendly. |
| Auth | **Better-Auth** (OAuth + tokens, native-ready) OR self-hosted NextAuth with JWT + refresh + Expo SecureStore integration | Decision made in Wave 0 after a short spike. API-key auth retained for MCP and power users. |
| Mobile UI | **NativeWind** (Tailwind for React Native) + custom primitives matching `@ascend/ui-tokens` | Keep design tokens in sync with web. |
| Desktop shell | **Tauri 2** | Tiny binary, cross-platform, can host the web app natively and add native menus / file handlers / notifications. |
| Monorepo tool | **pnpm workspaces** (+ optional Turborepo for task caching) | Lightweight, fast, no vendor lock-in. |

---

## 4. The 10 Waves + Wave 0

Each wave ships a coherent product. The product is useful at the end of every wave. Drift is not acceptable — scope is controlled wave-by-wave, not mid-wave.

### Wave 0: Platform foundation (~1–2 weeks)

**Delivered product:** same Ascend as today, but architected to host every later wave without rewrites. No user-visible change; foundation is infrastructural.

**Scope:**
- Monorepo conversion (pnpm workspaces; current code moved to `apps/web/`).
- Extract `packages/core` (Zod schemas, types, enums, constants).
- Extract `packages/api-client` (fetch wrapper, resolves the existing duplicated `fetchJson` danger zone).
- Extract `packages/ui-tokens` (colors, spacing, typography).
- Extract `packages/storage` (adapter interface + web impl wrapping localStorage).
- Auth upgrade: token-based (OAuth + JWT access + refresh), API keys retained for MCP.
- Presigned-URL file upload scaffolding (S3/R2 config, API route, unused in W0 but wired).
- Add cross-platform non-negotiables to CLAUDE.md.
- Lexical viability spike (1 day): confirm block editor can hit the quality bar before locking W3.
- Zero regressions on the existing web app (full `ax:verify-ui` pass).

**Native-readiness:** establishes every prerequisite. After W0, a mobile/desktop project can be started without further refactor of shared code.

**Sized:** 1 planning week + 1 execution week.

### Wave 1: Graph foundation (~3–4 weeks)

**Delivered product:** a typed-graph version of today's /context page. Users see all existing entries with new entry-type badges (principle/note/review/etc), can switch between Outline and Graph view, and see typed edges via extended wikilinks. AI agents gain a first round of MCP tools to read the graph. Context Map UI shell exists (populated by Wave 2).

**Scope:**
- Prisma schema: `ContextEntry.type` enum (note, principle, priority, review, meeting, idea, reference, map, upload, record), new `ContextLink` table for typed edges, workspace scoping prep (nullable `workspaceId` for now, hydrated in W8).
- Service layer: `contextLinkService` with CRUD, graph query methods (`getGraph`, `getNeighbors`, `getByRelation`).
- Extended wikilink parser: `[[relation:Title]]` → `ContextLink(relation, sourceId, targetId)`. Backward compatible with plain `[[Title]]` → `references` relation.
- Migration of existing `linkedEntryIds[]` into `ContextLink` records (preserving current behavior).
- API routes: `/api/context/links`, `/api/context/graph`, `/api/context/nodes/by-type/:type`.
- MCP tools (round 1): `get_context_graph`, `get_node_neighbors`, `get_related_context`, `list_nodes_by_type`, `create_typed_link`, `remove_typed_link`.
- React Query hooks + `@ascend/api-client` calls for all new endpoints.
- UI: view switcher on /context (Outline / Graph / Map-coming-soon), entry type badge + picker in detail panel, entry type icons in list rows, Context Map card shell at top of Outline (shows "Populated in Wave 2" placeholder).
- Graph view: `components/context/context-graph-view.tsx` using ReactFlow with d3-force layout from `packages/graph`. Color-coded nodes by type, edge labels by relation type, clickable nodes open detail panel, zoom/pan/fit controls, filter panel (by type, by relation, by tag).
- Zustand store slice: `contextGraphFilters` (active types, active relations, selected cluster).

**Native-readiness:** `packages/graph` simulation is platform-agnostic; ReactFlow renderer stays in `apps/web/`. When mobile lands, `components/context/context-graph-view.native.tsx` re-uses the same simulation with a Skia renderer.

**Sized:** 3–4 weeks.

### Wave 2: AI-native via MCP, round 1 (~2–3 weeks)

**Delivered product:** Context Map goes live. Semantic search works. AI agents can reason over the graph.

**Scope:**
- `LLMProvider` interface in `packages/llm` with `OpenAIProvider` implementation (model: verified-current at implementation time, likely `gpt-5-mini` or `gpt-5-nano` for synthesis, `text-embedding-3-small` for embeddings).
- Embedding pipeline: on node create/update, generate embedding, store in pgvector column. Background job for backfill of existing entries.
- Context Map generator: service method that reads the full user graph, extracts themes/principles/projects/tensions, writes a `ContextEntry` of type=`map` with the synthesis. Versioned (Wave 8 formalizes versioning; W2 stores latest-only).
- Context Map triggers: nightly cron (Next.js API route + Vercel/Dokploy cron) + manual refresh button + optional per-write cheap diff update (only when 3+ nodes change in one session).
- Semantic search: new `/api/context/search/semantic` route using pgvector cosine similarity; blended with tsvector full-text in a unified `/api/context/search` endpoint.
- MCP tools (round 2): `get_context_map`, `refresh_context_map`, `suggest_connections` (given a node, propose 3–5 related nodes based on embeddings + graph), `detect_contradictions` (LLM + embedding to find node pairs that might disagree), `summarize_subgraph` (given a set of node IDs, return a synthesis).
- UI: Context Map card populated with themes/principles/projects/tensions/orphans; each section clickable → filters the graph/list view to those nodes. Manual refresh button with cooldown + cost estimate.
- Cost tracking: per-user LLM spend recorded; soft cap at $2/day with warning toast, hard cap at $10/day.

**Native-readiness:** all LLM work is server-side; clients just call endpoints. Mobile inherits Context Map for free.

**Sized:** 2–3 weeks.

### Wave 3: Block editor (~4–6 weeks)

**Delivered product:** entries are block documents, not markdown textareas. Rich, Notion-grade editing. Portable to mobile later (Lexical).

**Scope:**
- `packages/editor` with Lexical node definitions: Paragraph, Heading (1–3), BulletedList, NumberedList, ToDo, Toggle, Callout, Code (with syntax highlight), Quote, Divider, Image, File, Table, WikiLink (typed), Mention (user/goal/todo), AIBlock (placeholder for W2 AI insertions), Embed (URL unfurl).
- Lexical + Yjs integration: document IS a CRDT from day one (`@lexical/yjs`).
- Slash-command menu (type `/` for block picker).
- Inline toolbar (selection-based formatting).
- Markdown import/export per node (lossy; for portability).
- Migration: existing `ContextEntry.content` (markdown) → initial block document on first edit. Non-destructive (markdown preserved in a fallback column).
- `/api/context/nodes/:id/blocks` endpoints for programmatic block manipulation (so AI can `add_block`, `move_block` without round-tripping the full document).
- MCP tools (round 3): `get_blocks`, `add_block`, `update_block`, `move_block`, `delete_block`.
- UI: new `components/context/context-block-editor.tsx` replaces the current textarea. Detail panel inline-edit pattern preserved (click to edit anywhere, autosave on blur via CRDT sync).
- Keyboard shortcuts: Notion-equivalent (Cmd+B bold, Cmd+Shift+1 heading, `[[` for wikilink autocomplete, `@` for mention, `/` for slash menu).

**Native-readiness:** Lexical's RN bindings mean the mobile editor uses the same node types. W6 implements mobile UI without reinventing the content model.

**Sized:** 4–6 weeks. Most complex single wave.

### Wave 4: Universal files (~2–3 weeks)

**Delivered product:** drop any file onto Ascend. PDFs, images, audio, video, spreadsheets, whatever. The file becomes a searchable, linkable node.

**Scope:**
- Upload flow: client requests presigned URL from backend, uploads directly to R2, backend stores metadata.
- New node type `upload` with blob reference, MIME type, size, extracted text, derived thumbnails.
- Extraction workers (background jobs, BullMQ or simpler Postgres-backed queue):
  - PDF → text + page thumbnails (via `pdfjs-dist` or `unpdf`).
  - Image → OCR (Tesseract.js or cloud OCR) + vision-model tags (gpt-5-vision for auto-tagging).
  - Audio → Whisper transcript.
  - Video → Whisper on audio track + frame thumbnails.
  - Spreadsheet → CSV-like extraction, searchable rows.
  - Plain text → content.
- Extracted text indexed into tsvector + embeddings (same as any node).
- UI: drag-drop onto any list; dedicated "Upload" button; inline file blocks in block editor (from W3).
- Preview: inline PDF viewer, image viewer with zoom, audio player, video player.
- MCP tools (round 4): `upload_file` (accepts URL or base64), `get_file_content`, `list_files_by_type`.

**Native-readiness:** Expo `DocumentPicker` / `ImagePicker` feeds the same presigned-upload endpoint.

**Sized:** 2–3 weeks.

### Wave 5: Databases + properties (~4–5 weeks)

**Delivered product:** Notion-grade databases. Define a schema (typed fields) and have rows with structured data, views, filters, sorts, formulas.

**Scope:**
- New entities: `Database` (user-defined schema), `DatabaseField` (typed field: text, number, date, select, multi-select, relation, formula, user, checkbox, rating, URL, email, phone, file), `DatabaseRow` (node subtype: `record`).
- Each row is a node. Rows can be linked like any other node.
- Views per database: Table, Board (group by select/multi-select), Calendar (group by date), Gallery (grid with card content), Timeline.
- Filters, sorts, property visibility per view.
- Formula engine (minimal): arithmetic, date math, string concat, if/then. Expressions stored as text, evaluated server-side + client-side (deterministic).
- Relation fields: link rows to other nodes (database rows or regular entries).
- UI: `/databases/:id` route (or inline on /context) with view switcher; per-row detail inline-editor.
- MCP tools (round 5): `create_database`, `add_field`, `create_row`, `update_row`, `query_database` (with filter/sort/page), `create_view`.

**Native-readiness:** list + board + gallery views ship on mobile in W6. Table view may be mobile-read-only in W6 and gain full edit in a later wave.

**Sized:** 4–5 weeks.

### Wave 6: Mobile app + multi-modal capture (~4–5 weeks)

**Delivered product:** iOS + Android Expo app with feature parity on read + core write. Voice capture, photo capture, quick-capture bar. Forward-email-to-node address. Browser extension v1.

**Scope:**
- `apps/mobile` Expo project. Expo Router mirrors Next.js App Router paths.
- Auth via Better-Auth (or chosen provider) with SecureStore; deep link for OAuth callback.
- Screens: Dashboard, Goals, Todos, Calendar, Context (outline + graph + detail + block editor), Capture.
- Block editor: Lexical RN with the same node definitions as web.
- Graph view: `react-native-skia` + shared `packages/graph` simulation.
- Multi-modal capture:
  - Voice: `expo-av` recorder → upload + transcribe.
  - Photo: `expo-image-picker` → OCR + vision-tag (same pipeline as W4).
  - Quick capture: launcher tile + widget (iOS) / app shortcut (Android) → 1-tap to capture voice/photo/text.
- Push notifications: APNs + FCM via Expo Push. Backend `NotificationService` abstracts channel.
- Offline: CRDT doc sync via Yjs; queue mutations while offline; resolve on reconnect.
- Email-to-node: unique per-user inbound address (via a service like SendGrid Inbound Parse or Mailgun) that creates a node from each email.
- Browser extension v1: clip current tab as a `reference` node with selection → content.

**Native-readiness:** done; this IS the native readiness milestone.

**Sized:** 4–5 weeks (mobile is parallelizable with other waves if a contractor joins; solo this is the longest wave after W3).

### Wave 7: Provenance and time travel (~2–3 weeks)

**Delivered product:** every change versioned. Diff any two points. Time slider on graph view. Branching for in-progress rewrites.

**Scope:**
- `NodeVersion` table: append-only history of every node (immutable snapshots, keyed by `nodeId` + `versionId`). Blocks are versioned (entire document at each save).
- `EdgeEvent` table: append-only log of edge creation/removal.
- Diff engine: per-node diff (block-level diff for block documents, line-level for text, field-level for records).
- UI: version history panel in detail (collapsible "N versions" list), click a version → side-by-side diff.
- Time slider on graph view: drag to any past date, graph re-renders as it was.
- Branching: fork a node at any version → new node with `derived-from` edge to the original.
- MCP tools (round 6): `list_versions`, `get_version`, `diff_versions`, `restore_version`.

**Native-readiness:** server-side; mobile consumes via API.

**Sized:** 2–3 weeks.

### Wave 8: Workspaces, collaboration, publishing (~4–6 weeks)

**Delivered product:** shared vaults for teams. Node-level permissions. Real-time multi-user editing via CRDT. Public published views.

**Scope:**
- `Workspace` entity, membership (owner/admin/editor/viewer roles), invitations.
- All nodes scoped by `workspaceId` (Wave 0 prepared the column; Wave 8 populates + enforces). Personal vault = workspace owned by single user.
- Node-level permission overrides (private within workspace, shared to specific members, open to all).
- Real-time collaboration: WebSocket server for Yjs doc sync (Hocuspocus or custom). Presence indicators (who else is viewing/editing). Collaborative cursors in block editor.
- Activity feed per workspace: who did what, when.
- Published views: mark a subgraph as public-readable → stable URL `/public/:workspaceSlug/:pageSlug`. Clean reader-mode render. Optional password. Optional search-indexable.
- Team-only features: @mentions notify, comments on any node, resolve/unresolve comments.
- Billing layer (if monetizing): per-seat pricing, workspace plans.

**Native-readiness:** mobile inherits via existing auth+API; no mobile-specific work.

**Sized:** 4–6 weeks.

### Wave 9: Spatial canvas view (~2–3 weeks)

**Delivered product:** an infinite 2D canvas where nodes are cards and edges are drawable. For visual thinkers; complements the force-directed graph.

**Scope:**
- New view: Map (alongside Outline/Graph/etc). Powered by tldraw or custom Konva/PixiJS.
- Nodes drag to any position; positions persisted per view (`CanvasLayout` table: nodeId, x, y, w, h per layoutId).
- Edges optional on canvas (render or hide).
- Freehand drawing, shapes, frames, sticky notes as canvas-only annotations (stored on the canvas, not as nodes).
- Import from Excalidraw / tldraw files (one-shot).
- MCP tools: `get_canvas_layout`, `set_node_position`, `create_annotation`.

**Native-readiness:** web-first in W9; mobile canvas shipped in a later wave if user demand appears.

**Sized:** 2–3 weeks.

### Wave 10: Extensibility (~3–4 weeks)

**Delivered product:** developers and power users can extend Ascend. Custom view types, embeddable external data, light plugin API.

**Scope:**
- Custom views: register a view component by uploading a small manifest; executes in an iframe with a scoped API.
- Embeddable external data: plug in Linear issues, GitHub repos, Slack channels, etc., as virtual databases (read-only).
- Lightweight plugin API (inspired by Obsidian): plugins declare commands, panels, and MCP-tool-like handlers. Signed + reviewed before marketplace listing.
- MCP server federation: user can connect other MCP servers; their tools appear alongside Ascend's in any AI client connected to Ascend.

**Native-readiness:** plugins web-first; mobile plugin support deferred indefinitely.

**Sized:** 3–4 weeks.

---

## 5. Architectural Decisions (decision log)

| # | Decision | Choice | Reasoning |
|---|----------|--------|-----------|
| D1 | Product shape | Context becomes Ascend's defining layer; goals + todos evolve into specialized views over the same graph. | Dogfood inside Ascend; spin out as a standalone product only after v1 is proven. |
| D2 | Multi-tenancy | Multi-tenant data model from Wave 0 (nullable `workspaceId`), team UI in Wave 8. | Avoids a destructive rewrite mid-product. |
| D3 | Storage | Postgres (primary) + pgvector (embeddings) + Cloudflare R2 (blobs). No additional DB. | Single operational surface; mature tooling; industry standard. |
| D4 | Block editor | Lexical (web + React Native via same node model). | Only editor that delivers cross-platform on one model. Harder DX accepted. |
| D5 | LLM | Multi-provider abstraction from day one. OpenAI first, Anthropic second. | Avoids 2-month rewrite in W5+. ~2 days extra in W2. |
| D6 | Real-time sync | Yjs CRDT adopted in W3 alongside block editor. | The editor IS the CRDT. Retrofitting later means rewriting the editor. |
| D7 | Auth | Token-based (Better-Auth or NextAuth+JWT+refresh) adopted in W0. API keys retained for MCP. | Native apps can't use cookie-only. Adopting in W0 avoids a second migration. |
| D8 | Platform | Path A: Next.js web + Expo mobile + Tauri desktop (RN-desktop optional later). | Best-in-class per platform; ~30% extra UI work is the price of world-class. |
| D9 | Monorepo | pnpm workspaces (+ optional Turborepo for caching). Structure defined in Section 3. | Lightweight, no vendor lock-in, fast CI. |
| D10 | Import/export | Full import from Notion/Obsidian/Roam/Mem/Drive/Docs/Logseq. Export as md+JSON+zip. | Portability is core positioning. Built in W9 or as standalone sprint. |

---

## 6. Success Criteria (per wave)

Each wave ends only when ALL of its criteria are met. A wave is not "complete" with gaps.

**Wave 0:** monorepo builds + deploys; all existing functionality unchanged; storage adapter pattern in use by Zustand; token auth issues working access + refresh tokens; presigned URL endpoint returns a valid URL; Lexical spike produces a functioning demo; CLAUDE.md updated; `ax:verify-ui` passes with no regressions.

**Wave 1:** every existing entry has a `type` (migration default: `note`); `ContextLink` table populated from existing `linkedEntryIds[]`; graph view renders all nodes with typed edges; view switcher swaps between Outline and Graph without re-fetching data; MCP round-1 tools callable from Claude Code + ChatGPT (verified end-to-end); typed wikilink syntax parsed correctly; backward compatibility verified (plain `[[Title]]` still works).

**Wave 2:** Context Map card populated with at least 3 sections (themes, principles, tensions); nightly cron confirmed firing; manual refresh works within 30s budget; semantic search returns meaningfully different results than tsvector for appropriate queries; embedding backfill runs to 100% on existing entries; all round-2 MCP tools callable; cost tracking visible in settings.

**Wave 3:** block editor replaces markdown textarea; every existing entry renders in new editor without content loss; Yjs CRDT active on every document; slash menu and inline toolbar match Notion ergonomics; markdown export per node produces valid markdown; block-level MCP tools callable.

*(Remaining waves follow the same pattern; defined in the Wave N PRD when reached.)*

---

## 7. Out of Scope for v1 (across all waves)

Explicitly NOT in the v1 product (v1 = after W10):

- Mobile app for iPad (phone + tablet share codebase, but iPad-specific UI optimizations deferred).
- Third-party OAuth as an identity provider (we use OAuth as a login method; we don't let others log into their apps via Ascend).
- Encryption-at-rest beyond provider default (E2E encryption deferred; enterprise feature for post-v1).
- Enterprise admin console (SSO/SCIM/audit log retention) — teams+publishing ships in W8, enterprise adds later.
- On-premise / self-host distribution (v1 is cloud-only; open-sourcing core deferred until product-market fit is strong).
- Natively multilingual content UI (we build in English; localization deferred).
- Graph-database backing (we stick to relational + pgvector; Neo4j-style graph DB only if queries become intolerably slow at scale).

---

## 8. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Scope creep inside a wave | High | Each wave has its own PRD+TASKS.md; any change requires a written amendment before merge. `ax:review` flags drift. |
| Lexical RN maturity falls short | Medium | Wave 0 includes a 1-day Lexical spike. If it fails the quality bar, we pivot to Tiptap (web) + a separate RN editor and accept the content-model fork. |
| LLM costs spiral | Medium | Per-user soft/hard caps from W2. Model choice favored toward small, cost-effective models. Embeddings cached forever unless content changes. |
| Postgres doesn't scale to graph queries at 10k+ nodes per user | Low-Medium | Benchmark in W1 with synthetic 10k-node vault. If materialized view or CTE tuning insufficient, consider adding a dedicated graph query layer in W5+. |
| CRDT sync bugs corrupt documents | High | Yjs + Hocuspocus are battle-tested; we write integration tests covering conflict cases in W3. Document-level snapshots in W7 as a safety net. |
| Mobile launches behind schedule | Medium | W6 is sized generously. If it slips, W7–W10 can be re-ordered (W7 provenance or W8 collaboration can go next). |
| User adoption depends on migrations working | High | W9 importers each get their own integration test with a real exported dataset. User-reported migration issues are P0. |

---

## 9. Open Questions (to answer before their wave begins)

These are intentionally unresolved; addressing them before the relevant wave is part of that wave's planning.

- **W0:** Better-Auth vs NextAuth+JWT? (1-day eval at start of W0.)
- **W2:** Which model for Context Map synthesis? (Verify live what's available and cheapest at the time; likely gpt-5-mini or successor.)
- **W3:** Does Lexical RN support collaborative cursors natively, or do we implement via Yjs awareness? (Spike in W0, confirm in W3.)
- **W5:** Formula engine — build from scratch or adopt existing (e.g., `formulajs`)? Decision deferred to W5 planning.
- **W6:** Does Expo EAS build pipeline work for us, or self-manage builds? (Decision at start of W6.)
- **W8:** Hocuspocus self-hosted or a managed CRDT service (Liveblocks)? Trade cost vs. ops burden.

---

## 10. How We Work

- **One wave at a time.** No parallel wave work. Each wave has a dedicated PRD+TASKS.md under `.ascendflow/features/context-v2/wave-N-<slug>/`.
- **Planning before code.** Every wave plans via `ax:plan`. Every phase inside a wave has checkpoint verification via `ax:test`, `ax:verify-ui`, `ax:review`.
- **User approval at wave boundaries.** No wave begins execution without the user explicitly approving that wave's PRD.
- **Deferred scope goes to `BACKLOG.md`.** Mid-wave ideas go to the backlog, not into the current wave.
- **No silent simplification.** If a wave's scope can't be hit in the estimated time, we flag it explicitly and choose: extend the wave, reduce scope, or re-sequence.

---

## 11. Milestones and Timeline (illustrative)

Solo, focused, at world-class quality. Linear estimate; could compress with help.

- Month 1: W0 (week 1) + W1 (weeks 2–4).
- Month 2: W2 (2–3 weeks) + start W3.
- Month 3: W3 continues.
- Month 4: W4 + start W5.
- Month 5: W5 continues + W6 mobile kickoff.
- Month 6: W6 continues.
- Months 7–8 (post-v1): W7 + W8.
- Month 9: W9 + W10.

v1 product (ship the first paying version) = end of W8 (collaboration + publishing), ~month 8.

---

*This document is the north star. Every PRD downstream cites it. Every change to it is a strategic-level amendment and requires user approval.*
