import { NextRequest, NextResponse } from "next/server";
import { authenticate, verifyCronSecret, unauthorizedResponse, handleApiError } from "@/lib/auth";
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

