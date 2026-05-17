import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { externalDataService } from "@/lib/services/external-data-service";
import { externalDataQuerySchema } from "@/lib/validations";

/**
 * POST /api/external-data/sources/[id]/query
 *
 * Body: { shape, filter?, sort?, cursor?, perPage? }.
 * Returns: { rows, nextCursor, totalCount?, rateLimited? }.
 *
 * POST not GET so filter/sort payloads can be larger than URL query
 * limits. Cached for 5 minutes per (user, workspace, source, shape,
 * filter, sort, cursor, perPage) tuple via the process-local LRU.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const input = externalDataQuerySchema.parse(body);
    const result = await externalDataService.query(
      auth.userId,
      auth.workspaceId,
      id,
      input,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
