# Implementation Tasks: Wave 4 — Universal Files

**Parent:** [PRD.md](./PRD.md) · [VISION.md](../VISION.md)
**Sizing:** 6-10 working days at the cadence Waves 0-3 hit. Prerequisite: Wave 3 closed (`dd8e482`); R2 env vars in Dokploy (Wave 0); OPENAI_API_KEY for audio/video (already set).
**All implementation delegated to `ascend-dev` with per-phase audits by `ascend-migration-auditor`, `ascend-security`, `ascend-architect`, `ascend-reviewer`.**

---

## Phase 1: Web-check + schema migrations + Zod (Days 1-2)

### 1.1 Web-check OpenAI Whisper + extraction libs

Per the Fast-Moving Identifiers rule, scrape:
- https://platform.openai.com/docs/api-reference/audio — current Whisper model ID + pricing (`whisper-1` vs `gpt-4o-transcribe`).
- https://www.npmjs.com/package/unpdf — current version + Node 22 compat.
- https://www.npmjs.com/package/papaparse — version + types.
- https://www.npmjs.com/package/xlsx — version (note: SheetJS Pro vs Community).
- https://www.npmjs.com/package/ffmpeg-static — version + bundled binary platform support.

Output: `EXTRACTION-STACK-DECISION.md` with versions pinned + last-verified date + per-modality decisions.

Verify: Gemini Embedding 2 multimodal API (already pinned in Wave 2 MODEL-DECISION.md) accepts the file types we need (PDF, image, audio, video).

### 1.2 Hand-write migrations

Three migrations under `apps/web/prisma/migrations/2026042700XXXX_*`:

**a) `add_extraction_fields_to_file`** — additive columns on File:
- `extractedText TEXT` (nullable)
- `thumbnailKey TEXT` (nullable)
- `pageCount INTEGER` (nullable)
- `extractionStatus "ExtractionStatus"` (with enum CREATE TYPE; default PENDING)
- `extractionError TEXT` (nullable)
- `extractedAt TIMESTAMP(3)` (nullable)
- `multimodalEmbedding vector(1536)` (nullable)
- `contextEntryId TEXT` (nullable, unique, FK to ContextEntry id with ON DELETE SET NULL)
- Reverse FK on ContextEntry: `fileId TEXT` (nullable, unique, FK to File id ON DELETE SET NULL)

**b) `create_extraction_job_table`** — new table per PRD spec.

**c) `extend_search_vector_trigger_for_file`** — DZ-2 critical. Re-read Wave 3's trigger function, add a join to `File.extractedText` via the linked entry's `fileId`. Decision: simpler is to denormalize. Use `ContextEntry.extractedText` as the canonical search text. The file's extracted text is COPIED into `ContextEntry.extractedText` at extraction time (the file IS a context entry), so the existing Wave 3 trigger ALREADY handles this without any change. **Verify this in the migration plan; if true, this third migration is a NO-OP (and we don't write it).**

If decision is correct: only 2 migrations, no trigger touch. Document the decision in the migration header comment in migration b.

### 1.3 Update `apps/web/prisma/schema.prisma`

Add the new fields + enum + ExtractionJob table. Run `npx prisma generate`. Verify build still passes.

### 1.4 Zod schemas

`packages/core/src/schemas/files.ts` already exists from Wave 0. Extend with:

- `confirmUploadSchema` — extend with optional `entryId`, `createEntry: boolean`, `attachToBlockId?` for inline editor inserts
- `fileStatusSchema` — `{ id, status, extractedAt, extractionError, pageCount }`
- `uploadFileToolSchema` — for MCP `upload_file` tool: `{ url?, base64?, mimeType, filename, entryId? }` with refine that exactly one of `url`/`base64` is set
- `getFileContentToolSchema` — `{ fileId }`
- `listFilesByTypeToolSchema` — `{ mimeTypePrefix?, limit?, offset? }`

Re-export everywhere.

### 1.5 Audits

`ascend-migration-auditor` on the 2-3 migrations. Must PASS.

### 1.6 Commit

`feat(db): Wave 4 Phase 1 — File extraction fields + ExtractionJob + Zod`

---

## Phase 2: Extraction handlers + queue (Days 3-4)

### 2.1 Install deps

In `apps/web/package.json`:
```
"unpdf": "^0.13.0" or pinned version
"papaparse": "^5.5.0"
"xlsx": "^0.20.0"
```

`ffmpeg-static` adds binary; verify it works inside Alpine container. If not, defer video audio-track extraction or use an HTTP-based service.

### 2.2 `apps/web/lib/extraction/`

One handler per modality:

