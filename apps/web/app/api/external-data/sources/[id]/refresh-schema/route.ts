import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { externalDataService } from "@/lib/services/external-data-service";

/**
 * POST /api/external-data/sources/[id]/refresh-schema
 *
 * Re-fetches schemas for all shapes the source exposes and caches them
 * into `ExternalDataSource.config.shapeSchemas`. Best-effort: individual
 * shape failures are skipped.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const source = await externalDataService.refreshSchema(
      auth.userId,
      auth.workspaceId,
      id,
    );
    return NextResponse.json({ source });
  } catch (error) {
    return handleApiError(error);
  }
}
