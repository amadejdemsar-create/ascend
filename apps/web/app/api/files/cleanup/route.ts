import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { handleApiError } from "@/lib/auth";
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

// ── Cron secret verification ─────────────────────────────────────

/**
 * Verify the x-cron-secret header against CRON_SECRET env var.
 * Uses timing-safe comparison to prevent side-channel attacks.
 * Returns false if CRON_SECRET is not set or header is missing.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const headerValue = request.headers.get("x-cron-secret");
  if (!headerValue) return false;

  // Encode to buffers for timing-safe comparison
  const expected = Buffer.from(cronSecret, "utf-8");
  const received = Buffer.from(headerValue, "utf-8");

  // timingSafeEqual throws if buffers have different lengths,
  // so check length first (length itself leaks, but the actual
  // content does not, which is the standard approach)
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(expected, received);
}
