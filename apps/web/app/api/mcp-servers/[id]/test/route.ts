import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { mcpFederationService } from "@/lib/services/mcp-federation-service";

/**
 * POST /api/mcp-servers/[id]/test
 *
 * Calls the upstream `initialize` + `tools/list` to verify the
 * connection is healthy. On success: refreshes the tool cache and
 * returns `{ healthy: true, toolCount }`. On failure: persists the
 * error message on the connection row and returns `{ healthy: false,
 * error }`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await mcpFederationService.testConnection(
      auth.userId,
      auth.workspaceId,
      id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
