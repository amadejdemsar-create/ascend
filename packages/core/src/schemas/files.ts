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
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES_ARRAY)[number];

export const ALLOWED_MIME_TYPES = new Set<string>(ALLOWED_MIME_TYPES_ARRAY);

/** Maximum upload size in bytes (100 MiB). */
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

/** Presigned URL expiry in seconds (15 minutes). */
export const PRESIGN_EXPIRES_SECONDS = 900;

// ── Schemas ────────────────────────────────────────────────────────────

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(255).trim(),
  mimeType: z.enum(ALLOWED_MIME_TYPES_ARRAY),
  sizeBytes: z.number().int().positive().max(UPLOAD_MAX_BYTES),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const confirmUploadSchema = z.object({
  fileId: z.string().min(1),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
