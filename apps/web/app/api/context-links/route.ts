import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { createContextLinkSchema } from "@/lib/validations";
import { contextLinkService } from "@/lib/services/context-link-service";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const input = createContextLinkSchema.parse(body);
    const link = await contextLinkService.create(auth.userId, input);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const fromEntryId = url.searchParams.get("fromEntryId") ?? undefined;
    const toEntryId = url.searchParams.get("toEntryId") ?? undefined;
    const links = await contextLinkService.list(auth.userId, { fromEntryId, toEntryId });
    return NextResponse.json(links);
  } catch (error) {
    return handleApiError(error);
  }
}
