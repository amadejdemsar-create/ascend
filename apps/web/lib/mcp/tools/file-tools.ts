import { ZodError } from "zod";
import { fileService } from "@/lib/services/file-service";
import { extractionQueueService } from "@/lib/services/extraction-queue-service";
import { contextService } from "@/lib/services/context-service";
import {
  uploadFileToolSchema,
  getFileContentToolSchema,
  listFilesByTypeToolSchema,
  ALLOWED_MIME_TYPES,
  UPLOAD_MAX_BYTES,
} from "@/lib/validations";
import { validateUrlForSsrf } from "@/lib/ssrf";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(result: unknown): McpContent {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function fail(message: string): McpContent {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ── SSRF protection helpers ─────────────────────────────────────────
// Extracted to @/lib/ssrf.ts (shared with /api/og route).
// isPrivateIp and validateUrlForSsrf are imported at the top of this file.

/**
 * Fetch bytes from a URL with SSRF protection, timeout, and size cap.
 */
async function fetchUrlBytes(
  url: string,
  mimeType: string,
): Promise<Buffer> {
  await validateUrlForSsrf(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    let response: Response;
    try {
      response = await globalThis.fetch(url, {
        signal: controller.signal,
        redirect: "error",
      });
    } catch (fetchErr) {
      // globalThis.fetch throws a TypeError when redirect: "error" encounters
      // a 3xx redirect. Wrap it in a friendlier message.
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      if (msg.includes("redirect")) {
        throw new Error("URL responded with a redirect; provide a direct URL");
      }
      throw fetchErr;
    }

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    // Check Content-Length header if available (early reject)
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > UPLOAD_MAX_BYTES) {
      throw new Error(
        `Remote file size ${contentLength} exceeds maximum ${UPLOAD_MAX_BYTES} bytes`,
      );
    }

    // Loose Content-Type consistency check: if the server declares a
    // Content-Type, its prefix should match what the user asserted.
    // Skip the check if the server does not declare one (some CDNs
    // serve with application/octet-stream).
    const serverContentType = response.headers.get("content-type");
    if (serverContentType) {
      const serverBase = serverContentType.split(";")[0]?.trim().toLowerCase();
      const declaredBase = mimeType.toLowerCase();
      // Prefix match: e.g., "image/" matches "image/png"
      const serverPrefix = serverBase?.split("/")[0];
      const declaredPrefix = declaredBase.split("/")[0];
      if (
        serverBase &&
        serverBase !== "application/octet-stream" &&
        serverPrefix !== declaredPrefix
      ) {
        throw new Error(
          `Content-Type mismatch: server returned "${serverBase}" but mimeType "${declaredBase}" was declared`,
        );
      }
    }

    // Read the body with a size cap
    if (!response.body) {
      throw new Error("Response has no body");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > UPLOAD_MAX_BYTES) {
        reader.cancel();
        throw new Error(
          `Remote file exceeds maximum ${UPLOAD_MAX_BYTES} bytes (streamed)`,
        );
      }
      chunks.push(value);
    }

    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Max text length for get_file_content responses ──────────────────

const MAX_EXTRACTED_TEXT_CHARS = 100_000;

/**
 * Handle file MCP tool calls.
 *
 * Three tools: upload_file, get_file_content, list_files_by_type.
 *
 * upload_file performs server-side fetch (with SSRF protection) or
 * base64 decode, uploads directly to R2 via fileService.uploadBytes,
 * and enqueues extraction.
 *
 * userId comes from createAscendMcpServer(userId) factory, never from args.
 */
export async function handleFileTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "upload_file": {
        const data = uploadFileToolSchema.parse(args);

        // If entryId provided, verify ownership
        if (data.entryId) {
          const entry = await contextService.getById(userId, data.entryId);
          if (!entry) {
            return fail(`Context entry not found: ${data.entryId}`);
          }
        }

        // Validate MIME type against the allowlist
        if (!ALLOWED_MIME_TYPES.has(data.mimeType)) {
          return fail(`MIME type not allowed: ${data.mimeType}`);
        }

        // Get the bytes
        let buffer: Buffer;
        if (data.base64) {
          buffer = Buffer.from(data.base64, "base64");
          if (buffer.length === 0) {
            return fail("base64 decoded to zero bytes");
          }
        } else if (data.url) {
          buffer = await fetchUrlBytes(data.url, data.mimeType);
        } else {
          // Should not happen due to the .refine() on the schema
          return fail("Exactly one of url or base64 must be provided");
        }

        // Check size cap
        if (buffer.length > UPLOAD_MAX_BYTES) {
          return fail(
            `File size ${buffer.length} exceeds maximum ${UPLOAD_MAX_BYTES} bytes`,
          );
        }

        // Upload bytes directly to R2
        const file = await fileService.uploadBytes(
          userId,
          {
            filename: data.filename,
            mimeType: data.mimeType,
            sizeBytes: buffer.length,
          },
          buffer,
          data.entryId,
        );

        // Enqueue extraction
        const { jobId } = await extractionQueueService.enqueue(
          userId,
          file.id,
        );

        return ok({
          fileId: file.id,
          contextEntryId: file.contextEntryId ?? null,
          status: "UPLOADED",
          extractionEnqueued: true,
          extractionJobId: jobId,
          sizeBytes: Number(file.sizeBytes),
        });
      }

      case "get_file_content": {
        const { fileId } = getFileContentToolSchema.parse(args);

        const file = await fileService.getFile(userId, fileId);
        if (!file) {
          return fail("File not found");
        }

        // Trim extracted text to cap (silent trim for v1)
        let extractedText = file.extractedText;
        if (extractedText && extractedText.length > MAX_EXTRACTED_TEXT_CHARS) {
          extractedText = extractedText.slice(0, MAX_EXTRACTED_TEXT_CHARS);
        }

        return ok({
          fileId: file.id,
          status: file.status,
          extractionStatus: file.extractionStatus,
          extractedText,
          pageCount: file.pageCount,
          filename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: Number(file.sizeBytes),
          extractedAt: file.extractedAt?.toISOString() ?? null,
          error: file.extractionError,
        });
      }

      case "list_files_by_type": {
        const { mimeTypePrefix, limit, offset } =
          listFilesByTypeToolSchema.parse(args);

        const { files, total } = await fileService.listFiles(userId, {
          mimeTypePrefix: mimeTypePrefix ?? undefined,
          limit: limit ?? 50,
          offset: offset ?? 0,
        });

        return ok({
          files: files.map((f) => ({
            fileId: f.id,
            filename: f.filename,
            mimeType: f.mimeType,
            sizeBytes: Number(f.sizeBytes),
            extractionStatus: f.extractionStatus,
            contextEntryId: f.contextEntryId ?? null,
            createdAt: f.createdAt.toISOString(),
          })),
          total,
        });
      }

      default:
        return fail(`Unknown file tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(`Validation error: ${JSON.stringify(error.issues)}`);
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}
