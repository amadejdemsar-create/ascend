import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextLinkService } from "@/lib/services/context-link-service";

/**
 * GET /api/context/[id]/derivative-count
 *
 * Returns the number of DERIVED_FROM links pointing TO this entry.
 * Used by BranchDialog for the soft warning (>5 derivatives).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();
  try {
    const { id } = await params;
    const count = await contextLinkService.countDerivatives(auth.userId, auth.workspaceId, id);
    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
