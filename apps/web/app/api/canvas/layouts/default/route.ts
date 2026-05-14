import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { canvasLayoutService } from "@/lib/services/canvas-layout-service";

/**
 * GET /api/canvas/layouts/default
 *
 * Returns the user's default canvas layout, lazily creating a "Personal"
 * layout on first visit. Idempotent under concurrent first-visits.
 *
 * The response matches GET /api/canvas/layouts/[id]: { layout, nodes }.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const layout = await canvasLayoutService.getDefault(
      auth.userId,
      auth.workspaceId,
    );
    return NextResponse.json({ layout, nodes: layout.nodes });
  } catch (error) {
    return handleApiError(error);
  }
}
