import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseFieldService } from "@/lib/services/database-field-service";
import { reorderDatabaseFieldsSchema } from "@/lib/validations";

/**
 * POST /api/databases/[id]/fields/reorder
 *
 * Reorder fields within a database. Body: { orderedFieldIds: string[] }.
 * Returns the fresh ordered field list.
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
    const { orderedFieldIds } = reorderDatabaseFieldsSchema.parse(body);
    const result = await databaseFieldService.reorder(
      auth.userId,
      databaseId,
      orderedFieldIds,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
