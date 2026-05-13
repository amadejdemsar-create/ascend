import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { workspaceMembershipService } from "@/lib/services/workspace-membership-service";

/**
 * GET /api/workspaces/[id]/members
 *
 * Lists all members of a workspace with their display name, email,
 * role, status, and join date. The authenticated user must be an
 * active member of the workspace (enforced by the auth context
 * workspace match check).
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

    const members = await workspaceMembershipService.listMembers(workspaceId);

    return NextResponse.json(members);
  } catch (error) {
    return handleApiError(error);
  }
}
