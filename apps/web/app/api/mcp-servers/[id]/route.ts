import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { mcpFederationService } from "@/lib/services/mcp-federation-service";
import { updateMcpConnectionSchema } from "@/lib/validations";

/**
 * GET /api/mcp-servers/[id]
 *
 * Read one connection. Public shape (no credentials).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const connection = await mcpFederationService.getById(
      auth.userId,
      auth.workspaceId,
      id,
    );
    if (!connection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ connection });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/mcp-servers/[id]
 *
 * Update a connection. If `credentials` is present, re-encrypts. If
 * absent, leaves the stored ciphertext untouched. Setting authType to
 * NONE clears any stored credentials.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateMcpConnectionSchema.parse(body);
    const connection = await mcpFederationService.update(
      auth.userId,
      auth.workspaceId,
      id,
      data,
    );
    return NextResponse.json({ connection });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/mcp-servers/[id]
 *
 * Delete a connection. Cascades to McpServerToolCache.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    await mcpFederationService.delete(auth.userId, auth.workspaceId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
