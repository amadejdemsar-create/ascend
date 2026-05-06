import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseRowService } from "@/lib/services/database-row-service";

/**
 * GET /api/databases/row-by-entry/[entryId]
 *
 * Lightweight endpoint that returns a database row's metadata by its backing
 * ContextEntry ID. Used by the DatabaseRowProperties panel to self-bootstrap
 * without the parent needing to know the databaseId ahead of time.
 *
 * Returns: { databaseId, databaseName, databaseEntryId, rowId, properties, fields }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { entryId } = await params;

    const row = await databaseRowService.getByEntryId(auth.userId, auth.workspaceId, entryId);

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json({
      databaseId: row.databaseId,
      databaseName: row.database.contextEntry.title,
      databaseEntryId: row.database.contextEntry.id,
      rowId: row.id,
      properties: row.properties as Record<string, unknown>,
      fields: row.database.fields.map((f) => ({
        id: f.id,
        databaseId: f.databaseId,
        name: f.name,
        type: f.type,
        config: f.config,
        isPrimary: f.isPrimary,
        position: f.position,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
