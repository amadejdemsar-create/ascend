/**
 * Gemini Embedding Provider.
 *
 * Uses the Gemini API v1beta embedContent endpoint with gemini-embedding-2.
 * Supports text embedding with configurable output dimensionality (default 1536).
 *
 * gemini-embedding-2 uses inline prompt-based task prefixes (e.g.,
 * "task: search result | query: {content}") instead of the task_type parameter
 * used by the older gemini-embedding-001. If the caller provides a taskType,
 * it is prepended to the text; otherwise the raw text is sent as-is.
 *
 * Auth: x-goog-api-key header (NOT Authorization: Bearer).
 */

import type { EmbeddingProvider, EmbeddingInput, EmbeddingResult } from "../types";
import {
  MissingApiKeyError,
  ProviderHttpError,
  RateLimitError,
} from "../errors";

// ── Gemini API response shapes ───────────────────────────────────

interface GeminiEmbedResponse {
  embedding?: {
    values?: number[];
  };
  usageMetadata?: {
    totalTokenCount?: number;
  };
}

// ── Provider ─────────────────────────────────────────────────────

export class GeminiEmbeddingProvider implements EmbeddingProvider {
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

  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    const model = input.model; // "gemini-embedding-2"
    const dimensionality = input.outputDimensionality ?? 1536;

    // Build the text content. If a taskType prefix is provided, prepend it
    // using the gemini-embedding-2 inline format.
    let textContent = input.text ?? "";
    if (input.taskType) {
      textContent = `${input.taskType}: ${textContent}`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;

    const body = {
      content: {
        parts: [{ text: textContent }],
      },
      outputDimensionality: dimensionality,
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: input.signal,
      });
    } catch (error) {
      // Network errors (DNS failure, timeout, etc.)
      throw new ProviderHttpError(
        0,
        error instanceof Error ? error.message : String(error),
        `Network error calling Gemini embedding API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Handle error status codes.
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

    // Parse the success response.
    const data = (await response.json()) as GeminiEmbedResponse;

    const embedding = data.embedding?.values;
    if (!embedding || !Array.isArray(embedding)) {
      throw new ProviderHttpError(
        200,
        data,
        "Gemini embedding response missing embedding.values array",
      );
    }

    // Token usage. The Gemini API may not always return usageMetadata for
    // embeddings. If missing, estimate from text length using a rough
    // approximation of 1 token per 4 characters. This is documented as a
    // fallback and should be replaced with actual counts when available.
    const promptTokens =
      data.usageMetadata?.totalTokenCount ??
      Math.ceil(textContent.length / 4);

    return {
      embedding,
      promptTokens,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Parse the Retry-After header into milliseconds.
 * Handles both delta-seconds ("60") and HTTP-date formats.
 * Returns undefined if the header is missing or unparseable.
 */
function parseRetryAfterHeader(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (!header) return undefined;

  // Try as integer seconds first.
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;

  // Try as HTTP-date.
  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return undefined;
}
