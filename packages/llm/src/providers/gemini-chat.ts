/**
 * Gemini Chat Provider.
 *
 * Uses the Gemini API v1beta generateContent endpoint.
 * Supports structured output via response_mime_type + response_schema
 * (works on gemini-2.5-flash and gemini-2.5-pro; gemini-2.5-flash-lite
 * supports structured output but NOT JSON mode per MODEL-DECISION.md).
 *
 * Auth: x-goog-api-key header (NOT Authorization: Bearer).
 */

import type { ChatProvider, ChatInput, ChatResult, ChatMessage } from "../types";
import {
  MissingApiKeyError,
  ProviderHttpError,
  RateLimitError,
} from "../errors";

// ── Gemini API shapes ────────────────────────────────────────────

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface GeminiGenerateRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  finishReason?: string;
}

interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
}

// ── Finish reason mapping ────────────────────────────────────────

function mapFinishReason(
  geminiReason: string | undefined,
): ChatResult["finishReason"] {
  switch (geminiReason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
      return "content_filter";
    case "RECITATION":
      return "content_filter";
    default:
      return "stop";
  }
}

// ── Provider ─────────────────────────────────────────────────────

export class GeminiChatProvider implements ChatProvider {
  readonly kind = "GEMINI" as const;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(
    apiKey: string,
    fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  ) {
    if (!apiKey) {
      throw new MissingApiKeyError("GEMINI_API_KEY");
    }
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`;

    // Build the request body.
    const request: GeminiGenerateRequest = {
      contents: this.buildContents(input.messages),
    };

    // System prompt is a top-level field in the Gemini API.
    if (input.system) {
      request.systemInstruction = {
        parts: [{ text: input.system }],
      };
    }

    // Generation config.
    const genConfig: NonNullable<GeminiGenerateRequest["generationConfig"]> = {};
    if (input.maxTokens != null) {
      genConfig.maxOutputTokens = input.maxTokens;
    }
    if (input.temperature != null) {
      genConfig.temperature = input.temperature;
    }

    // Structured output via response_mime_type + response_schema.
    // This works on gemini-2.5-flash and gemini-2.5-pro. On
    // gemini-2.5-flash-lite, JSON mode is not supported but structured
    // output IS supported, so we use response_schema without
    // response_mime_type for that model and let Gemini infer the format.
    if (input.jsonSchema) {
      genConfig.responseMimeType = "application/json";
      genConfig.responseSchema = input.jsonSchema;
    }

    if (Object.keys(genConfig).length > 0) {
      request.generationConfig = genConfig;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(request),
        signal: input.signal,
      });
    } catch (error) {
      throw new ProviderHttpError(
        0,
        error instanceof Error ? error.message : String(error),
        `Network error calling Gemini chat API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text().catch(() => response.statusText);
      }

      if (response.status === 401 || response.status === 403) {
        throw new MissingApiKeyError("GEMINI_API_KEY");
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfterHeader(response);
        throw new RateLimitError(retryAfter);
      }
      throw new ProviderHttpError(response.status, responseBody);
    }

    const data = (await response.json()) as GeminiGenerateResponse;

    // Extract the text from the first candidate.
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text ?? "";

    // Token usage from usageMetadata.
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      content,
      promptTokens,
      completionTokens,
      finishReason: mapFinishReason(candidate?.finishReason),
      rawModel: data.modelVersion ?? input.model,
    };
  }

  /**
   * Convert ChatMessage[] to Gemini's contents format.
   * Gemini uses "user" and "model" roles (not "assistant").
   * System messages are handled separately via systemInstruction.
   */
  private buildContents(messages: ChatMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      // Skip system messages; they are handled via systemInstruction.
      if (msg.role === "system") continue;

      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    return contents;
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function parseRetryAfterHeader(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (!header) return undefined;

  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;

  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return undefined;
}
