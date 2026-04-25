/**
 * Per-model pricing tables for all supported LLM providers.
 *
 * All prices are in **integer cents per 1 million tokens** to avoid
 * floating-point arithmetic in cost calculations.
 *
 * Every entry sources its values from MODEL-DECISION.md. Conversion:
 * $0.10 per 1M tokens = 10 cents; $1.25 = 125 cents; $10.00 = 1000 cents.
 *
 * The table key is `${provider}:${modelId}` for O(1) lookup.
 */

import type { ChatProviderKind } from "./types";

// ── Types ────────────────────────────────────────────────────────

export interface ModelPricing {
  provider: ChatProviderKind;
  model: string;
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
}

export interface EmbeddingPricing {
  model: string;
  inputCentsPerMillion: number;
}

// ── Chat pricing table ───────────────────────────────────────────

export const PRICING_TABLE: Record<string, ModelPricing> = {
  // ── Gemini Stable ───────────────────────────────────────────
  // last verified 25. 4. 2026 — source: https://ai.google.dev/gemini-api/docs/pricing
  "GEMINI:gemini-2.5-flash-lite": {
    provider: "GEMINI",
    model: "gemini-2.5-flash-lite",
    inputCentsPerMillion: 10, // $0.10
    outputCentsPerMillion: 40, // $0.40
  },
  // last verified 25. 4. 2026 — source: https://ai.google.dev/gemini-api/docs/pricing
  "GEMINI:gemini-2.5-flash": {
    provider: "GEMINI",
    model: "gemini-2.5-flash",
    inputCentsPerMillion: 30, // $0.30
    outputCentsPerMillion: 250, // $2.50
  },
  // last verified 25. 4. 2026 — source: https://ai.google.dev/gemini-api/docs/pricing
  "GEMINI:gemini-2.5-pro": {
    provider: "GEMINI",
    model: "gemini-2.5-pro",
    inputCentsPerMillion: 125, // $1.25
    outputCentsPerMillion: 1000, // $10.00
  },

  // ── Gemini Preview ──────────────────────────────────────────
  // last verified 25. 4. 2026 — source: https://ai.google.dev/gemini-api/docs/pricing
  "GEMINI:gemini-3.1-flash-lite-preview": {
    provider: "GEMINI",
    model: "gemini-3.1-flash-lite-preview",
    inputCentsPerMillion: 25, // $0.25
    outputCentsPerMillion: 150, // $1.50
  },
  // last verified 25. 4. 2026 — source: https://ai.google.dev/gemini-api/docs/pricing
  "GEMINI:gemini-3-flash-preview": {
    provider: "GEMINI",
    model: "gemini-3-flash-preview",
    inputCentsPerMillion: 50, // $0.50
    outputCentsPerMillion: 300, // $3.00
  },
  // last verified 25. 4. 2026 — source: https://ai.google.dev/gemini-api/docs/pricing
  "GEMINI:gemini-3.1-pro-preview": {
    provider: "GEMINI",
    model: "gemini-3.1-pro-preview",
    inputCentsPerMillion: 200, // $2.00
    outputCentsPerMillion: 1200, // $12.00
  },

  // ── OpenAI Stable ──────────────────────────────────────────
  // last verified 25. 4. 2026 — source: https://openai.com/api/pricing/
  "OPENAI:gpt-5.4-nano": {
    provider: "OPENAI",
    model: "gpt-5.4-nano",
    inputCentsPerMillion: 20, // $0.20
    outputCentsPerMillion: 125, // $1.25
  },
  // last verified 25. 4. 2026 — source: https://openai.com/api/pricing/
  "OPENAI:gpt-5.4-mini": {
    provider: "OPENAI",
    model: "gpt-5.4-mini",
    inputCentsPerMillion: 75, // $0.75
    outputCentsPerMillion: 450, // $4.50
  },
  // last verified 25. 4. 2026 — source: https://openai.com/api/pricing/
  "OPENAI:gpt-5.4": {
    provider: "OPENAI",
    model: "gpt-5.4",
    inputCentsPerMillion: 250, // $2.50
    outputCentsPerMillion: 1500, // $15.00
  },

  // ── Anthropic Stable ───────────────────────────────────────
  // last verified 25. 4. 2026 — source: https://claude.com/pricing
  "ANTHROPIC:claude-haiku-4-5": {
    provider: "ANTHROPIC",
    model: "claude-haiku-4-5",
    inputCentsPerMillion: 100, // $1.00
    outputCentsPerMillion: 500, // $5.00
  },
  // last verified 25. 4. 2026 — source: https://claude.com/pricing
  "ANTHROPIC:claude-sonnet-4-6": {
    provider: "ANTHROPIC",
    model: "claude-sonnet-4-6",
    inputCentsPerMillion: 300, // $3.00
    outputCentsPerMillion: 1500, // $15.00
  },
  // last verified 25. 4. 2026 — source: https://claude.com/pricing
  "ANTHROPIC:claude-opus-4-7": {
    provider: "ANTHROPIC",
    model: "claude-opus-4-7",
    inputCentsPerMillion: 500, // $5.00
    outputCentsPerMillion: 2500, // $25.00
  },
};

// ── Embedding pricing ────────────────────────────────────────────

// last verified 25. 4. 2026 — source: https://ai.google.dev/gemini-api/docs/pricing
export const EMBEDDING_PRICING: EmbeddingPricing = {
  model: "gemini-embedding-2",
  inputCentsPerMillion: 20, // $0.20
};
