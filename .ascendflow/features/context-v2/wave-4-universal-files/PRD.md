# Wave 4: Universal Files

**Slug:** `context-v2` / `wave-4-universal-files`
**Created:** 26. 4. 2026
**Status:** planning (Wave 3 closed at `dd8e482`; 55 MCP tools live, block editor on /context)
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W4 section starts ~line 315)
**Wave sizing:** 2-3 weeks per VISION; target 6-10 working days at the cadence Waves 0-3 hit.

## Problem

Users have everything except files. PDFs, screenshots, voice notes, audio, video, spreadsheets — none of them exist as first-class objects in Ascend. Wave 0 shipped the storage primitives (`File` model, presigned URL endpoints, R2 bucket) but no UI consumer. Wave 3 shipped `Image` and `File` block placeholders that have no upload flow. Wave 4 connects them.

Wave 4 introduces:

1. **Upload flow** end-to-end. Drop file onto `/context` → presigned URL → direct R2 upload → server confirms → File row + ContextEntry created → block editor renders inline.
2. **Extraction pipeline** that turns binary files into searchable text + multimodal embeddings:
   - **PDF** → text + (optional) page thumbnails via `unpdf`.
   - **Image** → caption + tags + OCR via Gemini Vision (already in `@ascend/llm`).
   - **Audio** → transcript via OpenAI Whisper (or Gemini audio if API supports; defer Whisper if Anthropic is missing).
   - **Video** → frames + audio track → same pipeline.
   - **Spreadsheet** (CSV/XLSX) → row-by-row text via `papaparse` + `xlsx`.
   - **Plain text** → content as-is.
3. **Multimodal embedding** via Gemini Embedding 2 (per-modality limits already pinned in Wave 2 MODEL-DECISION.md). Files get embedded alongside text — no separate extraction-then-embed step where the API supports direct multimodal input.
4. **Job queue** for extraction (Postgres-backed via `pg-boss` or hand-rolled via `LISTEN/NOTIFY`). Extraction is async; status polled by client.
5. **Inline rendering** in the block editor: PDFs show inline preview, images get viewer with zoom, audio gets player with synced transcript, video gets player.
6. **3 new MCP tools (round 4):** `upload_file` (URL or base64), `get_file_content` (extracted text), `list_files_by_type`.
7. **Cleanup cron** for orphan PENDING file rows (Wave 0 BACKLOG carry-over) — runs daily, deletes rows older than 24h with no upload completion.

## User Story

As a thinker, I want to drop any file onto Ascend and have it become a permanent, searchable, linkable node, so that my screenshots, PDFs, voice notes, and spreadsheets live in the same graph as my written entries. As an AI agent connected via MCP, I want to upload a file by URL or get the extracted text of any file by ID, so I can reason over the user's full content corpus, not just the text-only subset.

## Success Criteria

### Functional

- [ ] Drop-zone overlay on `/context`: dragging a file over the page shows the drop zone; releasing uploads the file via presigned URL.
- [ ] Upload button in `/context` toolbar opens a file picker (multiple selection allowed).
- [ ] File block in the Lexical editor: insertable via slash menu (`/file`, `/image`, `/pdf`, etc.) or drag-drop directly into the editor canvas at the cursor position. Renders inline preview based on MIME type:
  - PDF → embedded `<iframe sandbox>` with `Content-Disposition: inline`
  - Image → `<img>` with click-to-zoom modal
  - Audio → native `<audio>` controls + collapsible transcript below
  - Video → native `<video>` controls + frame thumbnails strip
  - Spreadsheet → small table preview (first 5 rows × 5 cols) + "Open full table" link
  - Other → generic file card with download
