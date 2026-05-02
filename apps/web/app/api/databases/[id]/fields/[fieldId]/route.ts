import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseFieldService } from "@/lib/services/database-field-service";
import { updateDatabaseFieldSchema } from "@/lib/validations";

/**
 * PATCH /api/databases/[id]/fields/[fieldId]
 *
 * Update a field's metadata (name, config, position).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { fieldId } = await params;
    const body = await request.json();
    const data = updateDatabaseFieldSchema.parse(body);
    const result = await databaseFieldService.update(auth.userId, fieldId, data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/databases/[id]/fields/[fieldId]
 *
 * Delete a field and strip its values from every row. Refuses if the field
 * is the primary (returns 400).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { fieldId } = await params;
    const result = await databaseFieldService.delete(auth.userId, fieldId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
