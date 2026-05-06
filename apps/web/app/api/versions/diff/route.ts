import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { diffService } from "@/lib/services/diff-service";
import { diffVersionsBodySchema } from "@/lib/validations";

/**
 * POST /api/versions/diff
 *
 * Diff two versions of the same node, or diff a version against the
 * current live state (pass fromVersionId: null).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { fromVersionId, toVersionId } = diffVersionsBodySchema.parse(body);
    const result = await diffService.diffVersions(
      auth.userId,
      auth.workspaceId,
      fromVersionId,
      toVersionId,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
