import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { retentionCompactorService } from "@/lib/services/retention-compactor-service";

/**
 * POST /api/versions/compact
 *
 * Cron-only endpoint (authenticated via x-cron-secret header).
 * Runs the tiered retention compactor across all users:
 * - Last 30 days: keep all versions
 * - Days 31 to 60: keep 1 per UTC day
 * - Older than 60 days: keep 1 per ISO week
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await retentionCompactorService.compactAllUsers();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron] retention compactor failed:", error);
    return NextResponse.json(
      { error: "Compactor failed" },
      { status: 500 },
    );
  }
}
