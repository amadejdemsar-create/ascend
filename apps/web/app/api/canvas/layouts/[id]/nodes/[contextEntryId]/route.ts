import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { canvasNodeService } from "@/lib/services/canvas-node-service";

/**
 * DELETE /api/canvas/layouts/[id]/nodes/[contextEntryId]
 *
 * Convenience single-remove. Functionally equivalent to
 * POST /api/canvas/layouts/[id]/nodes with `{ upsert: [], remove: [contextEntryId] }`.
 * Idempotent: removing a non-existent card returns 204 too.
 */
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; contextEntryId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: layoutId, contextEntryId } = await params;
    await canvasNodeService.removeFromLayout(
      auth.userId,
      auth.workspaceId,
      layoutId,
      contextEntryId,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
