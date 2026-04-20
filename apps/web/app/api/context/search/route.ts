import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextService } from "@/lib/services/context-service";
import { contextSearchSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    const parsed = contextSearchSchema.parse({ q });
    const results = await contextService.search(auth.userId, parsed.q);
    return NextResponse.json(results);
  } catch (error) {
    return handleApiError(error);
  }
}
