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
  RateLimitError,
  ProviderHttpError,
  withRetry,
} from "@ascend/llm";

// ── Cost caps (DZ-9) ────────────────────────────────────────────
// These are the single source of truth for daily spend limits.
// Soft cap is informational (logged, returned in budget check).
// Hard cap is enforced: requestBudget throws BudgetExceededError if
// (todaySpent + estimatedCostCents) > HARD_CAP_CENTS_PER_DAY.
const SOFT_CAP_CENTS_PER_DAY = 200; // $2.00
const HARD_CAP_CENTS_PER_DAY = 1000; // $10.00

/** Default Gemini model for vision/image captioning. */
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

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
   * The daily cost cap is per-USER, not per-workspace. The user pays the
   * LLM bill regardless of which workspace triggered the call. workspaceId
   * is NOT used for budget enforcement; it is recorded on LlmUsage rows
   * for analytics only.
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
    workspaceId: string,
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
        workspaceId,
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
    workspaceId: string,
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

  // ── Transcription (Wave 4) ────────────────────────────────────
  //
  // Transcription lives in llmService (web-only) rather than being
  // extracted to @ascend/llm because:
  //   1. Only OpenAI Whisper is supported (no multi-provider abstraction needed)
  //   2. The endpoint uses multipart/form-data with Blob (not JSON chat)
  //   3. @ascend/llm is currently chat + embedding only
  // The architect agent should not flag this as a cross-platform violation.

  /**
   * Transcribe audio using OpenAI Whisper (whisper-1).
   *
   * Flow mirrors llmService.chat:
   *   1. Estimate cost from buffer size (assume ~1 MB/min compressed audio)
   *   2. requestBudget (DZ-9 gate, throws on hard cap)
   *   3. withRetry(() => POST multipart to /v1/audio/transcriptions)
   *   4. Log LlmUsage row with actual cost based on returned duration
   *   5. Return transcript text + duration + cost
   *
   * Always uses OpenAI regardless of user's chatProvider preference.
   * If OPENAI_API_KEY is missing, throws immediately.
   *
   * @param userId Owner of the file (for budget and usage tracking).
   * @param audioBuffer Raw audio file content (MP3, WAV, etc.).
   * @param mimeType MIME type of the audio (e.g., "audio/mpeg").
   * @param opts.signal AbortSignal for cancellation.
   * @param opts.model Override the transcription model (default "whisper-1").
   */
  async transcribe(
    userId: string,
    workspaceId: string,
    audioBuffer: Buffer,
    mimeType: string,
    opts?: { signal?: AbortSignal; model?: string },
  ): Promise<{
    text: string;
    durationSec: number;
    estimatedCostCents: number;
  }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new MissingApiKeyError("OPENAI_API_KEY");
    }

    const model = opts?.model ?? "whisper-1";

    // 1. Pre-estimate cost from buffer size.
    // whisper-1 costs $0.006/minute = 0.6 cents/minute.
    // Assume ~1 MB per minute for compressed audio (conservative).
    const estimatedMinutes = Math.max(
      1,
      Math.ceil(audioBuffer.length / (1024 * 1024)),
    );
    const estimatedCostCents = Math.ceil(estimatedMinutes * 0.6);

    // 2. Budget gate (DZ-9). MUST happen before the API call.
    await llmService.requestBudget(userId, estimatedCostCents);

    // 3. Build multipart/form-data request.
    // Using globalThis.fetch + FormData + Blob to stay platform-agnostic
    // (consistent with @ascend/llm patterns).
    const formData = new FormData();

    // Resolve file extension from MIME type for the filename hint
    const ext = mimeExtensionMap[mimeType] ?? "mp3";
    // Copy into a fresh ArrayBuffer to satisfy Blob's BlobPart type.
    // Buffer.buffer is ArrayBufferLike which TS 5.9 rejects for Blob.
    const ab = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([ab], { type: mimeType });
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", model);
    // verbose_json returns duration and segment-level metadata
    formData.append("response_format", "verbose_json");

    // 4. Call OpenAI with retry (retries on 429/5xx, never on 4xx)
    const result = await withRetry(
      async () => {
        const response = await globalThis.fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
            signal: opts?.signal,
          },
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          if (response.status === 429) {
            // Parse Retry-After header if present
            const retryAfterHeader = response.headers.get("Retry-After");
            const retryAfterMs = retryAfterHeader
              ? parseInt(retryAfterHeader, 10) * 1000
              : undefined;
            throw new RateLimitError(
              retryAfterMs != null && !isNaN(retryAfterMs)
                ? retryAfterMs
                : undefined,
            );
          }
          if (response.status >= 500) {
            throw new ProviderHttpError(response.status, errorBody);
          }
          // 4xx errors (except 429) are not retryable
          throw new ProviderHttpError(response.status, errorBody);
        }

        return response.json() as Promise<WhisperVerboseResponse>;
      },
      { maxRetries: 3, signal: opts?.signal },
    );

    const durationSec = result.duration ?? 0;
    const text = result.text ?? "";

    // 5. Compute actual cost from real duration
    const actualMinutes = Math.max(1, Math.ceil(durationSec / 60));
    const actualCostCents = Math.ceil(actualMinutes * 0.6);

    // 6. Log usage to LlmUsage
    await prisma.llmUsage.create({
      data: {
        userId,
        workspaceId,
        provider: "OPENAI",
        model,
        purpose: "transcribe",
        // Whisper does not report token counts; use 0 for both
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostCents: actualCostCents,
      },
    });

    return {
      text,
      durationSec,
      estimatedCostCents: actualCostCents,
    };
  },

  // ── Image Captioning (Wave 4) ─────────────────────────────────
  //
  // Direct Gemini Vision API call because @ascend/llm ChatMessage.content
  // is string-only (no multimodal content parts). Budget and usage are
  // handled here in the service layer, keeping Prisma imports confined
  // to lib/services/ (Safety Rule 4).

  /**
   * Caption an image using Gemini Vision.
   *
   * Sends the raw image bytes as inlineData to Gemini's generateContent
   * endpoint with a structured prompt that returns CAPTION + TAGS.
   *
   * @param userId Owner of the file (for budget and usage tracking).
   * @param imageBuffer Raw image file content.
   * @param mimeType Image MIME type (e.g., "image/png", "image/jpeg").
   * @param opts.signal AbortSignal for cancellation.
   * @param opts.model Override the vision model (default DEFAULT_VISION_MODEL).
   */
  async captionImage(
    userId: string,
    workspaceId: string,
    imageBuffer: Buffer,
    mimeType: string,
    opts?: { signal?: AbortSignal; model?: string },
  ): Promise<{
    caption: string;
    tags: string[];
    promptTokens: number;
    completionTokens: number;
  }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new MissingApiKeyError("GEMINI_API_KEY");
    }

    const visionModel = opts?.model ?? DEFAULT_VISION_MODEL;

    // Estimate cost. Gemini charges ~258 tokens per image tile.
    // A single image is roughly 258 prompt tokens + our text prompt (~50 tokens).
    const estimatedCost = estimateCostCents({
      provider: "GEMINI",
      model: visionModel,
      promptTokens: 500,
      completionTokens: 150,
    });

    // DZ-9 budget gate
    await llmService.requestBudget(userId, estimatedCost);

    const base64Data = imageBuffer.toString("base64");

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text:
                "Caption this image in 1 to 2 sentences and produce 3 to 7 " +
                "comma-separated tags. Format exactly as:\n" +
                "CAPTION: <text>\nTAGS: a, b, c",
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.3,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent`;

    const result = await withRetry(
      async () => {
        const response = await globalThis.fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: opts?.signal,
        });

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => response.statusText);
          if (response.status === 429) {
            throw new RateLimitError();
          }
          throw new ProviderHttpError(response.status, errorText);
        }

        return response.json() as Promise<GeminiVisionResponse>;
      },
      { maxRetries: 3, signal: opts?.signal },
    );

    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const promptTokens = result.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = result.usageMetadata?.candidatesTokenCount ?? 0;

    // Log actual usage
    const realCost = estimateCostCents({
      provider: "GEMINI",
      model: visionModel,
      promptTokens,
      completionTokens,
    });

    await prisma.llmUsage.create({
      data: {
        userId,
        workspaceId,
        provider: "GEMINI",
        model: visionModel,
        purpose: "image_extraction",
        promptTokens,
        completionTokens,
        estimatedCostCents: realCost,
      },
    });

    // Parse structured response
    const { caption, tags } = parseVisionResponse(rawText);

    return { caption, tags, promptTokens, completionTokens };
  },
};

// ── Whisper types ───────────────────────────────────────────────

interface WhisperVerboseResponse {
  text?: string;
  duration?: number;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

// ── Gemini Vision types ─────────────────────────────────────────

interface GeminiVisionResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

// ── MIME to file extension map (for Whisper file hint) ──────────

const mimeExtensionMap: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/webm": "webm",
  "audio/aac": "aac",
};

// ── Vision response parser ──────────────────────────────────────

function parseVisionResponse(raw: string): {
  caption: string;
  tags: string[];
} {
  const captionMatch = raw.match(/CAPTION:\s*(.+?)(?:\n|$)/i);
  const tagsMatch = raw.match(/TAGS:\s*(.+?)(?:\n|$)/i);

  const caption = captionMatch?.[1]?.trim() ?? raw.trim();
  const tags = tagsMatch?.[1]
    ? tagsMatch[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return { caption, tags };
}
