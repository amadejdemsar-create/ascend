import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { llmService } from "@/lib/services/llm-service";
import { llmChatRequestSchema } from "@/lib/validations";

/**
 * POST /api/llm/chat
 *
 * General-purpose chat endpoint for in-app LLM usage. Primary consumer
 * is the AIBlock in the Lexical block editor (Phase 6). All calls go
 * through llmService.chat which enforces budget caps (DZ-9).
 *
 * Returns the full response (no streaming for Wave 3). Wave 8
 * collaboration may add SSE streaming.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = llmChatRequestSchema.parse(body);

    const result = await llmService.chat(
      auth.userId,
      {
        system: data.system,
        messages: data.messages,
        maxTokens: data.maxTokens,
      },
      { purpose: data.purpose },
    );

    return NextResponse.json({
      content: result.content,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      finishReason: result.finishReason,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
