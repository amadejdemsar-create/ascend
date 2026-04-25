/**
 * LLM Service.
 *
 * Orchestrates chat provider resolution, budget enforcement (DZ-9),
 * and usage logging. Every code path that calls an @ascend/llm provider
 * method MUST go through this service to enforce cost caps.
 *
 * Provider API keys are read at runtime (inside method calls), NOT at
 * module-init time, so a missing key during build does not crash the app.
 *
 * Follows the const-object service pattern (see goal-service.ts).
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import {
  GeminiChatProvider,
  OpenAIChatProvider,
  AnthropicChatProvider,
  type ChatProvider,
  type ChatProviderKind,
  type ChatInput,
  type ChatResult,
  type ModelTier,
  estimateCostCents,
  defaultModelForTier,
  findModel,
  MissingApiKeyError,
  BudgetExceededError,
  withRetry,
} from "@ascend/llm";

// ── Cost caps (DZ-9) ────────────────────────────────────────────
// These are the single source of truth for daily spend limits.
// Soft cap is informational (logged, returned in budget check).
// Hard cap is enforced: requestBudget throws BudgetExceededError if
// (todaySpent + estimatedCostCents) > HARD_CAP_CENTS_PER_DAY.
const SOFT_CAP_CENTS_PER_DAY = 200; // $2.00
const HARD_CAP_CENTS_PER_DAY = 1000; // $10.00

// ── Env var mapping ─────────────────────────────────────────────

const ENV_KEYS: Record<ChatProviderKind, string> = {
  GEMINI: "GEMINI_API_KEY",
  OPENAI: "OPENAI_API_KEY",
  ANTHROPIC: "ANTHROPIC_API_KEY",
};

// ── Provider factories ──────────────────────────────────────────
// Each factory reads the API key from the environment at call time.

function buildChatProvider(kind: ChatProviderKind): ChatProvider {
  const envVar = ENV_KEYS[kind];
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new MissingApiKeyError(envVar);
  }

  switch (kind) {
    case "GEMINI":
      return new GeminiChatProvider(apiKey);
    case "OPENAI":
      return new OpenAIChatProvider(apiKey);
    case "ANTHROPIC":
      return new AnthropicChatProvider(apiKey);
    default:
      throw new Error(`Unknown provider kind: ${kind as string}`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Get the start-of-day timestamp in UTC for budget window calculations.
 */
function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Get the start of the current UTC week (Monday 00:00).
 */
function startOfWeekUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToSubtract = day === 0 ? 6 : day - 1; // Monday-based week
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysToSubtract,
    ),
  );
}

/**
 * Rough token estimate from character count.
 * Uses the common heuristic of 1 token per 4 characters.
 * Math.ceil so we never underestimate.
 */
function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

// ── Service ─────────────────────────────────────────────────────

