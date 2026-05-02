import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseService } from "@/lib/services/database-service";
import { updateDatabaseSchema } from "@/lib/validations";

/**
 * GET /api/databases/[id]
 *
 * Fetch a single database by ID with fields, views, and context entry.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await databaseService.getById(auth.userId, id);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/databases/[id]
 *
 * Update a database: rename (name) or change the default view (defaultViewId).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateDatabaseSchema.parse(body);
    const result = await databaseService.update(auth.userId, id, data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/databases/[id]
 *
 * Delete a database and cascade all fields, rows, views, and context links.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await databaseService.delete(auth.userId, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
