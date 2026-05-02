import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseViewService } from "@/lib/services/database-view-service";
import { createDatabaseViewSchema } from "@/lib/validations";

/**
 * POST /api/databases/[id]/views
 *
 * Create a new view for a database. Body: { name, type, config? }.
 * Returns the new view (201).
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
    const data = createDatabaseViewSchema.parse(body);
    const result = await databaseViewService.create(
      auth.userId,
      databaseId,
      data,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
