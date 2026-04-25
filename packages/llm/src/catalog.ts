/**
 * Model catalog: the single source of truth for available models per provider.
 *
 * All model descriptors are derived from MODEL-DECISION.md (verified
 * 25. 4. 2026). The catalog is used by the Settings UI to populate
 * model dropdowns and by the runtime to validate model selections.
 *
 * Stable models are listed first, Preview models after, sorted by tier
 * (cheap, balanced, best) within each status group.
 */

import type { ChatProviderKind, ModelDescriptor, ModelTier } from "./types";

// ── Catalog data ─────────────────────────────────────────────────

const ALL_MODELS: ModelDescriptor[] = [
  // ── Gemini Stable ──────────────────────────────────────────
  {
    id: "gemini-2.5-flash-lite",
    provider: "GEMINI",
    tier: "cheap",
    status: "stable",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    costPer1MInputCents: 10,
    costPer1MOutputCents: 40,
    supportsJsonMode: false,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },
  {
    id: "gemini-2.5-flash",
    provider: "GEMINI",
    tier: "balanced",
    status: "stable",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    costPer1MInputCents: 30,
    costPer1MOutputCents: 250,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },
  {
    id: "gemini-2.5-pro",
    provider: "GEMINI",
    tier: "best",
    status: "stable",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    costPer1MInputCents: 125,
    costPer1MOutputCents: 1000,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },

  // ── Gemini Preview ─────────────────────────────────────────
  {
    id: "gemini-3.1-flash-lite-preview",
    provider: "GEMINI",
    tier: "cheap",
    status: "preview",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    costPer1MInputCents: 25,
    costPer1MOutputCents: 150,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    notes: "Preview: minimum 2-week deprecation notice from Google",
  },
  {
    id: "gemini-3-flash-preview",
    provider: "GEMINI",
    tier: "balanced",
    status: "preview",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    costPer1MInputCents: 50,
    costPer1MOutputCents: 300,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    notes: "Preview: minimum 2-week deprecation notice from Google",
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: "GEMINI",
    tier: "best",
    status: "preview",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    costPer1MInputCents: 200,
    costPer1MOutputCents: 1200,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    notes: "Preview: minimum 2-week deprecation notice from Google",
  },

  // ── OpenAI Stable ──────────────────────────────────────────
  {
    id: "gpt-5.4-nano",
    provider: "OPENAI",
    tier: "cheap",
    status: "stable",
    contextTokens: 400_000,
    maxOutputTokens: 128_000,
    costPer1MInputCents: 20,
    costPer1MOutputCents: 125,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },
  {
    id: "gpt-5.4-mini",
    provider: "OPENAI",
    tier: "balanced",
    status: "stable",
    contextTokens: 400_000,
    maxOutputTokens: 128_000,
    costPer1MInputCents: 75,
    costPer1MOutputCents: 450,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },
  {
    id: "gpt-5.4",
    provider: "OPENAI",
    tier: "best",
    status: "stable",
    contextTokens: 1_000_000,
    maxOutputTokens: 128_000,
    costPer1MInputCents: 250,
    costPer1MOutputCents: 1500,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },

  // ── Anthropic Stable ───────────────────────────────────────
  {
    id: "claude-haiku-4-5",
    provider: "ANTHROPIC",
    tier: "cheap",
    status: "stable",
    contextTokens: 200_000,
    maxOutputTokens: 64_000,
    costPer1MInputCents: 100,
    costPer1MOutputCents: 500,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },
  {
    id: "claude-sonnet-4-6",
    provider: "ANTHROPIC",
    tier: "balanced",
    status: "stable",
    contextTokens: 1_000_000,
    maxOutputTokens: 64_000,
    costPer1MInputCents: 300,
    costPer1MOutputCents: 1500,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },
  {
    id: "claude-opus-4-7",
    provider: "ANTHROPIC",
    tier: "best",
    status: "stable",
    contextTokens: 1_000_000,
    maxOutputTokens: 128_000,
    costPer1MInputCents: 500,
    costPer1MOutputCents: 2500,
    supportsJsonMode: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
  },
];

// ── Tier sort order ──────────────────────────────────────────────

const TIER_ORDER: Record<ModelTier, number> = {
  cheap: 0,
  balanced: 1,
  best: 2,
};

const STATUS_ORDER: Record<string, number> = {
  stable: 0,
  preview: 1,
  experimental: 2,
};

function compareModels(a: ModelDescriptor, b: ModelDescriptor): number {
  // Stable first, then preview, then experimental.
  const statusDiff =
    (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
  if (statusDiff !== 0) return statusDiff;
  // Within the same status group, sort by tier: cheap, balanced, best.
  return (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
}

// ── Public API ───────────────────────────────────────────────────

/**
 * List all known models for a provider. Stable models appear first,
 * sorted by tier (cheap, balanced, best). Preview models follow.
 */
export function listModels(provider: ChatProviderKind): ModelDescriptor[] {
  return ALL_MODELS.filter((m) => m.provider === provider).sort(compareModels);
}

/**
 * Find a specific model by provider and model ID.
 * Returns undefined if the model is not in the catalog.
 */
export function findModel(
  provider: ChatProviderKind,
  modelId: string,
): ModelDescriptor | undefined {
  return ALL_MODELS.find((m) => m.provider === provider && m.id === modelId);
}

/**
 * Return the default (stable) model ID for a given provider and tier.
 * Always returns a stable model. Throws if no stable model exists
 * for the requested combination.
 */
export function defaultModelForTier(
  provider: ChatProviderKind,
  tier: ModelTier,
): string {
  const model = ALL_MODELS.find(
    (m) => m.provider === provider && m.tier === tier && m.status === "stable",
  );
  if (!model) {
    throw new Error(
      `No stable ${tier} model found for provider ${provider}. ` +
        `Check the model catalog.`,
    );
  }
  return model.id;
}