export const llmService = {
  /**
   * Look up the user's preferred chat provider + model from UserSettings,
   * resolve the env key, and instantiate the right ChatProvider.
   *
   * Throws MissingApiKeyError if the env var for the chosen provider is unset.
   * Falls back to default tier model if user has no chatModel set.
   * Falls back to GEMINI balanced if no UserSettings row exists.
   */
  async resolveProvider(
    userId: string,
  ): Promise<{
    provider: ChatProvider;
    model: string;
    providerKind: ChatProviderKind;
  }> {
    const settings = await prisma.userSettings.findFirst({
      where: { userId },
      select: { chatProvider: true, chatModel: true },
    });

    const providerKind: ChatProviderKind = settings?.chatProvider ?? "GEMINI";
    let model: string;

    if (settings?.chatModel) {
      // Validate the model is in the catalog
      const descriptor = findModel(providerKind, settings.chatModel);
      if (descriptor) {
        model = settings.chatModel;
      } else {
        // Model not found in catalog; fall back to default and log warning
        console.warn(
          `[llmService] User ${userId} has chatModel="${settings.chatModel}" ` +
            `for provider ${providerKind}, but it is not in the model catalog. ` +
            `Falling back to default balanced model.`,
        );
        model = defaultModelForTier(providerKind, "balanced");
      }
    } else {
      model = defaultModelForTier(providerKind, "balanced");
    }

    const provider = buildChatProvider(providerKind);

    return { provider, model, providerKind };
  },

  /**
   * Budget gate (DZ-9). EVERY provider call path MUST call this before
   * invoking the provider. No bypass.
   *
   * Reads today's LlmUsage rollup and refuses if
   * (todaySpent + estimatedCostCents) > HARD_CAP_CENTS_PER_DAY.
   *
   * Returns { ok: true, todaySpentCents, softCapHit } on success.
   * Throws BudgetExceededError on hard cap violation.
   */
  async requestBudget(
    userId: string,
    estimatedCostCents: number,
  ): Promise<{
    ok: true;
    todaySpentCents: number;
    softCapHit: boolean;
  }> {
    const todayStart = startOfTodayUTC();

    const result = await prisma.llmUsage.aggregate({
      where: {
        userId,
        createdAt: { gte: todayStart },
      },
      _sum: {
        estimatedCostCents: true,
      },
    });

    const todaySpentCents = result._sum.estimatedCostCents ?? 0;
    const projectedTotal = todaySpentCents + estimatedCostCents;

    if (projectedTotal > HARD_CAP_CENTS_PER_DAY) {
      throw new BudgetExceededError(
        todaySpentCents,
        estimatedCostCents,
        HARD_CAP_CENTS_PER_DAY,
      );
    }

    const softCapHit = projectedTotal > SOFT_CAP_CENTS_PER_DAY;

    return { ok: true, todaySpentCents, softCapHit };
  },

  /**
   * End-to-end chat call with full budget enforcement and usage logging.
   *
   * Flow:
   * 1. resolveProvider (reads user prefs, builds provider)
   * 2. Estimate cost (rough heuristic for prompt tokens, maxTokens for completion)
   * 3. requestBudget (DZ-9 gate, throws on hard cap)
   * 4. withRetry(() => provider.chat(input)) (retries on 429 / 5xx)
   * 5. Log LlmUsage row with REAL token counts from ChatResult
   * 6. Return ChatResult
   */
  async chat(
    userId: string,
    input: Omit<ChatInput, "model">,
    opts: { purpose: string; tier?: ModelTier },
  ): Promise<ChatResult> {
    // 1. Resolve provider and model
    const { provider, model, providerKind } =
      await llmService.resolveProvider(userId);

    // If a specific tier was requested and differs from the resolved model's tier,
    // override with the tier-default model
    let resolvedModel = model;
    if (opts.tier) {
      const currentDescriptor = findModel(providerKind, model);
      if (!currentDescriptor || currentDescriptor.tier !== opts.tier) {
        resolvedModel = defaultModelForTier(providerKind, opts.tier);
      }
    }

    // 2. Estimate cost (rough heuristic)
    const messagesText = input.messages.map((m) => m.content).join("");
    const systemText = input.system ?? "";
    const estimatedPromptTokens = estimateTokensFromChars(
      messagesText.length + systemText.length,
    );
    const estimatedCompletionTokens = input.maxTokens ?? 1024;

    const estimated = estimateCostCents({
      provider: providerKind,
      model: resolvedModel,
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
    });

    // 3. Budget gate (DZ-9). This MUST happen before any provider call.
    await llmService.requestBudget(userId, estimated);

    // 4. Call the provider with retry
    const chatInput: ChatInput = {
      ...input,
      model: resolvedModel,
    };

    const result = await withRetry(() => provider.chat(chatInput));

    // 5. Log usage with REAL token counts (not estimates)
    const realCost = estimateCostCents({
      provider: providerKind,
      model: resolvedModel,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });

    await prisma.llmUsage.create({
      data: {
        userId,
        provider: providerKind,
        model: resolvedModel,
        purpose: opts.purpose,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimatedCostCents: realCost,
      },
    });

    // 6. Return result
    return result;
  },

  /**
   * Daily or weekly usage rollup for the settings UI.
   *
   * Returns totals, per-provider breakdown, per-purpose breakdown,
   * and the current cap values for display.
   */
  async usageForUser(
    userId: string,
    window: "day" | "week",
  ): Promise<{
    totalCostCents: number;
    softCapCents: number;
    hardCapCents: number;
    perProvider: Array<{ provider: ChatProviderKind; costCents: number }>;
    perPurpose: Array<{ purpose: string; costCents: number }>;
  }> {
    const windowStart = window === "day" ? startOfTodayUTC() : startOfWeekUTC();

    const whereClause = {
      userId,
      createdAt: { gte: windowStart },
    };

    // Total cost
    const totalAgg = await prisma.llmUsage.aggregate({
      where: whereClause,
      _sum: { estimatedCostCents: true },
    });
    const totalCostCents = totalAgg._sum.estimatedCostCents ?? 0;

    // Per-provider breakdown
    const providerGroups = await prisma.llmUsage.groupBy({
      by: ["provider"],
      where: whereClause,
      _sum: { estimatedCostCents: true },
    });
    const perProvider = providerGroups.map((g) => ({
      provider: g.provider,
      costCents: g._sum.estimatedCostCents ?? 0,
    }));

    // Per-purpose breakdown
    const purposeGroups = await prisma.llmUsage.groupBy({
      by: ["purpose"],
      where: whereClause,
      _sum: { estimatedCostCents: true },
    });
    const perPurpose = purposeGroups.map((g) => ({
      purpose: g.purpose,
      costCents: g._sum.estimatedCostCents ?? 0,
    }));

    return {
      totalCostCents,
      softCapCents: SOFT_CAP_CENTS_PER_DAY,
      hardCapCents: HARD_CAP_CENTS_PER_DAY,
      perProvider,
      perPurpose,
    };
  },

  /**
   * Provider availability check (read-only, no provider call, no DB).
   * Returns whether each provider's API key is set in the environment.
   */
  listProviderAvailability(): Array<{
    kind: ChatProviderKind;
    available: boolean;
  }> {
    const kinds: ChatProviderKind[] = ["GEMINI", "OPENAI", "ANTHROPIC"];
    return kinds.map((kind) => ({
      kind,
      available: !!process.env[ENV_KEYS[kind]],
    }));
  },
};
