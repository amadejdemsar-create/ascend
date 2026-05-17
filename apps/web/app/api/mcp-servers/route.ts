import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { mcpFederationService } from "@/lib/services/mcp-federation-service";
import { createMcpConnectionSchema } from "@/lib/validations";

/**
 * GET /api/mcp-servers
 *
 * Lists the authenticated user's MCP server connections in the current
 * workspace. Newest-updated first. Public shape: NEVER returns
 * encryptedCredentials.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const connections = await mcpFederationService.list(
      auth.userId,
      auth.workspaceId,
    );
    return NextResponse.json({ connections });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/mcp-servers
 *
 * Create a new MCP server connection. Encrypts credentials at rest
 * via secretsService. Auto-derives slug from name if not provided.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createMcpConnectionSchema.parse(body);
    const connection = await mcpFederationService.create(
      auth.userId,
      auth.workspaceId,
      data,
    );
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
