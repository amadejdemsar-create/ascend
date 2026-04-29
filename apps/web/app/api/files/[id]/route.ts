import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { fileService } from "@/lib/services/file-service";

/**
 * GET /api/files/[id]
 *
 * Download a file. Behavior depends on MIME type:
 *
 * - image/svg+xml: streams bytes server-side with hardened security headers
 *   (Content-Disposition: attachment, X-Content-Type-Options: nosniff) to
 *   prevent inline rendering and XSS via embedded scripts. See the SVG
 *   security note in packages/core/src/schemas/files.ts.
 *
 * - All other MIME types: returns a short-lived presigned GET URL (5-min
 *   expiry) that the client can use to download directly from R2.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;

    // Ownership check (userId-scoped, Safety Rule 1)
    const file = await fileService.getFile(auth.userId, id);
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // SVG: stream bytes with hardened headers (option c from security note)
    if (file.mimeType === "image/svg+xml") {
      const result = await fileService.streamFile(auth.userId, id);

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
      id,
    );

    return NextResponse.json({ url, expiresAt });
  } catch (error) {
    return handleApiError(error);
  }
}
