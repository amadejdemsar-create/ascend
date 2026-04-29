/**
 * Extraction dispatcher.
 *
 * Maps MIME types to the appropriate modality handler. Throws
 * UnsupportedMimeTypeError for unknown MIME types so the queue
 * service can mark the job as permanently failed (no retry).
 */

export type { ExtractionResult, ExtractionHandlerOpts } from "./types";
export {
  UnsupportedMimeTypeError,
  ExtractionTimeoutError,
  ExtractionQuotaExceededError,
} from "./types";

import type { ExtractionResult, ExtractionHandlerOpts } from "./types";
import { UnsupportedMimeTypeError } from "./types";

import { extractPdf } from "./pdf-handler";
import { extractImage } from "./image-handler";
import { extractAudio } from "./audio-handler";
import { extractVideo } from "./video-handler";
import { extractSpreadsheet } from "./spreadsheet-handler";
import { extractPlainText, isPlainTextMime } from "./plain-text-handler";

// ── MIME prefix matching ────────────────────────────────────────

const PDF_MIMES = new Set(["application/pdf"]);

const IMAGE_MIMES_PREFIX = "image/";

const AUDIO_MIMES_PREFIX = "audio/";

const VIDEO_MIMES_PREFIX = "video/";

const SPREADSHEET_MIMES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "application/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

// ── Dispatcher ──────────────────────────────────────────────────

/**
 * Route a file buffer to the correct extraction handler based on MIME type.
 *
 * Priority order matters: SVG is `image/svg+xml` but should be treated as
 * plain text (it is XML source code), so plain-text check runs before
 * the image prefix check.
 *
 * @throws {UnsupportedMimeTypeError} if no handler matches the MIME type.
 */
export async function dispatch(
  buffer: Buffer,
  mimeType: string,
  opts?: ExtractionHandlerOpts,
): Promise<ExtractionResult> {
  // 1. Plain text (includes text/plain, text/markdown, application/json, image/svg+xml)
  if (isPlainTextMime(mimeType)) {
    return extractPlainText(buffer, mimeType, opts);
  }

  // 2. PDF
  if (PDF_MIMES.has(mimeType)) {
    return extractPdf(buffer, mimeType, opts);
  }

  // 3. Spreadsheet
  if (SPREADSHEET_MIMES.has(mimeType)) {
    return extractSpreadsheet(buffer, mimeType, opts);
  }

  // 4. Audio (before video, since video handler extracts audio internally)
  if (mimeType.startsWith(AUDIO_MIMES_PREFIX)) {
    return extractAudio(buffer, mimeType, opts);
  }

  // 5. Video
  if (mimeType.startsWith(VIDEO_MIMES_PREFIX)) {
    return extractVideo(buffer, mimeType, opts);
  }

  // 6. Image (checked after SVG was caught by plain-text above)
  if (mimeType.startsWith(IMAGE_MIMES_PREFIX)) {
    return extractImage(buffer, mimeType, opts);
  }

  throw new UnsupportedMimeTypeError(mimeType);
}
