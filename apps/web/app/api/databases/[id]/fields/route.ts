import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseFieldService } from "@/lib/services/database-field-service";
import { createDatabaseFieldSchema } from "@/lib/validations";

/**
 * POST /api/databases/[id]/fields
 *
 * Add a new field to a database. Body: { name, type, config? }.
 * Returns the new field (201).
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
    const data = createDatabaseFieldSchema.parse(body);
    const result = await databaseFieldService.add(auth.userId, auth.workspaceId, databaseId, data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
