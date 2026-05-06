import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { versionBackfillService } from "@/lib/services/version-backfill-service";

/**
 * POST /api/versions/backfill
 *
 * Cron-only endpoint (authenticated via x-cron-secret header).
 * Runs the Wave 7 version backfill across all users: creates v1
 * NodeVersion snapshots for existing entities and CREATED EdgeEvents
 * for existing ContextLinks.
 *
 * Idempotent: safe to call multiple times. Entities with existing
 * versions are skipped.
 *
 * Usage:
 *   curl -X POST https://ascend.nativeai.agency/api/versions/backfill \
 *     -H "x-cron-secret: $CRON_SECRET"
 */
export const maxDuration = 300; // 5 minutes headroom

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await versionBackfillService.backfillAllUsers();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron] version backfill failed:", error);
    return NextResponse.json(
      { error: "Backfill failed" },
      { status: 500 },
    );
  }
}
