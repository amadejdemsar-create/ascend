import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { updateContextLinkSchema, deleteContextLinkQuerySchema } from "@/lib/validations";
import { contextLinkService } from "@/lib/services/context-link-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const input = updateContextLinkSchema.parse(body);
    const link = await contextLinkService.update(auth.userId, id, input);
    return NextResponse.json(link);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const query = deleteContextLinkQuerySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    await contextLinkService.delete(auth.userId, id, { force: query.force });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
