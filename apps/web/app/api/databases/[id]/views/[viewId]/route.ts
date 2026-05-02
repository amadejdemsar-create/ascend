import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseViewService } from "@/lib/services/database-view-service";
import { updateDatabaseViewSchema } from "@/lib/validations";

/**
 * PATCH /api/databases/[id]/views/[viewId]
 *
 * Update a view's name, config, or position.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { viewId } = await params;
    const body = await request.json();
    const data = updateDatabaseViewSchema.parse(body);
    const result = await databaseViewService.update(auth.userId, viewId, data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/databases/[id]/views/[viewId]
 *
 * Delete a view. Fails if it is the default view (set a new default first).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { viewId } = await params;
    const result = await databaseViewService.delete(auth.userId, viewId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
