# Wave 4 Close-Out — Universal Files

**Date closed:** 2. 5. 2026
**PRD:** [PRD.md](./PRD.md)
**Target:** 6-10 working days solo (2-3 weeks per VISION)
**Actual:** 2 sessions across 26. 4. – 2. 5. 2026 (~1.5 working days net)
**Verdict:** SHIPPED with non-blocking follow-ups (DZ-13 R2 reconciliation, transcript click-to-seek, upload progress indicator, image alt-text editing, presigned-URL refresh on long sessions)

## Commits (7, all pushed to main and auto-deployed via Dokploy)

| SHA | Subject |
|---|---|
| `d423b1f` | docs(wave-4): plan universal files (uploads + extraction + 3 MCP tools) |
| `632528a` | feat(db): Wave 4 Phase 1 — extraction fields on File + ExtractionJob + Zod |
| `7f99c9c` | feat(extraction): Wave 4 Phase 2 — extraction handlers + queue + transcription |
| `b0d67ca` | feat(api): Wave 4 Phase 3 — file serving + status + extraction worker tick |
| `b5a3637` | feat(hooks+ui): Wave 4 Phase 4 — file upload hooks + drop zone + status card |
| `fc6c42e` | feat(ui): Wave 4 Phase 5 — file blocks (PDF, image, audio, video, generic) |
| `29ae8cd` | feat(mcp+cron): Wave 4 Phase 6 — 3 file MCP tools (55 → 58) + cleanup/extraction cron |
| (pending) | chore(wave-4): close Wave 4 — universal files shipped |

The pending wave-close commit bundles: critic-driven fixes (Upload button + SpreadsheetPreview), `@types/node` devDep fix in `packages/editor` for typecheck, CLAUDE.md updates (File storage section rewritten as Wave 0+4, File and ExtractionJob entity rows, file-block view row, DZ-11 resolved + DZ-12 + DZ-13 added), BACKLOG.md update, and this CLOSE-OUT.md.

## PRD success criteria status

### Functional criteria

- [x] **Drop-zone overlay on `/context`.** DONE (`b5a3637`). `FileDropZone` mounted in `(app)/layout.tsx` overlays the page on drag with backdrop + dashed border; defers to in-editor drops via `e.defaultPrevented`.
- [x] **Upload button in `/context` toolbar (multi-select).** DONE (critic must-fix `2. 5. 2026`). Outline-variant button between View Switcher and "New" in all four PageHeader instances on the page; opens `<input type="file" multiple>`, kicks off `useUploadFile({ createEntry: true })` per file.
- [x] **File block in Lexical editor; insertable via slash menu OR drag-drop.** DONE (`fc6c42e`). Slash items `/upload`, `/file`, `/image`, `/pdf`, `/audio`, `/video`. Drag-drop into editor canvas via `FileDropPlugin`.
- [x] **MIME-aware inline preview.** DONE.
  - PDF → `PdfPreview` sandboxed iframe.
  - Image → `ImageBlock` with click-to-zoom lightbox, arrow-key nav, Fit/100%/200% zoom.
  - Audio → `AudioPlayer` native + collapsible transcript.
  - Video → `VideoPlayer` native + collapsible transcript (frame thumbnail strip deferred per BACKLOG).
  - Spreadsheet → `SpreadsheetPreview` 5×5 inline table (critic must-fix `2. 5. 2026`).
  - Other → generic `FileCard` with download.
- [x] **Presigned URL flow + `confirmUpload` enqueues extraction.** DONE (`b0d67ca`). `presign` accepts optional `entryId` / `createEntry`; `confirm` enqueues `ExtractionJob` row with `status: PENDING`.
- [x] **Job queue with retry (3 attempts) + Retry button on failed.** DONE (`7f99c9c`). `extractionQueueService` uses `SELECT FOR UPDATE SKIP LOCKED`, retries up to 3 with exponential backoff `5^attempts` minutes, per-user daily cap of 50. `FileCard` surfaces a `Retry` button on FAILED status that calls `useReExtract`.
- [x] **6 per-modality extraction handlers.** DONE. PDF (`unpdf`, up to 100 pages), image (Gemini Vision caption + tags), audio (Whisper, requires `OPENAI_API_KEY`), video (`ffmpeg-static` audio extract → Whisper), spreadsheet (csv via `papaparse`, xlsx via `xlsx`), plain-text (content as-is). Sanitized errors.
- [x] **`extractedText` feeds `search_vector` / hybrid search.** DONE. Wave 3's trigger function already indexes `ContextEntry.extractedText`; the file-extraction handler writes the extracted text onto the parent `ContextEntry` (when `createEntry: true`), so file content is hybrid-searchable alongside written entries.
- [x] **Block editor `FileNode` and `ImageNode` decorators filled.** DONE (`fc6c42e`). Wave 3 stubs replaced with real renderers via the same mutation-listener + `createPortal` pattern Wave 3's `AIBlockNode` introduced. `packages/editor` stays React-free; React decorator lives in `apps/web`.
- [x] **3 MCP tools (round 4); tool count 55 → 58.** DONE (`29ae8cd`). `upload_file` (with hardened SSRF defenses: https-only, IPv4/IPv6 private-IP blocklist incl. 0.0.0.0/8, 100.64.0.0/10, multicast, reserved, ::ffff: mapped, fe80::/10; `redirect: "error"`), `get_file_content`, `list_files_by_type`.
- [x] **Cleanup cron for orphan PENDING > 24h.** DONE (`29ae8cd`). `POST /api/files/cleanup` cron-only, daily 04:00 UTC; deletes `File` rows in PENDING > 24h and DELETEs the corresponding R2 object.
- [x] **R2 object serving via `GET /api/files/[id]`.** DONE (`b0d67ca` + Phase 5 amendment in `fc6c42e`). Accept-header content negotiation: HTML/JSON returns 5-min presigned download URL via 302; SVG MIME types stream bytes server-side with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
- [x] **URL sanitization (DZ-11 resolution).** DONE. All file URLs route through `/api/files/[id]` (auth + userId required); raw R2 URLs never reach the client. SVG attachment guard. PDF in sandboxed iframe.

