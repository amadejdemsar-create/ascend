import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseRelationService } from "@/lib/services/database-relation-service";

/**
 * GET /api/databases/relation-backlinks/[rowEntryId]
 *
 * Returns incoming DATABASE_RELATION links for a row's entry, grouped by
 * source database and field. Used by the DatabaseRelationBacklinks panel.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rowEntryId: string }> },
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { rowEntryId } = await params;
    const backlinks = await databaseRelationService.getBacklinks(
      auth.userId,
      rowEntryId,
    );
    return NextResponse.json(backlinks);
  } catch (error) {
    return handleApiError(error);
  }
}
