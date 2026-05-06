import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { versioningService } from "@/lib/services/versioning-service";

/**
 * GET /api/versions/:id
 *
 * Fetch a single version by ID, including the full payload.
 * Returns 404 if the version does not exist or does not belong to the user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const version = await versioningService.getVersion(auth.userId, auth.workspaceId, id);
    if (!version) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(version);
  } catch (error) {
    return handleApiError(error);
  }
}