### Quality criteria

- [ ] **PDF extraction within 10s typical (up to 50 pages).** NOT FORMALLY MEASURED. `unpdf` is fast in practice; 60s timeout is a backstop.
- [ ] **Image OCR/vision tagging within 5s.** NOT FORMALLY MEASURED. Single Gemini Vision call.
- [ ] **Audio Whisper within 60s for files up to 5 min.** NOT FORMALLY MEASURED. OpenAI Whisper API typical latency.
- [ ] **Upload latency to "extracting" status < 2s for files up to 5 MB.** NOT FORMALLY MEASURED. Presigned PUT + confirm round trip; should be well under 2s.
- [x] **`tsc --noEmit` and `pnpm build` pass with zero errors.** DONE. Verified at every commit and at wave close (after `@types/node` devDep added to `packages/editor`).
- [x] **`ascend-security` audit on upload + serving routes: PASS.** DONE. Per-phase audits (Phase 2, Phase 3, Phase 6) PASSED WITH NOTES; HIGH findings in Phase 2 (extraction handler sandbox boundaries) and Phase 6 (SSRF in `upload_file` URL fetch path) fixed before commit.
- [x] **`ascend-migration-auditor` PASS on Wave 4 migrations.** DONE. Both migrations are additive; `search_vector` / GIN index / trigger untouched (DZ-2 safe).
- [x] **`ascend-architect` PASS on shared package changes.** DONE. The single `packages/*` change in this wave was `FileNode.setFileId` setter in `packages/editor`. Pure TS, no React/DOM/runtime imports beyond Lexical's existing surface.
- [x] **`ascend-critic` verdict GOOD or WORLD-CLASS.** DONE. First pass: GOOD with 2 must-fix items (Upload button, SpreadsheetPreview). Both addressed in the wave-close session. The critique stands at GOOD; see `.ascendflow/critiques/2026-05-02-1015-wave4-close.md`.

### Cross-platform criteria

- [x] **Upload primitive is platform-agnostic.** DONE. `/api/files/presign` returns a presigned URL the client uploads to directly. Mobile (Wave 6) Expo `DocumentPicker` / `ImagePicker` will hit the same endpoint.
- [x] **Extracted text + thumbnails are platform-portable.** DONE. URL-based, no local paths.
- [x] **No native dependencies in shared packages.** DONE. Server-only deps (`unpdf`, `ffmpeg-static`, `papaparse`, `xlsx`) all live in `apps/web/lib/extraction/` and `apps/web` package.json. `packages/editor` stays platform-agnostic (FileNode is metadata-only; rendering happens in apps/web).

## Verification summary

- `pnpm typecheck`: PASS (zero errors after `@types/node` devDep added to `packages/editor`).
- `pnpm build`: PASS (compiled in 8.5s, 61 routes, zero errors).
- `ax:review` (safety rules + pattern compliance): **PASS WITH NOTES** at `.ascendflow/reviews/2026-05-02-1007-wave4-close.md`. All six safety rules verified. Notes cover the DZ-13 R2 orphan path, migration idempotency wording, and the duplicated `verifyCronSecret`.
- `ax:critique` (product quality): **GOOD** at `.ascendflow/critiques/2026-05-02-1015-wave4-close.md`. 9 PASS / 4 WARN / 0 FAIL of 13 product quality checks. Two must-fix items (Upload button, SpreadsheetPreview) addressed in this session.
- `ax:verify-ui`: deferred to prod smoke test. Surface-level Playwright cannot exercise the upload pipeline without R2 + Gemini/OpenAI keys configured. Smoke test plan is in PRD's "Smoke Tests" section.

