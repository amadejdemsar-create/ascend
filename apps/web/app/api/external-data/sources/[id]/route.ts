import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { externalDataService } from "@/lib/services/external-data-service";
import { updateExternalSourceSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const source = await externalDataService.getById(
      auth.userId,
      auth.workspaceId,
      id,
    );
    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ source });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateExternalSourceSchema.parse(body);
    const source = await externalDataService.update(
      auth.userId,
      auth.workspaceId,
      id,
      data,
    );
    return NextResponse.json({ source });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    await externalDataService.delete(auth.userId, auth.workspaceId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
