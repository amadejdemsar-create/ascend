import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { fileService } from "@/lib/services/file-service";

/**
 * GET /api/files/[id]/status
 *
 * Returns extraction status and core metadata for a file. Used for
 * polling extraction progress and rendering file blocks in the editor.
 *
 * Wave 4 Phase 5 extended the response to include filename, mimeType,
 * sizeBytes, and extractedText so the file block component can render
 * without a second round-trip.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;

    // userId-scoped ownership check (Safety Rule 1)
    const file = await fileService.getFile(auth.userId, id);
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
      status: file.status,
      extractionStatus: file.extractionStatus,
      extractedAt: file.extractedAt?.toISOString() ?? null,
      extractionError: file.extractionError ?? null,
      extractedText: file.extractedText ?? null,
      pageCount: file.pageCount ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
