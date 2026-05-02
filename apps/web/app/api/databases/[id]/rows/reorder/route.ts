import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseRowService } from "@/lib/services/database-row-service";
import { reorderDatabaseRowsSchema } from "@/lib/validations";

/**
 * POST /api/databases/[id]/rows/reorder
 *
 * Reorder rows manually within a database.
 * Body: { orderedRowIds: string[] }.
 * Returns the fresh ordered row list.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: databaseId } = await params;
    const body = await request.json();
    const { orderedRowIds } = reorderDatabaseRowsSchema.parse(body);
    const result = await databaseRowService.reorderManual(
      auth.userId,
      databaseId,
      orderedRowIds,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
