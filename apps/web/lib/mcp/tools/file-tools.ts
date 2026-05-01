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
import dns from "node:dns/promises";

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

/**
 * Check whether an IP address belongs to a private, loopback, or
 * link-local range that should be blocked for SSRF protection.
 *
 * Known limitation: DNS rebinding attacks via short-TTL records are
 * not mitigated here. The hostname is resolved once at validation time;
 * a malicious DNS server could return a public IP first and then switch
 * to a private IP on subsequent queries. Full mitigation would require
 * pinning the resolved IP for the actual fetch, which is not supported
 * by globalThis.fetch. Acceptable risk for an MCP tool that only the
 * authenticated user can invoke.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — extract the embedded
  // IPv4 and recursively check it before falling through to IPv6 logic.
  const normalized = ip.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const embedded = normalized.slice(7); // strip "::ffff:"
    if (embedded.includes(".")) {
      return isPrivateIp(embedded);
    }
  }

  // IPv4 checks
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    const [a, b] = parts;
    // 0.0.0.0/8 — on Linux, 0.x.y.z aliases to 127.x.y.z (loopback)
    if (a === 0) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (RFC 6598 carrier-grade NAT, used by Tailscale / some AWS VPCs)
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
    // 224.0.0.0/4 (multicast)
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 (reserved, includes 255.255.255.255 broadcast)
    if (a >= 240) return true;
    return false;
  }

  // IPv6 checks
  // ::1 (loopback)
  if (normalized === "::1" || normalized === "0000:0000:0000:0000:0000:0000:0000:0001") return true;
  // fc00::/7 (unique local)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // fe80::/10 (link-local) — covers fe80:: through febf::
  // The /10 means the first 10 bits are 1111111010, so the second byte
  // ranges from 80 to bf. Match fe8, fe9, fea, feb prefixes.
  if (/^fe[89ab]/.test(normalized)) return true;

  return false;
}

/**
 * Validate a URL for SSRF safety:
 * 1. Must be https: scheme
 * 2. Hostname must not resolve to a private/loopback IP
 */
async function validateUrlForSsrf(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `Only https: URLs are allowed. Got ${parsed.protocol}`,
    );
  }

  // Resolve the hostname and check all returned addresses
  const hostname = parsed.hostname;

  // Handle IP literal hostnames directly
  if (isPrivateIp(hostname)) {
    throw new Error("URL resolves to a private/loopback address");
  }

  try {
    const result = await dns.lookup(hostname, { all: true });
    for (const entry of result) {
      if (isPrivateIp(entry.address)) {
        throw new Error("URL resolves to a private/loopback address");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("private/loopback")) {
      throw err;
    }
    throw new Error(`DNS resolution failed for ${hostname}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

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
