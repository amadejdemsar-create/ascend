/**
 * @ascend/llm type definitions.
 *
 * Interfaces for the embedding and chat provider abstraction layer.
 * All types are platform-agnostic: no DOM, no Node, no React dependencies.
 */

// Re-use the canonical ChatProviderKind from @ascend/core to stay in sync
// with the Prisma enum and Zod schemas.
import type { ChatProviderKind as CoreChatProviderKind } from "@ascend/core";

// ── Re-export for convenience ────────────────────────────────────

export type ChatProviderKind = CoreChatProviderKind;

// ── Model metadata ───────────────────────────────────────────────

export type ModelTier = "cheap" | "balanced" | "best";
export type ModelStatus = "stable" | "preview" | "experimental";

export interface ModelDescriptor {
  id: string;
  provider: ChatProviderKind;
  tier: ModelTier;
  status: ModelStatus;
  contextTokens: number;
  maxOutputTokens: number;
  costPer1MInputCents: number;
  costPer1MOutputCents: number;
  supportsJsonMode: boolean;
  supportsStructuredOutput: boolean;
  supportsFunctionCalling: boolean;
  notes?: string;
}

// ── Chat types ───────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatInput {
  model: string;
  system?: string;
  messages: ChatMessage[];
  /** When set, providers should request structured output matching this schema. */
  jsonSchema?: unknown;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: "stop" | "length" | "content_filter" | "error";
  /** The actual model id the API returned; may differ from input.model for aliases. */
  rawModel: string;
}

// ── Embedding types ──────────────────────────────────────────────

export interface EmbeddingInput {
  model: "gemini-embedding-2";
  text?: string;
  // future: image / audio / video / pdf parts (Wave 4)
  /** Truncated embedding dimensionality. Default 1536. */
  outputDimensionality?: number;
  /**
   * gemini-embedding-2 uses inline prompt-based task prefixes instead of a
   * task_type parameter. Pass through if explicitly set.
   */
  taskType?: string;
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  /** The embedding vector. Length equals outputDimensionality. */
  embedding: number[];
  promptTokens: number;
}

// ── Provider interfaces ──────────────────────────────────────────

export interface EmbeddingProvider {
  readonly kind: "GEMINI";
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
}

export interface ChatProvider {
  readonly kind: ChatProviderKind;
  chat(input: ChatInput): Promise<ChatResult>;
}
