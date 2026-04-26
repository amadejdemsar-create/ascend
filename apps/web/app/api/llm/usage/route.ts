import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { llmService } from "@/lib/services/llm-service";
import { llmUsageQuerySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const query = llmUsageQuerySchema.parse({
      window: searchParams.get("window") ?? undefined,
    });

    const usage = await llmService.usageForUser(auth.userId, query.window);
    return NextResponse.json(usage);
  } catch (error) {
    return handleApiError(error);
  }
}
