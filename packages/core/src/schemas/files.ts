import { z } from "zod";

// ── Constants ──────────────────────────────────────────────────────────
// Single source of truth for allowed MIME types. Used by both Zod schemas
// (compile-time enum) and runtime service-level checks (Set).

// SVG note (security): image/svg+xml can contain embedded JavaScript
// (<script>, onload, etc.). Phase 7 only generates presigned UPLOAD URLs,
// so this is not currently exploitable. When a serving/download endpoint is
// built in a future wave, the endpoint MUST do one of:
//   (a) drop image/svg+xml from this allowlist, or
//   (b) sanitize SVGs server-side (DOMPurify or equivalent), or
//   (c) serve them with `Content-Disposition: attachment` and
//       `X-Content-Type-Options: nosniff` so the browser cannot render
//       them inline.
// Option (c) is the minimum bar.
export const ALLOWED_MIME_TYPES_ARRAY = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  // Wave 4 Phase 3: audio types (transcription handlers exist in extraction pipeline)
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  // Wave 4 Phase 3: video types (transcription handlers exist in extraction pipeline)
  "video/mp4",
  "video/quicktime",
  "video/webm",
  // Wave 4 Phase 3: XLSX (extraction handler exists)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES_ARRAY)[number];

export const ALLOWED_MIME_TYPES = new Set<string>(ALLOWED_MIME_TYPES_ARRAY);

/** Maximum upload size in bytes (100 MiB). */
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

/** Presigned URL expiry in seconds (15 minutes, for uploads). */
export const PRESIGN_EXPIRES_SECONDS = 900;

/** Download URL expiry in seconds (5 minutes). Shorter than upload to limit exposure. */
export const DOWNLOAD_URL_EXPIRES_SECONDS = 300;

// ── Extraction status values ──────────────────────────────────────────
// Matches the ExtractionStatus enum in schema.prisma. Used by Zod schemas
// and MCP tool definitions.
export const EXTRACTION_STATUS_VALUES = [
  "PENDING",
  "EXTRACTING",
  "COMPLETE",
  "FAILED",
] as const;

export type ExtractionStatusValue = (typeof EXTRACTION_STATUS_VALUES)[number];

// ── Schemas ────────────────────────────────────────────────────────────

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(255).trim(),
  mimeType: z.enum(ALLOWED_MIME_TYPES_ARRAY),
  sizeBytes: z.number().int().positive().max(UPLOAD_MAX_BYTES),
  // Wave 4 Phase 3: optional link to an existing ContextEntry
  entryId: z.string().min(1).optional(),
  // Wave 4 Phase 3: auto-create a ContextEntry of type SOURCE for this file
  createEntry: z.boolean().optional().default(false),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

// Wave 4: extended with optional entryId and createEntry for linking files
// to context entries during the confirm step.
export const confirmUploadSchema = z.object({
  fileId: z.string().min(1),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  // Optional: attach the file to an existing ContextEntry
  entryId: z.string().min(1).optional(),
  // Optional: auto-create a ContextEntry of type SOURCE for this file
  createEntry: z.boolean().optional().default(false),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

// Wave 4: file extraction status (returned by GET /api/files/[id]/status)
export const fileStatusSchema = z.object({
  id: z.string(),
  status: z.enum(EXTRACTION_STATUS_VALUES),
  extractedAt: z.coerce.date().nullable(),
  extractionError: z.string().nullable(),
  pageCount: z.number().int().nullable(),
});
export type FileStatus = z.infer<typeof fileStatusSchema>;

// Wave 4: re-extract trigger (POST body is empty; schema exists for
// consistency with the "every POST body through Zod" safety rule)
export const reExtractSchema = z.object({});
export type ReExtractInput = z.infer<typeof reExtractSchema>;

// ── MCP tool schemas ──────────────────────────────────────────────────

// upload_file: MCP tool for uploading files by URL or base64
export const uploadFileToolSchema = z
  .object({
    url: z.string().url().optional(),
    base64: z.string().optional(),
    mimeType: z.string().min(1).max(200),
    filename: z.string().min(1).max(500),
    entryId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.url) !== Boolean(v.base64), {
    message: "Exactly one of url or base64 must be provided",
  });
export type UploadFileToolInput = z.infer<typeof uploadFileToolSchema>;

// get_file_content: MCP tool for retrieving extracted text
export const getFileContentToolSchema = z.object({
  fileId: z.string().min(1),
});
export type GetFileContentToolInput = z.infer<typeof getFileContentToolSchema>;

// list_files_by_type: MCP tool for listing files filtered by MIME prefix
export const listFilesByTypeToolSchema = z.object({
  mimeTypePrefix: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});
export type ListFilesByTypeToolInput = z.infer<
  typeof listFilesByTypeToolSchema
>;
