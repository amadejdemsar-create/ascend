import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { extractionQueueService } from "@/lib/services/extraction-queue-service";

/**
 * POST /api/files/extract/run
 *
 * Cron tick endpoint for the extraction worker. Processes a batch of
 * pending extraction jobs (up to 5 jobs or 25 seconds, whichever comes
 * first).
 *
 * Dual-auth (mirrors the pattern in /api/context/map/refresh):
 *   1. x-cron-secret header matching CRON_SECRET env var (timing-safe).
 *   2. User JWT via authenticate() for manual triggers from admin UI.
 *   Either path is sufficient.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  const isCron = verifyCronSecret(request);

  if (!auth.success && !isCron) {
    return unauthorizedResponse();
  }

  try {
    const { processed, results } = await extractionQueueService.processBatch();

    // Map results to summary counts
    let completed = 0;
    let failed = 0;
    let retry = 0;
    for (const r of results) {
      if (!r.processed) continue;
      if (r.status === "COMPLETE") completed++;
      else if (r.status === "FAILED") failed++;
      else if (r.status === "RETRY") retry++;
    }

    return NextResponse.json({ processed, completed, failed, retry });
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
