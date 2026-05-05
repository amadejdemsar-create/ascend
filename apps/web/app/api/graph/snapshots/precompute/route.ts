import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { graphSnapshotService } from "@/lib/services/graph-snapshot-service";

/**
 * POST /api/graph/snapshots/precompute
 *
 * Cron-only endpoint (authenticated via x-cron-secret header).
 * Precomputes the daily graph snapshot for yesterday for all users.
 * Materializes nodes (from latest NodeVersion per ContextEntry) and
 * edges (from EdgeEvent replay) into GraphDailySnapshot rows.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await graphSnapshotService.precomputeAllForYesterday();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron] graph snapshot precompute failed:", error);
    return NextResponse.json(
      { error: "Snapshot precompute failed" },
      { status: 500 },
    );
  }
}
