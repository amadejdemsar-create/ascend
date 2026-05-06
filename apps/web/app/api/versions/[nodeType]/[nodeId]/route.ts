import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { versioningService } from "@/lib/services/versioning-service";
import { listVersionsQuerySchema, nodeTypeEnum } from "@/lib/validations";

/**
 * GET /api/versions/:nodeType/:nodeId
 *
 * List versions for a specific node, paginated via cursor.
 * Returns versions in reverse chronological order (newest first).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeType: string; nodeId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { nodeType, nodeId } = await params;
    const parsedNodeType = nodeTypeEnum.parse(nodeType);
    const { searchParams } = new URL(request.url);
    const opts = listVersionsQuerySchema.parse(
      Object.fromEntries(searchParams),
    );
    const result = await versioningService.listVersions(
      auth.userId,
      auth.workspaceId,
      parsedNodeType,
      nodeId,
      opts,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
