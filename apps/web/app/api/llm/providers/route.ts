import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { llmService } from "@/lib/services/llm-service";
import { listModels } from "@ascend/llm";
import type { ChatProviderKind } from "@ascend/llm";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const availability = llmService.listProviderAvailability();

    const providers = availability.map((entry) => ({
      kind: entry.kind,
      available: entry.available,
      models: listModels(entry.kind as ChatProviderKind),
    }));

    return NextResponse.json({ providers });
  } catch (error) {
    return handleApiError(error);
  }
}
