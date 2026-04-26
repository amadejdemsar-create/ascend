import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextMapService } from "@/lib/services/context-map-service";
import { BudgetExceededError, MissingApiKeyError } from "@ascend/llm";

/**
 * POST /api/context/map/refresh
 *
 * Dual-auth path:
 *   1. User JWT (via authenticate()) with 30-minute cooldown enforced.
 *   2. x-cron-secret header matching CRON_SECRET env var, bypasses cooldown.
 *      The cron path still goes through llmService.chat which enforces the
 *      daily cost cap (DZ-9). No cost bypass.
 *
 * The cron secret comparison uses crypto.timingSafeEqual to prevent timing
 * side-channel attacks.
 */
export async function POST(request: NextRequest) {
  // ── Attempt dual auth ──────────────────────────────────────────

  const auth = await authenticate(request);
  const isCron = verifyCronSecret(request);

  if (!auth.success && !isCron) {
    return unauthorizedResponse();
  }

  // For the cron path, we need a userId. Since ContextMap has userId @unique,
  // the cron job operates on ALL users who have context entries. For the MVP
  // single-user deployment, look up the first user with context entries.
  // In the multi-user future, the cron job would iterate all users or accept
  // userId as a body param.
  let userId: string;
  if (auth.success) {
    userId = auth.userId;
  } else {
    // Cron path: find the first user who has context entries.
    // Uses the service layer (safety rule 4: no direct Prisma in routes).
    const { userService } = await import("@/lib/services/user-service");
    const firstUser = await userService.findFirstWithContextEntries();
    if (!firstUser) {
      return NextResponse.json(
        { error: "No users with context entries found" },
        { status: 400 },
      );
    }
    userId = firstUser.id;
  }

  try {
    // User-initiated refresh: enforce cooldown
    if (auth.success && !isCron) {
      const cooldownCheck = await contextMapService.canRefresh(userId);
      if (!cooldownCheck.ok) {
        return NextResponse.json(
          {
            error: cooldownCheck.reason,
            retryAfterSec: cooldownCheck.retryAfterSec,
            nextAllowedAt: cooldownCheck.nextAllowedAt?.toISOString(),
          },
          {
            status: 429,
            headers: cooldownCheck.retryAfterSec
              ? { "Retry-After": String(cooldownCheck.retryAfterSec) }
              : undefined,
          },
        );
      }
    }

    // Both paths: refresh goes through llmService.chat which enforces
    // cost cap (DZ-9). No bypass regardless of auth path.
    const map = await contextMapService.refresh(userId);
    return NextResponse.json(map);
  } catch (error) {
    // Surface BudgetExceededError as 429 with structured info
    if (error instanceof BudgetExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          currentCostCents: error.currentCostCents,
          estimatedCostCents: error.estimatedCostCents,
          hardCapCents: error.hardCapCents,
        },
        { status: 429 },
      );
    }

    // Surface MissingApiKeyError as 400 with clear guidance
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error: `Chat provider API key not configured: ${error.envVar}. ` +
            `Set the environment variable in your deployment settings.`,
        },
        { status: 400 },
      );
    }

    return handleApiError(error);
  }
}

// ── Cron secret verification ─────────────────────────────────────

/**
 * Verify the x-cron-secret header against CRON_SECRET env var.
 * Uses timing-safe comparison to prevent side-channel attacks.
 * Returns false if CRON_SECRET is not set or header is missing.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const headerValue = request.headers.get("x-cron-secret");
  if (!headerValue) return false;

  // Encode to buffers for timing-safe comparison
  const expected = Buffer.from(cronSecret, "utf-8");
  const received = Buffer.from(headerValue, "utf-8");

  // timingSafeEqual throws if buffers have different lengths,
  // so check length first (length itself leaks, but the actual
  // content does not, which is the standard approach)
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(expected, received);
}
