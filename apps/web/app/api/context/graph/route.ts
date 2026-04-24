import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextGraphFiltersSchema } from "@/lib/validations";
import { contextService } from "@/lib/services/context-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const filters = contextGraphFiltersSchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const graph = await contextService.getGraph(auth.userId, filters);
    return NextResponse.json(graph);
  } catch (error) {
    return handleApiError(error);
  }
}