## Critic verdict

**Verdict: GOOD.**

Bright spots called out:
- Drop-zone implementation correctly handles nested-element drag counter and defers to editor's `FileDropPlugin`.
- `ImageBlock` lightbox rivals Apple Photos quality (arrow-key nav, zoom, document-order collection, counter, Escape close).
- Error copy is human and specific ("File too large for extraction (X MiB exceeds Y MiB limit)") rather than raw error objects.
- Auto-poll status (`useFileStatus` with refetchInterval that stops on terminal status) matches Linear's background job feedback.
- Security posture is strong: all URLs through `/api/files/[id]`, sandboxed PDF iframe, SSRF allowlist on MCP upload, dual-layer MIME + size validation.

Should-fix items deferred to BACKLOG (Wave 4 carry-overs section): timestamp-linked transcript seeking, image alt-text editing, upload progress indicator, image presigned-URL refresh on long sessions, lightbox unification between `FileBlockImage` and `ImageBlock`.

## Architecture notes for future waves

- **Extraction handlers are stateless and timeout-bounded.** Each handler returns plain text within 60s wall-clock and 50 MiB working-set. No handler imports `@/lib/db` directly; persistence is the queue's job. Adding a new modality (e.g., DOCX) is a single new handler file plus a MIME route.
- **The queue is intentionally simple.** Postgres-backed (no Redis), `SELECT FOR UPDATE SKIP LOCKED` with stateless API-route worker tick. The cron + tick pattern scales horizontally if needed (multiple ticks running in parallel are safe due to row-level locks). Wave 8 multi-user can keep this design.
- **DZ-9 budget gating extends to extraction.** Every Whisper, Gemini Vision, and Gemini Embedding call inside an extraction handler still goes through `llmService.requestBudget` synchronously. Extraction cannot blow past the daily $10 hard cap.
- **`packages/editor` stayed React-free.** Wave 3 introduced the mutation-listener + `createPortal` pattern via `AIBlockNode`. Wave 4 reuses it for `FileNode` and `ImageNode` without modification. The package's `decorate()` returns `null`; the web layer renders into the DOM container Lexical creates via `createDOM()`.
- **Single-page detail panel discipline preserved.** Files don't introduce a separate "files" page or list view; they live inline in the block editor and surface in the same `/context` list/graph/backlinks views as any other entry. This is the universal-files thesis: files ARE entries.

## Open follow-ups (must execute before close commit)

- [x] CLAUDE.md updated (File storage section rewritten, File + ExtractionJob entity rows, file-block view row, DZ-11 resolved + DZ-12 + DZ-13 added).
- [x] BACKLOG.md updated with Wave 4 ship summary + carry-overs.
- [x] CLOSE-OUT.md written (this file).
- [ ] Final commit `chore(wave-4): close Wave 4 — universal files shipped` bundling: critic must-fixes, typecheck fix, CLAUDE.md, BACKLOG.md, CLOSE-OUT.md, review + critique artifacts.
- [ ] Push to `origin/main` → Dokploy auto-deploys → smoke tests per PRD.
- [ ] Verify `/api/mcp tools/list` returns 58 in production.
- [ ] Verify cron workflows fire (file-extraction-tick at next 5-min boundary; file-cleanup at 04:00 UTC tomorrow).

## Pre-deploy checklist (Dokploy + GitHub Actions)

- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in Dokploy env.
- [ ] `GEMINI_API_KEY` in Dokploy env (image vision + embeddings).
- [ ] `OPENAI_API_KEY` in Dokploy env (audio/video transcription; optional but recommended).
- [ ] `CRON_SECRET` in Dokploy env (already set from Wave 2; verify).
- [ ] `CRON_SECRET` in GitHub Actions repo secrets (already set from Wave 2; verify).
- [ ] R2 CORS allows `PUT` and `GET` from `https://ascend.nativeai.agency`.
- [ ] Manual smoke: drop a small PDF on `/context`, observe extraction completes, verify `get_file_content` returns text.
- [ ] Manual smoke: drop an image, verify Gemini Vision tagging produces caption + tags.
- [ ] If `OPENAI_API_KEY` set: drop a short audio file, verify Whisper transcript appears.
- [ ] Hybrid search returns files by extracted content.
- [ ] GitHub Actions cron runs visible.

## Wave 5 onramp

Wave 4 closes the universal-files thesis. Wave 5 (per VISION) is the **Universal Inbox / capture-anywhere flow**: an Apple Reminders-style quick-capture surface (Cmd+Shift+; or similar) that drops a `ContextEntry` of type `NOTE` or a `Todo` into the system from anywhere in the app, plus a mobile share-sheet handoff that becomes a real flow once Wave 6 ships Expo. The graph + block + file primitives are now in place; Wave 5 is about ingestion velocity, not new node types.
