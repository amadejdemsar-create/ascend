import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { fileService } from "@/lib/services/file-service";

/**
 * GET /api/files/[id]/status
 *
 * Returns extraction status for a file. Lightweight endpoint for polling
 * extraction progress from the UI without fetching the full file payload.
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
      status: file.status,
      extractionStatus: file.extractionStatus,
      extractedAt: file.extractedAt?.toISOString() ?? null,
      extractionError: file.extractionError ?? null,
      pageCount: file.pageCount ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
