import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { canvasLayoutService } from "@/lib/services/canvas-layout-service";
import { updateCanvasLayoutSchema } from "@/lib/validations";

/**
 * GET /api/canvas/layouts/[id]
 *
 * Returns the full layout including the Excalidraw canvas scene blob
 * and the array of CanvasNode rows for the layout.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const layout = await canvasLayoutService.getById(
      auth.userId,
      auth.workspaceId,
      id,
    );
    if (!layout) {
      return NextResponse.json(
        { error: "Canvas layout not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ layout, nodes: layout.nodes });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/canvas/layouts/[id]
 *
 * Updates a layout. Partial body. Pre-flights canvas blob (2 MiB cap)
 * and viewport (8 KiB cap) before the write.
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
    const input = updateCanvasLayoutSchema.parse(body);
    const layout = await canvasLayoutService.update(
      auth.userId,
      auth.workspaceId,
      id,
      input,
    );
    return NextResponse.json({ layout });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/canvas/layouts/[id]
 *
 * Deletes a layout and CASCADEs all its CanvasNode rows. Refuses
 * if it would leave the user with zero layouts.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    await canvasLayoutService.delete(auth.userId, auth.workspaceId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