- [ ] Existing presigned URL flow (Wave 0) is the upload primitive. Wave 4 adds: server-side `confirmUpload` → kicks off extraction job → updates File row.
- [ ] Job queue runs extractions reliably with retry (3 attempts) + dead-letter table. Failed extractions surface a "Retry" button on the file card; permanent failures show "Could not process — see error: …" with the underlying message.
- [ ] **Per-modality extraction handlers:**
  - PDF (`application/pdf`) — text extraction; up to 100 pages.
  - Image (`image/png`, `image/jpeg`, `image/webp`) — Gemini Vision tag/caption call (cost-capped).
  - Audio (`audio/mpeg`, `audio/wav`, `audio/m4a`) — OpenAI Whisper transcription (requires `OPENAI_API_KEY`; if missing, fall back to Gemini audio if supported, else mark "Transcription unavailable").
  - Video (`video/mp4`, `video/quicktime`) — extract audio track via `ffmpeg-static` → Whisper; sample 4 frames for thumbnails.
  - Spreadsheet (`text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) — parse to rows, store as plain-text "row 1: a, b, c" lines.
  - Plain text (`text/plain`, `text/markdown`) — content as-is.
- [ ] Extracted text feeds the **same `extractedText` column** Wave 3 added, so search_vector indexes file content automatically. New files appear in tsvector + semantic search alongside written entries.
- [ ] Multimodal embedding: where Gemini Embedding 2 supports the modality directly (image, audio, video, PDF), the file is embedded via the multimodal API; the embedding lives on the parent ContextEntry alongside text.
- [ ] Block editor's `FileNode` and `ImageNode` (placeholders from Wave 3) get filled in. Their `decorate` returns the inline preview component. Backwards compatible: existing entries with empty File/Image nodes render as "No file attached" placeholder.
- [ ] **3 new MCP tools (round 4):** `upload_file`, `get_file_content`, `list_files_by_type`. Tool count: **55 → 58.**
- [ ] **Cleanup cron** (GitHub Actions or Dokploy scheduled task) runs daily, deletes File rows in PENDING > 24h, also issues DELETE on the R2 object if it was created.
- [ ] **R2 object serving:** new `GET /api/files/[id]` route returns a presigned download URL (signed for 5 min) OR streams the bytes server-side for SVG (server-side sanitization OR `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` per Wave 0 BACKLOG).
- [ ] Embed/Image/File **URL sanitization** (Wave 3 carry-over DZ-11): all user-facing file URLs go through `/api/files/[id]` (NOT the raw R2 URL); `javascript:`, `data:`, and other dangerous protocols rejected.

### Quality

- [ ] PDF extraction completes within 10s for typical documents (up to 50 pages).
- [ ] Image OCR / vision tagging completes within 5s.
- [ ] Audio Whisper completes within 60s for files up to 5 min.
- [ ] Upload latency to "extracting" status < 2s for files up to 5 MB.
- [ ] `npx tsc --noEmit` and `pnpm --filter @ascend/web build` pass with zero errors.
- [ ] `ascend-security` audit on the upload + serving routes: PASS (size caps enforced server-side, MIME allowlist enforced, presigned URL expiry ≤ 5 min, no SSRF in `upload_file` URL fetch path).
- [ ] `ascend-migration-auditor` PASS on any migration (`extractedText` already exists; new columns might be: `File.extractedText`, `File.multimodalEmbedding`, `File.thumbnailKey`).
- [ ] `ascend-architect` PASS on any new shared package (likely none; extraction stays in `apps/web`).
- [ ] `ascend-critic` verdict at GOOD or WORLD-CLASS at wave close.

### Cross-platform readiness

- [ ] Upload primitive (presigned URL) is platform-agnostic. Mobile (Wave 6) Expo `DocumentPicker`/`ImagePicker` feeds the same `/api/files/presign` endpoint.
- [ ] Extracted text + thumbnails are platform-portable (URLs, not local paths).
- [ ] No native dependencies in shared packages. Server-only ones (`unpdf`, `ffmpeg-static`, `papaparse`, `xlsx`) live in `apps/web/lib/extraction/`.

## Affected Layers

- **Prisma schema:**
  - `File` model gets new fields: `extractedText` (Text, nullable), `thumbnailKey` (String, nullable; R2 key for first thumbnail), `pageCount` (Int, nullable; PDF/video frames), `extractionStatus` (enum: PENDING / EXTRACTING / COMPLETE / FAILED), `extractionError` (Text, nullable), `extractedAt` (DateTime, nullable), `multimodalEmbedding` (vector(1536), nullable; same dimension as text embeddings).
  - New `ExtractionJob` table for the queue: id, fileId FK, attempts, lastError, createdAt, startedAt, completedAt, status. Unique on (fileId) so re-uploading replaces.
  - `ContextEntry` gets nullable `fileId` FK (one entry per file; the File becomes a ContextEntry of type `SOURCE` with the file as content).
- **Packages:** no new shared package. Extraction stays in `apps/web/lib/extraction/`.
- **Service layer (`apps/web/lib/services/`):**
  - `fileService` (already exists from Wave 0) — extend with `confirmUploadAndKickoff`, `serveFile`, `cleanupOrphans`, `markExtracted`.
  - `extractionService` (new) — orchestrates by MIME type: `extractPdf`, `extractImage`, `extractAudio`, `extractVideo`, `extractSpreadsheet`, `extractPlainText`. Each calls a typed handler in `lib/extraction/`.
  - `extractionQueueService` (new) — Postgres-backed queue with LISTEN/NOTIFY (or just polling every 5s; pick simpler for v1).
- **API routes:**
  - `/api/files/presign` (existing) — extend body schema to accept optional `entryId` for adding to existing entry.
  - `/api/files/confirm` (existing) — extend to enqueue extraction job.
  - `/api/files/[id]` GET — new — return presigned download URL (5 min) or stream bytes for SVG.
  - `/api/files/[id]/extract` POST — new — manually trigger / re-trigger extraction.
  - `/api/files/[id]/status` GET — new — polled by client during extraction.
- **React Query hooks:** `useUploadFile()`, `useFile(id)`, `useFileStatus(id)` (auto-poll while EXTRACTING), `useReExtract()`.
- **UI components:**
  - `apps/web/components/files/file-drop-zone.tsx` — overlay on `/context`.
  - `apps/web/components/files/file-card.tsx` — card with status, retry button.
  - `apps/web/components/editor/file-block.tsx` — fills Wave 3's `FileNode` decorator.
  - `apps/web/components/editor/image-block.tsx` — fills `ImageNode` decorator with click-to-zoom.
  - `apps/web/components/editor/pdf-preview.tsx` — sandboxed iframe.
  - `apps/web/components/editor/audio-player.tsx` — native + transcript collapse.
  - `apps/web/components/editor/video-player.tsx` — native + thumbnail strip.
- **MCP tools:** 3 new in `apps/web/lib/mcp/tools/file-tools.ts`. New Set `FILE_TOOL_NAMES` in `apps/web/lib/mcp/server.ts`.
- **Cron:** new `.github/workflows/file-cleanup.yml` daily at 04:00 UTC, calls `/api/files/cleanup` with `x-cron-secret`.

## Data Model Changes

```prisma
enum ExtractionStatus {
  PENDING
  EXTRACTING
  COMPLETE
  FAILED
}

model File {
  // existing fields preserved
  extractedText        String?
  thumbnailKey         String?
  pageCount            Int?
  extractionStatus     ExtractionStatus @default(PENDING)
  extractionError      String?
  extractedAt          DateTime?
  multimodalEmbedding  Unsupported("vector(1536)")?
  contextEntryId       String?  @unique
  contextEntry         ContextEntry? @relation(fields: [contextEntryId], references: [id])
}

model ContextEntry {
  // existing fields preserved
  fileId  String?  @unique
  file    File?
}

model ExtractionJob {
  id          String    @id @default(cuid())
  fileId      String    @unique
  file        File      @relation(fields: [fileId], references: [id], onDelete: Cascade)
  status      ExtractionStatus @default(PENDING)
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  lastError   String?
  scheduledAt DateTime  @default(now())
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status, scheduledAt])
}
```

**Migrations (hand-written, applied via `prisma migrate deploy`):**

1. `add_extraction_fields_to_file` — additive columns on File.
2. `create_extraction_job_table` — new table + indexes.
3. `extend_search_vector_trigger_for_file` — extend Wave 3's trigger to also index `File.extractedText` when the entry has a linked file. (DZ-2: hand-written, additive ALTER FUNCTION + DROP/CREATE TRIGGER for column list, just like Wave 3 Phase 1.)

## API Contract

### Existing `/api/files/presign` POST (extend)

Body now optionally includes `entryId` (attach to existing entry) or `createEntry: true` (auto-create a ContextEntry of type SOURCE).

### Existing `/api/files/confirm` POST (extend)

Body validates `fileId` belongs to user, sets `status = UPLOADED`, enqueues an `ExtractionJob`.

### New `GET /api/files/[id]`

Returns presigned download URL or streams bytes (SVG only). Authenticate via cookie or Bearer.

### New `GET /api/files/[id]/status`

Returns `{ status, extractedAt, error?, pageCount? }`. Polled while EXTRACTING.

### New `POST /api/files/[id]/extract`

Re-enqueues extraction. Useful for retrying after a transient Whisper error.

### New `POST /api/files/cleanup` (cron)

Dual-auth (cron secret OR admin user). Deletes PENDING file rows + their R2 objects older than 24h.

## UI Flows

### `/context` upload

1. User drags a file over `/context`. Drop zone overlay fades in.
2. On drop, client requests presigned URL, uploads to R2, calls `/confirm`, ContextEntry of type SOURCE auto-created with the File attached.
3. The block editor (Wave 3) gets a new entry with a single FileNode block at the root. The user can edit immediately.
4. Extraction status badge renders on the entry list / detail panel: "Extracting…" → "Indexed" or "Failed: <reason> [Retry]".

### Block editor inline file insertion

1. Inside an open entry, slash menu has `/upload` option. Picks file → uploads via the same flow → inserts the appropriate block type (PDF, Image, etc.) at cursor.
2. Drag-drop a file directly into the editor canvas: same effect, dropping at the cursor position.
3. Each block has hover controls: Replace, Download, Delete.

### Image zoom

Click any image block → fullscreen modal with `<img>` in a centered frame; ESC or click outside closes; arrow keys navigate between images in the same entry.

### Audio with transcript

Audio player has the standard controls + a "Show transcript" toggle. Transcript is rendered with timestamps; clicking a timestamp seeks the player.

## Cache Invalidation

- `POST /api/files/confirm` → invalidate `queryKeys.files.all()` and `queryKeys.context.detail(entryId)` (if attached to an entry).
- `GET /api/files/[id]/status` polled while EXTRACTING — automatic via React Query refetchInterval.
- `POST /api/files/[id]/extract` → invalidate the file's status and entry detail.

## Danger Zones Touched

- **DZ-2 (search_vector):** the trigger update is the third ALTER FUNCTION since Wave 3. Same pattern as Wave 3 Phase 1; auditor must PASS.
- **DZ-9 (LLM cost runaway, Wave 2):** vision tagging + Whisper transcription are LLM calls. Routed through `llmService.chat` for vision; Whisper goes through a new `llmService.transcribe` method (or `transcriptionService` if cleaner). Both gated by the same `requestBudget` daily cap.
- **DZ-10 (Yjs state size, Wave 3):** unaffected; file blocks are FileNode references, not large state in the Yjs doc.
- **DZ-11 (block tree XSS, Wave 3):** **resolved this wave.** All file URLs route through `/api/files/[id]` which signs presigned URLs with 5-minute expiry. Embed nodes accept only `/api/files/<id>` paths (validated server-side).
- **NEW: DZ-13 (extraction queue runaway).** A bug in the extraction queue worker could re-enqueue jobs in a loop, burning LLM budget. Mitigations:
  1. `maxAttempts = 3` on every job; permanent failure after.
  2. Exponential backoff on retries (1m, 5m, 15m).
  3. Daily worker run cap: hard 1000 jobs per user per day.
  4. The cost cap (DZ-9) is the financial backstop.
- **NEW: DZ-14 (R2 SSRF on `upload_file` MCP).** The `upload_file` tool accepts a URL the agent provides. Server-side fetch could be tricked into hitting internal services. Mitigation: URL allowlist (https only; reject private IPs, localhost, link-local) + max 50 MiB download + 30s timeout.

## Out of Scope (deferred per VISION + sizing)

- **Database rows from spreadsheet** → Wave 5 (database integration). Wave 4 just extracts text; Wave 5 turns rows into structured records.
- **Real-time multi-user file editing** → Wave 8.
- **Mobile upload UI** → Wave 6 (Expo). Server endpoints are mobile-ready.
- **Per-user quota** (Wave 0 BACKLOG carry-over) → consider in Wave 8 multi-tenancy.
- **Rate limiting on `/api/files/*`** → Wave 8 polish.
- **Frame thumbnails for video** → first version may skip and just show a single frame at 0:00.
- **Custom OCR for non-Latin scripts** — Gemini Vision handles many; specialized OCR (Tesseract) deferred if quality is insufficient.

## User-Side Prerequisites

**HARD blockers:**
1. R2 credentials already in Dokploy env (Wave 0 set: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`). Verify they're still there.

**SOFT (degrade gracefully if missing):**
2. `OPENAI_API_KEY` — required for audio/video Whisper transcription. If missing: audio/video uploads succeed but extracted text is "Transcription requires OPENAI_API_KEY".
3. `GEMINI_API_KEY` — required for image vision tagging + multimodal embeddings. Already set.

No new env vars expected.

## Open Questions

- **Whisper model choice:** `whisper-1` legacy vs `gpt-4o-transcribe` newer. Phase 1 web-check.
- **Thumbnail generation for PDF / video:** server-side rendering needs `pdfjs-dist` + canvas (Node `canvas` package, native deps) or `puppeteer`. Heavy. Defer to Wave 4.5 polish; first version stores no thumbnails.
- **Spreadsheet preview:** show first 5×5 in the block? Or just a "Open full table" link? Phase 6 UI decision.
- **Worker runtime:** in-process polling (every 5s) vs LISTEN/NOTIFY. In-process polling on a single node is simpler and sufficient for solo use; LISTEN/NOTIFY adds <100 LOC and is more responsive. Phase 3 decision.