- `pdf-handler.ts` — uses `unpdf` `extractText`. Returns `{ text, pageCount }`.
- `image-handler.ts` — calls `llmService.chat` with image attachment + prompt asking for caption + comma-separated tags. Returns `{ text, tags }`.
- `audio-handler.ts` — calls a new `llmService.transcribe(userId, fileBuffer, mimeType, opts)` method that wraps OpenAI Whisper. Returns `{ text, durationSec }`. If `OPENAI_API_KEY` missing: throw a typed error with message "Transcription requires OPENAI_API_KEY".
- `video-handler.ts` — uses `ffmpeg-static` to extract audio track to MP3, then calls audio handler. Returns `{ text, durationSec, frameKeys: [] }` (frame thumbnails deferred per PRD).
- `spreadsheet-handler.ts` — `papaparse` for CSV, `xlsx` for XLSX. Returns text serialized as `"row 1: a, b, c\nrow 2: ..."`.
- `plain-text-handler.ts` — read bytes as UTF-8.

### 2.3 `extractionService` orchestrator

`apps/web/lib/services/extraction-service.ts`:
- `runExtractionForFile(fileId)` — fetches file (userId-scoped), reads R2 bytes via SDK, dispatches by MIME type, writes back to File via service, marks job complete or failed.
- All Prisma queries userId-scoped.
- Wraps each handler call in a 60s timeout.

### 2.4 `extractionQueueService`

`apps/web/lib/services/extraction-queue-service.ts`:
- `enqueue(fileId)` — create ExtractionJob row.
- `claimNext()` — `SELECT FOR UPDATE SKIP LOCKED` on jobs in PENDING with `scheduledAt <= now()`, mark EXTRACTING.
- `complete(jobId, result)` / `fail(jobId, error)`.
- `processOnce()` — claim + run + complete/fail, with retry scheduling on fail (`scheduledAt = now() + 1m * 5^attempts`).
- `processLoop()` — long-polling loop for in-process worker. Decision in this phase: in-process polling on the Next.js server vs separate worker. Recommend: separate runtime via a small `apps/web/scripts/worker.ts` that polls every 5s and runs `processOnce()`. Container CMD launches both `next start` AND `node scripts/worker.js` via a process manager (or just `&` for v1).

Actually simpler: a single Next.js scheduled task (cron-like) that calls `processNext()` every minute via a route. This is HTTP-driven; no in-process worker. The cron job (cron-job.org or GitHub Actions) hits `/api/files/extract/run` with `x-cron-secret` every minute. The route processes up to N jobs in 30s and returns. Pick this; it sidesteps process management entirely.

### 2.5 `llmService.transcribe`

Extend `apps/web/lib/services/llm-service.ts` with a transcription path:
- Always uses OpenAI Whisper (only provider supporting transcription in our stack as of 26. 4. 2026 web-check).
- Same cost-cap gate via `requestBudget`.
- Logs to `LlmUsage` with `purpose: "transcribe"`.

### 2.6 Audits

`ascend-security` on extraction handlers — focus on:
- userId scoping on file fetches
- 60s timeout per handler
- 50 MiB max file size for processing
- DZ-13 (queue runaway): maxAttempts=3, exponential backoff, daily user cap

### 2.7 Commit

`feat(extraction): Wave 4 Phase 2 — extraction handlers + queue + transcription`

---

## Phase 3: API routes + worker tick endpoint (Day 5)

### 3.1 Extend existing routes

- `POST /api/files/presign` — accept optional `entryId` / `createEntry` in body.
- `POST /api/files/confirm` — enqueue ExtractionJob on success.

### 3.2 New routes

- `GET /api/files/[id]` — return presigned download URL (5-min expiry); for SVG, stream bytes with hardened headers.
- `GET /api/files/[id]/status` — `{ status, extractedAt, error?, pageCount? }`.
- `POST /api/files/[id]/extract` — re-enqueue.
- `POST /api/files/extract/run` — cron endpoint, dual-auth (cron secret OR admin); processes up to N jobs in 30s; returns `{ processed, completed, failed }`.
- `POST /api/files/cleanup` — cron, deletes PENDING > 24h.

### 3.3 Audits

`ascend-security` on the route group:
- size caps server-side
- MIME allowlist
- presigned URL expiry ≤ 5 min
- SSRF prevention on `upload_file` URL fetch
- timing-safe cron secret

### 3.4 Commit

`feat(api): Wave 4 Phase 3 — file serving + status + extraction worker tick`

---

## Phase 4: React Query hooks + UI primitives (Day 6)

### 4.1 Hooks

`apps/web/lib/hooks/use-files.ts`:
- `useUploadFile()` — handles presign → upload → confirm → returns File row
- `useFile(id)` — GET `/api/files/[id]/status`
- `useFileStatus(id)` — auto-poll while EXTRACTING (refetchInterval 2s when status !== COMPLETE/FAILED)
- `useReExtract(id)` — POST `/api/files/[id]/extract`

### 4.2 Drop zone

`apps/web/components/files/file-drop-zone.tsx` — overlay on `/context` page:
- Listens for `dragenter` / `dragover` / `drop` on document root
- Renders a fullscreen drop hint when dragging files
- On drop: creates ContextEntry of type SOURCE for each file, kicks off uploads in parallel

### 4.3 File card

`apps/web/components/files/file-card.tsx` — used in entry list rows showing extraction badge. States: EXTRACTING (spinner), COMPLETE (green check), FAILED (red with retry button).

