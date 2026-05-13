import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { workspaceService } from "@/lib/services/workspace-service";
import { updateWorkspaceSchema } from "@/lib/validations";

/**
 * GET /api/workspaces/[id]
 *
 * Returns a single workspace by ID. The user must be an active member.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: workspaceId } = await params;

    // Defense in depth: verify the route param matches the auth context.
    if (workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspace = await workspaceService.getById(
      workspaceId,
      auth.userId,
    );
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(workspace);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/workspaces/[id]
 *
 * Updates a workspace's name or slug. OWNER only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: workspaceId } = await params;

    // Defense in depth: verify the route param matches the auth context.
    if (workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const input = updateWorkspaceSchema.parse(body);

    const updated = await workspaceService.update(
      auth.userId,
      workspaceId,
      input,
    );

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/workspaces/[id]
 *
 * Workspace deletion is disabled in Wave 8 (single workspace per user).
 * The route surface exists for Wave 8b. Returns 403 unconditionally.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  // Consume params to avoid Next.js warnings about unused dynamic params
  await params;

  return NextResponse.json(
    { error: "Workspace deletion is not yet available." },
    { status: 403 },
  );
}
