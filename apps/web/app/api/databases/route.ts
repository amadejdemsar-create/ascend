import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseService } from "@/lib/services/database-service";
import { createDatabaseSchema } from "@/lib/validations";

/**
 * GET /api/databases
 *
 * List all databases for the authenticated user with field/row/view counts.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const result = await databaseService.list(auth.userId, auth.workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/databases
 *
 * Create a new database. Body: { name, parentEntryId? }.
 * Returns the new database with its default fields and views (201).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createDatabaseSchema.parse(body);
    const result = await databaseService.create(auth.userId, auth.workspaceId, data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
