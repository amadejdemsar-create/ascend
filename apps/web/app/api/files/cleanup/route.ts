import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret, handleApiError } from "@/lib/auth";
import { fileService } from "@/lib/services/file-service";

/**
 * POST /api/files/cleanup
 *
 * Cron-only endpoint (no user JWT path; this is destructive system
 * maintenance). Deletes File rows stuck in PENDING status for > 24 hours
 * along with their R2 objects.
 *
 * These are uploads that were presigned but never confirmed (client
 * abandoned the upload or the network request failed).
 */
export async function POST(request: NextRequest) {
  const isCron = verifyCronSecret(request);
  if (!isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deleted } = await fileService.cleanupOrphanPending();
    return NextResponse.json({ deleted });
  } catch (error) {
    return handleApiError(error);
  }
}