### 4.4 Commit

`feat(hooks+ui): Wave 4 Phase 4 — file upload hooks + drop zone + status card`

---

## Phase 5: Block editor file blocks (Days 7-8)

Fill the Wave 3 placeholder nodes with real renderers:

### 5.1 `apps/web/components/editor/file-block.tsx`

Generic file card decorator for `FileNode`. Reads `fileId` from node, uses `useFile(id)` to fetch metadata + status. Renders Download / Replace / Delete controls.

### 5.2 `apps/web/components/editor/image-block.tsx`

Decorator for `ImageNode`. Click → fullscreen modal with zoom + arrow nav across images in the same entry.

### 5.3 `apps/web/components/editor/pdf-preview.tsx`

For PDF MIME on `FileNode`, render a sandboxed iframe with the presigned URL: `<iframe sandbox="allow-same-origin" src={url} />`. No `allow-scripts`.

### 5.4 `apps/web/components/editor/audio-player.tsx` + `video-player.tsx`

Native `<audio>` / `<video>` controls. Audio player has a transcript-collapse toggle that fetches `/api/files/[id]/status` to read the transcript. Click timestamp → seek.

### 5.5 Slash menu integration

Extend Wave 3's slash menu with `/upload`, `/image`, `/pdf`, `/audio`, `/video`. Each opens a file picker filtered by appropriate MIME types. After upload, inserts the right block type at the cursor.

### 5.6 Drag-drop into editor

Lexical's `DRAGSTART_COMMAND` / `DROP_COMMAND` listeners; on file drop, upload + insert block at the drop position.

### 5.7 Commit

`feat(ui): Wave 4 Phase 5 — file blocks (PDF, image, audio, video, generic)`

---

## Phase 6: 3 MCP tools + cron workflows (Day 9)

### 6.1 MCP tools

`apps/web/lib/mcp/tools/file-tools.ts`:
- `upload_file({ url? | base64?, mimeType, filename, entryId? })` — server-side fetch (with allowlist for SSRF), pipe to R2, create File row, enqueue extraction. Returns `{ fileId, contextEntryId }`.
- `get_file_content({ fileId })` — return `{ extractedText, status, pageCount? }`. If status != COMPLETE, return current state without blocking.
- `list_files_by_type({ mimeTypePrefix?, limit? })` — list user's files filtered by MIME prefix (e.g., `image/`).

Add `FILE_TOOL_NAMES` Set + dispatch in `apps/web/lib/mcp/server.ts`. Tool count: 55 → 58.

### 6.2 Cron workflows

`.github/workflows/file-cleanup.yml` — daily 04:00 UTC, calls `/api/files/cleanup`.
`.github/workflows/file-extraction-tick.yml` — every minute (or 5 min), calls `/api/files/extract/run`. Use `*/5 * * * *`. Add comment that this could move to Dokploy scheduled tasks if Actions cron is too coarse.

Both use existing `CRON_SECRET` env (already set).

### 6.3 Commit

`feat(mcp+cron): Wave 4 Phase 6 — 3 file MCP tools (55 → 58) + cleanup/extraction cron`

---

## Phase 7: Wave close (Day 10)

### 7.1 `/ax:test`, `/ax:review`, `/ax:critique`

Same pattern as Waves 1-3. Critic verdict at GOOD or WORLD-CLASS required.

### 7.2 Smoke test in prod

- 58 MCP tools live (`/api/mcp tools/list`)
- Drop a PDF on /context → upload + extract end-to-end
- Drop an image → vision tagging works
- (If Whisper available) Drop a short audio → transcript appears
- Hybrid search returns files by content
- Cron tick processes pending jobs

### 7.3 Update `CLAUDE.md`

- MCP tool count 55 → 58
- Entity Model: ExtractionJob, File extension fields
- Architecture: extraction pipeline + queue
- Key File Lookup: extraction handlers, file-tools, file blocks
- Danger Zones: DZ-13 (queue runaway), DZ-14 (SSRF on upload_file). DZ-11 marked RESOLVED.

### 7.4 Update `BACKLOG.md`

Wave 4 SHIPPED. Carry-overs:
- Per-user storage quota → Wave 8
- Rate limiting on file routes → Wave 8
- Frame thumbnails for video → polish
- PDF page thumbnails → polish
- Transcript timestamp UI sync → polish
- Whisper streaming → polish
- Spreadsheet → DatabaseRow ingestion → Wave 5

### 7.5 Write `CLOSE-OUT.md`

Match Wave 1-3 close-out structure.

### 7.6 Final commit

`chore(wave-4): close Wave 4 — universal files shipped`

---

## Handoff to Wave 5

Wave 5 (Databases + properties) assumes:
- `File` rows can be linked to ContextEntries (Wave 4 wires this).
- Spreadsheet uploads exist; Wave 5 imports them as `DatabaseRow` records.
- Extraction queue infrastructure available for any Wave 5 reprocessing.
- 58 MCP tools live.
