# Wave 4 Extraction Stack Decision

**Verified:** 27. 4. 2026 by Phase 1 web-check via `npm view` CLI + OpenAI docs review
**Re-verify if:** plan paused > 30 days

## Versions to pin

| Package | Version | Source | Notes |
|---|---|---|---|
| unpdf | 1.6.0 | npm registry (27. 4. 2026) | PDF text extraction across all JS runtimes. Uses pdfjs-dist under the hood. No native deps. Node 22 compatible. |
| papaparse | 5.5.3 | npm registry (27. 4. 2026) | CSV parser, streaming capable. |
| @types/papaparse | 5.5.2 | npm registry (27. 4. 2026) | TypeScript definitions for papaparse. |
| xlsx | 0.18.5 | npm registry (27. 4. 2026) | SheetJS Community Edition. Apache-2.0 license. Reads XLSX, XLS, CSV, ODS. No Pro license required for our read-only use case. |
| ffmpeg-static | 5.3.0 | npm registry (27. 4. 2026) | Statically linked ffmpeg 6.1.1 binaries. Supports macOS (x64, arm64), Linux (x64, x86, armhf, arm64), Windows (x64, x86). |

## OpenAI Transcription Models

| Model ID | Type | Pricing | Notes |
|---|---|---|---|
| `whisper-1` | Legacy | $0.006 / minute | Stable, widely deployed. Per-minute billing. Supports 57 languages. Max 25 MB per file. |
| `gpt-4o-transcribe` | Current | ~$0.006 / minute equivalent (token-based) | Newer model with improved accuracy. Uses the GPT-4o architecture for transcription. Token-based pricing. |
| `gpt-4o-mini-transcribe` | Current | ~$0.003 / minute equivalent (token-based) | Cheaper variant with good accuracy for most content. Token-based pricing. |

**Decision:** Use `whisper-1` as the default transcription model. It has per-minute billing (predictable cost), is battle-tested, and sufficient for Ascend's use case (personal voice notes, meeting recordings). The `gpt-4o-transcribe` models offer marginal accuracy improvements but introduce token-based billing that is harder to cost-cap. The model ID is configurable in `llmService.transcribe` so upgrading later is a one-line change.

**Pricing note:** At $0.006/minute, a 5-minute voice note costs $0.03. The daily cost cap from DZ-9 (Wave 2) limits total LLM spend; Whisper calls count toward that budget.

## Per-Modality Extraction Approach

| MIME prefix | Handler | Library | Output |
|---|---|---|---|
| `application/pdf` | `pdf-handler.ts` | `unpdf` (`extractText`) | `{ text, pageCount }` |
| `image/*` | `image-handler.ts` | Gemini Vision via `llmService.chat` | `{ text (caption + tags), tags[] }` |
| `audio/*` | `audio-handler.ts` | OpenAI Whisper (`whisper-1`) via `llmService.transcribe` | `{ text (transcript), durationSec }` |
| `video/*` | `video-handler.ts` | `ffmpeg-static` extracts audio track to MP3, then audio handler | `{ text (transcript), durationSec }` |
| `text/csv` | `spreadsheet-handler.ts` | `papaparse` | `{ text ("row 1: a, b\nrow 2: ...") }` |
| `application/vnd.openxmlformats*` | `spreadsheet-handler.ts` | `xlsx` | `{ text ("row 1: a, b\nrow 2: ...") }` |
| `text/plain`, `text/markdown` | `plain-text-handler.ts` | Buffer.toString('utf-8') | `{ text }` |
| `application/json` | `plain-text-handler.ts` | Buffer.toString('utf-8') | `{ text }` |
| `image/svg+xml` | `plain-text-handler.ts` | Buffer.toString('utf-8') (SVG is text) | `{ text }` |

## ffmpeg Packaging Decision

**Problem:** The production container uses `node:22-alpine` (musl libc). `ffmpeg-static@5.3.0` ships glibc-linked Linux binaries from johnvansickle.com. While the Dockerfile already includes `apk add --no-cache libc6-compat` (which provides glibc compatibility shims), ffmpeg's static builds sometimes have runtime issues on musl due to DNS resolution (glibc's `nss` vs musl's resolver) and thread-local storage differences.

**Decision:** Install ffmpeg natively in the Docker image via `apk add --no-cache ffmpeg` in the runner stage. This gives us a musl-native build that is guaranteed to work on Alpine. The `ffmpeg-static` npm package is used only in local development (macOS). At runtime, the audio handler resolves the ffmpeg binary path with this priority:

1. `process.env.FFMPEG_PATH` (explicit override)
2. `ffmpeg-static` (if installed and importable, for local dev)
3. System `ffmpeg` (via `which ffmpeg`, for production Alpine)

This avoids making `ffmpeg-static` a production dependency while keeping local dev zero-config. The Dockerfile change is one line in the runner stage.

**Dockerfile addition (runner stage, before USER nextjs):**
```dockerfile
RUN apk add --no-cache ffmpeg
```

## Worker Runtime Decision

**Decision:** HTTP cron tick (simpler, avoids process management).

A single API route `POST /api/files/extract/run` processes up to N extraction jobs per invocation (default N=5, capped at 30 seconds wall time). An external cron (GitHub Actions schedule or Dokploy scheduled task) hits this endpoint every 5 minutes with a shared `CRON_SECRET` header.

**Why not in-process polling:**
- The Next.js standalone server is single-process. A long-running polling loop competes with request handling.
- No process manager (pm2, supervisord) in the container; adding one increases operational complexity.
- The cron approach is stateless: if the container restarts, no jobs are lost (they are in Postgres).
- For the solo-user scale of Ascend, 5-minute polling is more than sufficient. A just-uploaded file waits at most 5 minutes before extraction begins (or the confirm endpoint can eagerly process one job inline for instant feedback).

**Cron schedule:** `*/5 * * * *` (every 5 minutes). `.github/workflows/file-extraction-tick.yml` or Dokploy scheduled task.

## Multimodal Embedding

Per Wave 2 MODEL-DECISION.md, `gemini-embedding-2` supports:
- Text: up to 8,192 tokens
- Image: PNG, JPEG, max 6 images per request
- Audio: MP3, WAV, max 180 seconds
- Video: MP4, MOV, max 120 seconds, max 32 frames
- PDF: max 6 pages

**Decision:** For files where Gemini Embedding 2 supports the modality directly (image, audio short clips, video short clips, PDF up to 6 pages), embed via the multimodal API. For all other files (long audio, long video, large PDFs, spreadsheets, plain text), embed the extracted text via the text API. The embedding lives on the `File.multimodalEmbedding` column (vector(1536)), not on the ContextEntry's existing `embedding` column. This keeps text embeddings and multimodal embeddings separate for potential future hybrid search.

## Open Items for Phase 2

- Confirm `unpdf` works in the standalone Next.js bundle (it may need `serverComponentsExternalPackages` in `next.config.ts`).
- Verify `xlsx` Community Edition handles the XLSX files Ascend users will upload (it does not support macros or password-protected files, which is acceptable).
- Audio/video MIME types need to be added to `ALLOWED_MIME_TYPES_ARRAY` in `packages/core/src/schemas/files.ts` before the upload flow can accept them. Phase 2 will extend the allowlist.
