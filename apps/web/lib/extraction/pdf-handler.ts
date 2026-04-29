/**
 * PDF extraction handler.
 *
 * Uses `unpdf` (pdfjs-dist wrapper) to extract text content from PDF files.
 * Caps extraction at the first 100 pages per PRD success criteria.
 */

import type { ExtractionResult, ExtractionHandlerOpts } from "./types";

/** Maximum number of pages to extract text from. */
const MAX_PAGES = 100;

export async function extractPdf(
  buffer: Buffer,
  _mimeType: string,
  _opts?: ExtractionHandlerOpts,
): Promise<ExtractionResult> {
  // unpdf is ESM-only; dynamic import is required.
  const { extractText, getDocumentProxy } = await import("unpdf");

  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const totalPages = pdf.numPages;

  if (totalPages <= MAX_PAGES) {
    // Small enough to extract all pages in one shot.
    const { text } = await extractText(pdf, { mergePages: true });
    return { text, pageCount: totalPages };
  }

  // Large PDF: extract per-page and take only the first MAX_PAGES.
  // extractText with mergePages: false returns { text: string[], totalPages }.
  const { text: pages } = await extractText(pdf, { mergePages: false });
  const extractedText = pages.slice(0, MAX_PAGES).join("\n\n");

  return {
    text: extractedText,
    pageCount: totalPages,
  };
}
