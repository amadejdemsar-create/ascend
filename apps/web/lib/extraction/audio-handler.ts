/**
 * Audio extraction handler.
 *
 * Delegates to `llmService.transcribe` which wraps OpenAI Whisper.
 * Returns the transcribed text and audio duration.
 *
 * Throws if OPENAI_API_KEY is missing (the caller, extraction-service,
 * catches and records the error on the ExtractionJob).
 */

import type { ExtractionResult, ExtractionHandlerOpts } from "./types";
import { llmService } from "@/lib/services/llm-service";

export async function extractAudio(
  buffer: Buffer,
  mimeType: string,
  opts?: ExtractionHandlerOpts,
): Promise<ExtractionResult> {
  const userId = opts?.userId;
  const workspaceId = opts?.workspaceId;
  if (!userId || !workspaceId) {
    throw new Error("Audio extraction requires userId and workspaceId for cost tracking");
  }

  const result = await llmService.transcribe(userId, workspaceId, buffer, mimeType, {
    signal: opts?.signal,
  });

  return {
    text: result.text,
    durationSec: result.durationSec,
  };
}
