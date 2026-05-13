import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { workspaceService } from "@/lib/services/workspace-service";
import { createWorkspaceSchema } from "@/lib/validations";

/**
 * GET /api/workspaces
 *
 * Lists all workspaces the authenticated user belongs to.
 * In Wave 8, every user has exactly one personal workspace.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const workspaces = await workspaceService.listForUser(auth.userId);
    return NextResponse.json(workspaces);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/workspaces
 *
 * Creates a new workspace. The route surface exists for Wave 8b
 * multi-workspace support, but is intentionally disabled in Wave 8
 * (single workspace per user). The body is validated through Zod so
 * the contract is exercised, but a 403 is returned before calling
 * the service.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    // Validate the body even though we refuse the action. This ensures
    // the Zod contract is exercised and Wave 8b can remove the 403 gate
    // without needing to re-test validation.
    createWorkspaceSchema.parse(body);

    return NextResponse.json(
      { error: "Creating additional workspaces is not yet available." },
      { status: 403 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
