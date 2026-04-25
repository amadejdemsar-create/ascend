/**
 * @ascend/llm
 *
 * Platform-agnostic LLM abstraction layer for the Ascend ecosystem.
 * Provides embedding and chat provider interfaces with implementations
 * for Gemini, OpenAI, and Anthropic. Includes pricing tables, cost
 * estimation, retry helpers, and a model catalog.
 *
 * No React, no Next.js, no Prisma, no DOM dependencies.
 * Uses globalThis.fetch for HTTP (available in Node 18+, browsers, React Native).
 */

// ── Interfaces and types ─────────────────────────────────────────

export type {
  EmbeddingProvider,
  ChatProvider,
  ChatProviderKind,
  ChatInput,
  ChatMessage,
  ChatResult,
  EmbeddingInput,
  EmbeddingResult,
  ModelDescriptor,
  ModelTier,
  ModelStatus,
} from "./types";

// ── Providers ────────────────────────────────────────────────────

export { GeminiEmbeddingProvider } from "./providers/gemini-embedding";
export { GeminiChatProvider } from "./providers/gemini-chat";
export { OpenAIChatProvider } from "./providers/openai-chat";
export { AnthropicChatProvider } from "./providers/anthropic-chat";

// ── Helpers ──────────────────────────────────────────────────────

export { estimateCostCents, estimateEmbeddingCostCents } from "./cost";
export { listModels, findModel, defaultModelForTier } from "./catalog";
export { withRetry } from "./retry";

// ── Errors ───────────────────────────────────────────────────────

export {
  LlmError,
  MissingApiKeyError,
  ProviderHttpError,
  RateLimitError,
  BudgetExceededError,
} from "./errors";

// ── Pricing ──────────────────────────────────────────────────────

export { PRICING_TABLE, EMBEDDING_PRICING } from "./pricing";
export type { ModelPricing, EmbeddingPricing } from "./pricing";
