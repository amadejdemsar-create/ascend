/**
 * Plain text extraction handler.
 *
 * Handles text/plain, text/markdown, application/json, and image/svg+xml
 * by reading the buffer as UTF-8. No transformation needed.
 */

import type { ExtractionResult, ExtractionHandlerOpts } from "./types";

const SUPPORTED_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "image/svg+xml",
]);

export function isPlainTextMime(mimeType: string): boolean {
  return SUPPORTED_MIMES.has(mimeType);
}

export async function extractPlainText(
  buffer: Buffer,
  _mimeType: string,
  _opts?: ExtractionHandlerOpts,
): Promise<ExtractionResult> {
  const text = buffer.toString("utf-8");
  return { text };
}
