import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { fileService } from "@/lib/services/file-service";

/**
 * GET /api/files/[id]
 *
 * Download a file. Behavior depends on MIME type and Accept header:
 *
 * - image/svg+xml: always streams bytes server-side with hardened security
 *   headers (Content-Disposition: attachment, X-Content-Type-Options: nosniff)
 *   to prevent inline rendering and XSS via embedded scripts. See the SVG
 *   security note in packages/core/src/schemas/files.ts.
 *
 * - Binary redirect (Phase 5 amendment): when the Accept header indicates the
 *   caller wants media bytes (image/*, audio/*, video/*, or *​/* without
 *   application/json), returns a 302 redirect to the presigned R2 URL. This
 *   allows <img src>, <audio src>, and <video src> to point directly at this
 *   route. Excludes SVG (handled above) for security.
 *
 * - Default (JSON): returns a short-lived presigned GET URL (5-min expiry)
 *   as JSON `{ url, expiresAt }`. Used by the FileCard download flow and
 *   any client that explicitly requests application/json.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;

    // Ownership check (userId + workspaceId scoped, Safety Rule 1)
    const file = await fileService.getFile(auth.userId, auth.workspaceId, id);
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // SVG: stream bytes with hardened headers (option c from security note)
    if (file.mimeType === "image/svg+xml") {
      const result = await fileService.streamFile(auth.userId, auth.workspaceId, id);

      return new Response(result.stream, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": "attachment",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=300",
          ...(result.sizeBytes > 0 && {
            "Content-Length": String(result.sizeBytes),
          }),
        },
      });
    }

    // All other types: presigned download URL (5-min expiry)
    const { url, expiresAt } = await fileService.createDownloadUrl(
      auth.userId,
      auth.workspaceId,
      id,
    );

    // Binary redirect: when the caller wants media bytes (e.g. <img src>,
    // <audio src>, <video src>), redirect to the presigned R2 URL instead
    // of returning JSON. This avoids a client round-trip for URL resolution.
    const accept = request.headers.get("accept") ?? "";
    const wantsBinary =
      !accept.includes("application/json") &&
      (accept.includes("image/") ||
        accept.includes("audio/") ||
        accept.includes("video/") ||
        accept.includes("*/*"));

    if (wantsBinary) {
      return NextResponse.redirect(url, { status: 302 });
    }

    return NextResponse.json({ url, expiresAt });
  } catch (error) {
    return handleApiError(error);
  }
}
