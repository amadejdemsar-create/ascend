import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { externalDataService } from "@/lib/services/external-data-service";
import { createExternalSourceSchema } from "@/lib/validations";

/**
 * GET /api/external-data/sources
 *
 * List the user's external data sources in the current workspace.
 * Public shape (no credentials).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const sources = await externalDataService.list(
      auth.userId,
      auth.workspaceId,
    );
    return NextResponse.json({ sources });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/external-data/sources
 *
 * Create a source + paired ContextEntry of type EXTERNAL_DATABASE in
 * one transaction. PAT is encrypted at rest.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createExternalSourceSchema.parse(body);
    const source = await externalDataService.create(
      auth.userId,
      auth.workspaceId,
      data,
    );
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
