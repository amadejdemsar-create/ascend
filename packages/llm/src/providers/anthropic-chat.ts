/**
 * Anthropic Chat Provider.
 *
 * Uses the Anthropic Messages API at https://api.anthropic.com/v1/messages.
 * Auth: x-api-key header + anthropic-version header.
 *
 * Structured output notes:
 * Anthropic does not have a native JSON mode. To get structured output
 * matching a caller-provided jsonSchema, this provider uses the tool-use
 * approach: it defines a single tool named "respond" with the target schema
 * as input_schema, forces the model to call it via tool_choice, and extracts
 * the structured input from the tool_use content block.
 *
 * Model-specific notes from MODEL-DECISION.md:
 *   claude-haiku-4-5: supports extended thinking, NOT adaptive thinking
 *   claude-sonnet-4-6: supports both extended and adaptive thinking
 *   claude-opus-4-7: supports adaptive thinking, NOT extended thinking
 * This provider does not pass thinking parameters unless future ChatInput
 * extensions add them.
 */

import type { ChatProvider, ChatInput, ChatResult, ChatMessage } from "../types";
import {
  MissingApiKeyError,
  ProviderHttpError,
  RateLimitError,
} from "../errors";

// ── Anthropic API shapes ─────────────────────────────────────────

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: unknown;
}

interface AnthropicRequest {
  model: string;
  system?: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  tools?: AnthropicTool[];
  tool_choice?: { type: "tool"; name: string };
}

interface AnthropicContentBlockText {
  type: "text";
  text: string;
}

interface AnthropicContentBlockToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

type AnthropicContentBlock =
  | AnthropicContentBlockText
  | AnthropicContentBlockToolUse;

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  stop_reason?: string;
  model?: string;
}

// ── Finish reason mapping ────────────────────────────────────────

function mapFinishReason(
  anthropicReason: string | undefined,
): ChatResult["finishReason"] {
  switch (anthropicReason) {
    case "end_turn":
      return "stop";
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "stop"; // tool_use is expected when using structured output
    case "max_tokens":
      return "length";
    default:
      return "stop";
  }
}

// ── Default max tokens ───────────────────────────────────────────

/**
 * Anthropic requires max_tokens to be set explicitly.
 * Default to 4096 if not provided, which is sufficient for most
 * Ascend use cases (tagging, linking, summarization).
 */
const DEFAULT_MAX_TOKENS = 4096;

// ── Provider ─────────────────────────────────────────────────────

export class AnthropicChatProvider implements ChatProvider {
  readonly kind = "ANTHROPIC" as const;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(
    apiKey: string,
    fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  ) {
    if (!apiKey) {
      throw new MissingApiKeyError("ANTHROPIC_API_KEY");
    }
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const url = "https://api.anthropic.com/v1/messages";

    // Build messages. Anthropic does not support a "system" role in messages;
    // system is a separate top-level field.
    const messages: AnthropicMessage[] = [];
    for (const msg of input.messages) {
      if (msg.role === "system") continue; // handled via top-level system field
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    const request: AnthropicRequest = {
      model: input.model,
      messages,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    // System prompt is a top-level field in the Anthropic API.
    if (input.system) {
      request.system = input.system;
    }

    if (input.temperature != null) {
      request.temperature = input.temperature;
    }

    // Structured output via tool-use approach.
    // Anthropic does not have a native JSON mode. We define a single tool
    // with the target schema as input_schema and force the model to call it
    // via tool_choice: { type: "tool", name: "respond" }. The structured
    // data is then extracted from the tool_use content block's input field.
    const useToolForJson = input.jsonSchema != null;
    if (useToolForJson) {
      request.tools = [
        {
          name: "respond",
          description:
            "Return the structured response matching the required schema.",
          input_schema: input.jsonSchema,
        },
      ];
      request.tool_choice = { type: "tool", name: "respond" };
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(request),
        signal: input.signal,
      });
    } catch (error) {
      throw new ProviderHttpError(
        0,
        error instanceof Error ? error.message : String(error),
        `Network error calling Anthropic chat API: ${error instanceof Error ? error.message : String(error)}`,
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
        throw new MissingApiKeyError("ANTHROPIC_API_KEY");
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfterHeader(response);
        throw new RateLimitError(retryAfter);
      }
      throw new ProviderHttpError(response.status, responseBody);
    }

    const data = (await response.json()) as AnthropicResponse;

    // Extract content. If we used tool-use for structured output, extract
    // the tool input as JSON. Otherwise, extract the text block.
    let content: string;
    if (useToolForJson) {
      const toolBlock = data.content?.find(
        (block): block is AnthropicContentBlockToolUse =>
          block.type === "tool_use",
      );
      content = toolBlock
        ? JSON.stringify(toolBlock.input)
        : "";
    } else {
      const textBlock = data.content?.find(
        (block): block is AnthropicContentBlockText => block.type === "text",
      );
      content = textBlock?.text ?? "";
    }

    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;

    return {
      content,
      promptTokens,
      completionTokens,
      finishReason: mapFinishReason(data.stop_reason),
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
