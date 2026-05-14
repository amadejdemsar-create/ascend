import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { canvasNodeService } from "@/lib/services/canvas-node-service";
import { upsertCanvasNodesBodySchema } from "@/lib/validations";

/**
 * POST /api/canvas/layouts/[id]/nodes
 *
 * Bulk upsert + bulk remove in one autosave round-trip.
 * Body: { upsert: CanvasNodeInput[], remove: contextEntryId[] }.
 * Each array capped at 500 entries.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: layoutId } = await params;
    const body = await request.json();
    const input = upsertCanvasNodesBodySchema.parse(body);

    const [upsertResult, removeResult] = await Promise.all([
      input.upsert.length > 0
        ? canvasNodeService.bulkUpsert(
            auth.userId,
            auth.workspaceId,
            layoutId,
            input.upsert,
          )
        : Promise.resolve({ inserted: 0, updated: 0 }),
      input.remove.length > 0
        ? canvasNodeService.removeMany(
            auth.userId,
            auth.workspaceId,
            layoutId,
            input.remove,
          )
        : Promise.resolve({ removed: 0 }),
    ]);

    const nodes = await canvasNodeService.listForLayout(
      auth.userId,
      auth.workspaceId,
      layoutId,
    );

    return NextResponse.json({
      nodes,
      inserted: upsertResult.inserted,
      updated: upsertResult.updated,
      removed: removeResult.removed,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
