import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { branchService } from "@/lib/services/branch-service";
import { branchNodeBodySchema } from "@/lib/validations";

/**
 * POST /api/versions/branch
 *
 * Branch (fork) a node from a specific historical version.
 * Creates a new entity populated from the version's payload and links it
 * back to the source via a DERIVED_FROM edge.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { versionId, title } = branchNodeBodySchema.parse(body);
    const result = await branchService.branch(auth.userId, auth.workspaceId, versionId, title);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
