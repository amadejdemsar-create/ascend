import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { confirmUploadSchema } from "@/lib/validations";
import { fileService } from "@/lib/services/file-service";
import { extractionQueueService } from "@/lib/services/extraction-queue-service";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const input = confirmUploadSchema.parse(body);
    const file = await fileService.confirmUpload(
      auth.userId,
      auth.workspaceId,
      input.fileId,
      input.sha256,
    );

    // Enqueue extraction after confirming the upload. If enqueue fails
    // (e.g., daily cap reached), the upload is already confirmed and
    // usable; we just report that extraction was not enqueued.
    let extractionEnqueued = true;
    let extractionReason: string | undefined;
    try {
      await extractionQueueService.enqueue(auth.userId, auth.workspaceId, file.id);
    } catch (err) {
      extractionEnqueued = false;
      extractionReason =
        err instanceof Error ? err.message : "Extraction enqueue failed";
      console.warn(
        `[files/confirm] Extraction enqueue failed for file ${file.id}:`,
        extractionReason,
      );
    }

    return NextResponse.json({
      file: fileService.serializeFile(file),
      extractionEnqueued,
      ...(extractionReason && { extractionReason }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
