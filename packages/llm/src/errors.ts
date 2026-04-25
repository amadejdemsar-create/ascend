/**
 * Typed error hierarchy for @ascend/llm.
 *
 * All LLM errors extend LlmError so callers can catch the entire family
 * with a single instanceof check. Specific subclasses carry structured
 * metadata (HTTP status, provider, retry hints).
 */

// ── Base ─────────────────────────────────────────────────────────

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

// ── Missing API key ──────────────────────────────────────────────

/**
 * Thrown when a provider is instantiated or called without the required
 * API key. The caller should surface a user-friendly message and guide
 * the user to set the env var.
 */
export class MissingApiKeyError extends LlmError {
  readonly envVar: string;

  constructor(envVar: string) {
    super(
      `Missing API key: the environment variable "${envVar}" is not set. ` +
        `Set it in your deployment environment before using this provider.`,
    );
    this.name = "MissingApiKeyError";
    this.envVar = envVar;
  }
}

// ── Provider HTTP error ──────────────────────────────────────────

/**
 * Thrown when a provider API returns a non-2xx response (excluding 429,
 * which gets its own RateLimitError). Carries the HTTP status and the
 * raw response body for debugging.
 */
export class ProviderHttpError extends LlmError {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(status: number, responseBody: unknown, message?: string) {
    const msg =
      message ??
      `Provider returned HTTP ${status}: ${typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)}`;
    super(msg);
    this.name = "ProviderHttpError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

// ── Rate limit (429) ─────────────────────────────────────────────

/**
 * Thrown on HTTP 429. The retry helper catches this and backs off.
 * If retryAfterMs is available from the Retry-After header, it is
 * passed through so the retry helper can use it.
 */
export class RateLimitError extends LlmError {
  readonly retryAfterMs: number | undefined;

  constructor(retryAfterMs?: number) {
    super(
      `Rate limited by provider (HTTP 429).` +
        (retryAfterMs != null
          ? ` Retry after ${retryAfterMs}ms.`
          : ` No retry-after hint provided.`),
    );
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// ── Budget exceeded ──────────────────────────────────────────────

/**
 * Thrown when the estimated cost of a request would exceed the user's
 * daily hard cap. The service layer (llmService.requestBudget) throws
 * this before the provider is called so no money is spent.
 */
export class BudgetExceededError extends LlmError {
  readonly currentCostCents: number;
  readonly estimatedCostCents: number;
  readonly hardCapCents: number;

  constructor(
    currentCostCents: number,
    estimatedCostCents: number,
    hardCapCents: number,
  ) {
    super(
      `Budget exceeded: current spend ${currentCostCents} cents + estimated ` +
        `${estimatedCostCents} cents would exceed the hard cap of ` +
        `${hardCapCents} cents. Request blocked.`,
    );
    this.name = "BudgetExceededError";
    this.currentCostCents = currentCostCents;
    this.estimatedCostCents = estimatedCostCents;
    this.hardCapCents = hardCapCents;
  }
}
