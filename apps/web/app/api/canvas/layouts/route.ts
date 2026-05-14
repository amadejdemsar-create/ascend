import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { canvasLayoutService } from "@/lib/services/canvas-layout-service";
import { createCanvasLayoutSchema } from "@/lib/validations";

/**
 * GET /api/canvas/layouts
 *
 * Lists the authenticated user's canvas layouts in the current workspace,
 * newest-updated first. Omits the `canvas` blob; clients fetch
 * GET /api/canvas/layouts/[id] for the full scene.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const layouts = await canvasLayoutService.list(
      auth.userId,
      auth.workspaceId,
    );
    return NextResponse.json({ layouts });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/canvas/layouts
 *
 * Creates a new layout. Auto-derives slug from name if not provided,
 * appending a numeric suffix on collision.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const input = createCanvasLayoutSchema.parse(body);
    const layout = await canvasLayoutService.create(
      auth.userId,
      auth.workspaceId,
      input,
    );
    return NextResponse.json({ layout }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
