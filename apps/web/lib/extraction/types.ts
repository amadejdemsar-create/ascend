/**
 * Shared types for the extraction pipeline.
 *
 * Each modality handler returns an ExtractionResult. The extraction service
 * orchestrator normalizes these into File column updates.
 */

// ── Result type ─────────────────────────────────────────────────

export type ExtractionResult = {
  text: string;
  pageCount?: number;
  durationSec?: number;
  tags?: string[];
  thumbnailKey?: string;
};

// ── Handler function signature ──────────────────────────────────

export type ExtractionHandlerOpts = {
  userId: string;
  signal?: AbortSignal;
};

export type ExtractionHandler = (
  buffer: Buffer,
  mimeType: string,
  opts?: ExtractionHandlerOpts,
) => Promise<ExtractionResult>;

// ── Custom errors ───────────────────────────────────────────────

/**
 * Thrown when a file's MIME type has no registered extraction handler.
 * The queue service catches this and marks the job as permanently failed
 * (no retry, since a different MIME handler will not appear on retry).
 */
export class UnsupportedMimeTypeError extends Error {
  readonly mimeType: string;

  constructor(mimeType: string) {
    super(`No extraction handler for MIME type: ${mimeType}`);
    this.name = "UnsupportedMimeTypeError";
    this.mimeType = mimeType;
  }
}

/**
 * Thrown when extraction exceeds the per-handler timeout.
 */
export class ExtractionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Extraction timed out after ${timeoutMs}ms`);
    this.name = "ExtractionTimeoutError";
  }
}

/**
 * Thrown when a user exceeds the daily extraction quota.
 */
export class ExtractionQuotaExceededError extends Error {
  readonly userId: string;
  readonly cap: number;

  constructor(userId: string, cap: number) {
    // Keep userId out of .message (it gets persisted to File.extractionError
    // and surfaced to users). The userId field is available for internal logging.
    super(`Daily extraction cap of ${cap} files reached. Try again tomorrow.`);
    this.name = "ExtractionQuotaExceededError";
    this.userId = userId;
    this.cap = cap;
  }
}

/**
 * Thrown when image extraction is attempted but the ChatProvider interface
 * does not support multimodal content (image attachments). The handler
 * falls back to a placeholder result so the job still completes.
 */
export class ImageExtractionUnavailableError extends Error {
  constructor() {
    super(
      "Image captioning requires a vision-capable LLM provider with " +
        "multimodal content support. The current @ascend/llm ChatMessage " +
        "interface only supports string content. Image extraction will " +
        "return a placeholder until the interface is extended.",
    );
    this.name = "ImageExtractionUnavailableError";
  }
}
