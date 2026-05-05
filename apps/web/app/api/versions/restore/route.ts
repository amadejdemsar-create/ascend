import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { restoreService } from "@/lib/services/restore-service";
import { restoreVersionBodySchema } from "@/lib/validations";

/**
 * POST /api/versions/restore
 *
 * Restore a node to a historical version. If dryRun is true, returns the
 * payload that would be applied without actually mutating.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { versionId, dryRun } = restoreVersionBodySchema.parse(body);
    const result = await restoreService.restore(
      auth.userId,
      versionId,
      dryRun ?? false,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
