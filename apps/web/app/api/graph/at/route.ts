import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import {
  graphHistoryService,
  GraphHistoryError,
} from "@/lib/services/graph-history-service";
import { graphAtQuerySchema } from "@/lib/validations";

/**
 * GET /api/graph/at?date=YYYY-MM-DD
 *
 * Returns the context graph as it existed at midnight UTC on the given date.
 * - Today or future: returns the live graph.
 * - Past date with snapshot: returns precomputed snapshot.
 * - Past date without snapshot within 90 days: 404 (not yet computed).
 * - Past date outside 90-day window: 410 (gone, outside retention).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const { date } = graphAtQuerySchema.parse(Object.fromEntries(searchParams));
    const result = await graphHistoryService.getGraphAt(
      auth.userId,
      auth.workspaceId,
      new Date(date),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GraphHistoryError) {
      if (error.code === "NOT_FOUND_404") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "GONE_410") {
        return NextResponse.json({ error: error.message }, { status: 410 });
      }
    }
    return handleApiError(error);
  }
}
