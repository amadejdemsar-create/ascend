import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseService } from "@/lib/services/database-service";

/**
 * GET /api/databases/by-entry/[entryId]
 *
 * Fetch a database by its backing ContextEntry ID. Used when opening a
 * DATABASE entry in the detail panel (we have the entry ID, not the database ID).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { entryId } = await params;
    const result = await databaseService.getByEntryId(auth.userId, auth.workspaceId, entryId);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
