/**
 * Image extraction handler.
 *
 * Delegates to `llmService.captionImage` which calls the Gemini Vision API
 * directly (the @ascend/llm ChatMessage.content field is `string` only and
 * does not support multimodal content parts). The service handles budget
 * gating (DZ-9) and usage logging.
 *
 * When GEMINI_API_KEY is not set, returns a placeholder result so the
 * extraction job still completes (image captioning is non-critical).
 *
 * TODO (Wave 5+): extend @ascend/llm ChatMessage to support multimodal
 * content parts, then migrate this handler to use llmService.chat.
 */

import type { ExtractionResult, ExtractionHandlerOpts } from "./types";
import { llmService } from "@/lib/services/llm-service";

/** Gemini Vision inlineData practical cap (~20 MiB) */
const IMAGE_CAPTION_MAX_BYTES = 20 * 1024 * 1024;

export async function extractImage(
  buffer: Buffer,
  mimeType: string,
  opts?: ExtractionHandlerOpts,
): Promise<ExtractionResult> {
  const userId = opts?.userId;
  const workspaceId = opts?.workspaceId;
  if (!userId || !workspaceId) {
    return {
      text: "[Image extraction unavailable: userId and workspaceId required]",
    };
  }

  // Guard: Gemini Vision rejects inlineData over ~20 MB.
  // Degrade gracefully rather than sending an oversized payload.
  if (buffer.length > IMAGE_CAPTION_MAX_BYTES) {
    return { text: "[Image too large for vision captioning]", tags: [] };
  }

  try {
    const result = await llmService.captionImage(userId, workspaceId, buffer, mimeType, {
      signal: opts?.signal,
    });
    return {
      text: result.caption,
      tags: result.tags,
    };
  } catch (error) {
    // If the API key is missing or budget exceeded, return a placeholder
    // rather than failing the entire extraction job. Image captioning is
    // a nice-to-have, not a hard requirement.
    if (
      error instanceof Error &&
      (error.message.includes("GEMINI_API_KEY") ||
        error.name === "MissingApiKeyError" ||
        error.name === "BudgetExceededError")
    ) {
      return {
        text: `[Image captioning unavailable: ${error.message}]`,
      };
    }
    throw error;
  }
}
