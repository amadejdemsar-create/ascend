import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { reExtractSchema } from "@/lib/validations";
import { fileService } from "@/lib/services/file-service";
import { extractionQueueService } from "@/lib/services/extraction-queue-service";

/**
 * POST /api/files/[id]/extract
 *
 * Re-enqueue a file for extraction. Resets an existing FAILED job or
 * creates a new one. Rejects if the file has not been uploaded yet (still
 * in PENDING upload status).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;

    // Safety Rule 2: parse body through Zod (empty object, but consistent)
    const body = await request.json().catch(() => ({}));
    reExtractSchema.parse(body);

    // userId-scoped ownership check (Safety Rule 1)
    const file = await fileService.getFile(auth.userId, id);
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Reject if the file upload itself is not confirmed yet
    if (file.status !== "UPLOADED") {
      return NextResponse.json(
        { error: "File not uploaded yet" },
        { status: 400 },
      );
    }

    const { jobId, scheduledAt } = await extractionQueueService.enqueue(
      auth.userId,
      id,
    );

    return NextResponse.json({
      jobId,
      scheduledAt: scheduledAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
