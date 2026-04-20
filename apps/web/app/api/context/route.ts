import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextService } from "@/lib/services/context-service";
import { createContextSchema, contextFiltersSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const rawFilters: Record<string, string | null> = {};
    if (searchParams.has("categoryId")) rawFilters.categoryId = searchParams.get("categoryId");
    if (searchParams.has("tag")) rawFilters.tag = searchParams.get("tag");

    const filters = contextFiltersSchema.parse(rawFilters);
    const entries = await contextService.list(auth.userId, filters);
    return NextResponse.json(entries);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createContextSchema.parse(body);
    const entry = await contextService.create(auth.userId, data);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
