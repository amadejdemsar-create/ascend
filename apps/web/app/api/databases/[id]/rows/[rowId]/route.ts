import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseRowService } from "@/lib/services/database-row-service";
import { updateDatabaseRowSchema } from "@/lib/validations";

/**
 * PATCH /api/databases/[id]/rows/[rowId]
 *
 * Update a row's properties via a merge patch. Body: { propertiesPatch }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { rowId } = await params;
    const body = await request.json();
    const data = updateDatabaseRowSchema.parse(body);
    const result = await databaseRowService.update(
      auth.userId,
      rowId,
      data.propertiesPatch,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/databases/[id]/rows/[rowId]
 *
 * Delete a row and its backing context entry (cascades to block document).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { rowId } = await params;
    const result = await databaseRowService.delete(auth.userId, rowId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
