import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextNeighborsQuerySchema } from "@/lib/validations";
import { contextService } from "@/lib/services/context-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const { depth } = contextNeighborsQuerySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const result = await contextService.getNeighbors(auth.userId, id, depth);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
