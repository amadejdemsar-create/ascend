/**
 * OpenAI Chat Provider.
 *
 * Uses the OpenAI Chat Completions API at https://api.openai.com/v1/chat/completions.
 * Supports structured output via response_format with json_schema type.
 *
 * Auth: Authorization: Bearer header.
 */

import type { ChatProvider, ChatInput, ChatResult, ChatMessage } from "../types";
import {
  MissingApiKeyError,
  ProviderHttpError,
  RateLimitError,
} from "../errors";

// ── OpenAI API shapes ────────────────────────────────────────────

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      schema: unknown;
      strict: boolean;
    };
  };
}

interface OpenAIChoice {
  message?: {
    content?: string | null;
  };
  finish_reason?: string;
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  model?: string;
}

// ── Finish reason mapping ────────────────────────────────────────

function mapFinishReason(
  openaiReason: string | undefined,
): ChatResult["finishReason"] {
  switch (openaiReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "stop";
  }
}

// ── Provider ─────────────────────────────────────────────────────

export class OpenAIChatProvider implements ChatProvider {
  readonly kind = "OPENAI" as const;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(
    apiKey: string,
    fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  ) {
    if (!apiKey) {
      throw new MissingApiKeyError("OPENAI_API_KEY");
    }
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const url = "https://api.openai.com/v1/chat/completions";

    // Build messages array. System prompt is prepended as a system message.
    const messages: OpenAIMessage[] = [];

    if (input.system) {
      messages.push({ role: "system", content: input.system });
    }

    for (const msg of input.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const request: OpenAIRequest = {
      model: input.model,
      messages,
    };

    if (input.maxTokens != null) {
      request.max_tokens = input.maxTokens;
    }
    if (input.temperature != null) {
      request.temperature = input.temperature;
    }

    // Structured output via json_schema response format.
    if (input.jsonSchema) {
      request.response_format = {
        type: "json_schema",
        json_schema: {
          name: "response",
          schema: input.jsonSchema,
          strict: true,
        },
      };
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: input.signal,
      });
    } catch (error) {
      throw new ProviderHttpError(
        0,
        error instanceof Error ? error.message : String(error),
        `Network error calling OpenAI chat API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text().catch(() => response.statusText);
      }

      if (response.status === 401) {
        throw new MissingApiKeyError("OPENAI_API_KEY");
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfterHeader(response);
        throw new RateLimitError(retryAfter);
      }
      throw new ProviderHttpError(response.status, responseBody);
    }

    const data = (await response.json()) as OpenAIResponse;

    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? "";

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;

    return {
      content,
      promptTokens,
      completionTokens,
      finishReason: mapFinishReason(choice?.finish_reason),
      rawModel: data.model ?? input.model,
    };
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
