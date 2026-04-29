/**
 * Extraction Queue Service.
 *
 * Postgres-backed job queue for the file extraction pipeline. Uses
 * SELECT ... FOR UPDATE SKIP LOCKED for concurrency-safe job claiming.
 *
 * The queue is driven by an HTTP cron tick (POST /api/files/extract/run,
 * built in Phase 3) that calls `processBatch()` every 5 minutes. This
 * avoids in-process polling and keeps the architecture stateless.
 *
 * DZ-13 (queue runaway) mitigations:
 *   - maxAttempts=3 per job (schema default, enforced in fail())
 *   - Exponential backoff: scheduledAt = now + 60s * 5^attempts
 *   - Per-user daily cap of EXTRACTION_DAILY_CAP_PER_USER successful extractions
 *
 * Follows the const-object service pattern (see goal-service.ts).
 */

import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client";
import { fileService } from "@/lib/services/file-service";
import { extractionService } from "@/lib/services/extraction-service";
import {
  UnsupportedMimeTypeError,
  ExtractionQuotaExceededError,
  ExtractionTimeoutError,
} from "@/lib/extraction";
import { ProviderHttpError, RateLimitError } from "@ascend/llm";

// ── Error sanitization ─────────────────────────────────────────
//
// Provider error messages can leak API keys, project IDs, and internal
// storage paths. Only the sanitized string is persisted to File.extractionError
// (user-visible). The raw error is logged to the server console for debugging.

function sanitizeExtractionError(error: unknown): string {
  if (error instanceof ProviderHttpError) {
    return `Provider error (HTTP ${error.status}). The extraction will be retried.`;
  }
  if (error instanceof RateLimitError) {
    return "Provider rate limit hit. The extraction will be retried.";
  }
  if (error instanceof UnsupportedMimeTypeError) {
    // Safe: we authored this message and it contains only the MIME type string
    return error.message;
  }
  if (error instanceof ExtractionQuotaExceededError) {
    return "Daily extraction cap reached. Try again tomorrow.";
  }
  if (error instanceof ExtractionTimeoutError) {
    // Timeout messages are safe (just the timeout duration), but truncate as a precaution
    return error.message.slice(0, 500);
  }
  if (error instanceof Error) {
    // Name-based matching for @ascend/llm errors that may not be re-exported
    if (error.name === "MissingApiKeyError") {
      return "Server configuration error: required API key is not set.";
    }
    if (error.name === "BudgetExceededError") {
      return "Daily LLM cost cap reached. Try again tomorrow.";
    }
    // Generic Error: do NOT echo error.message (may contain storage paths, provider details)
    return "Extraction failed. The extraction will be retried.";
  }
  return "Extraction failed.";
}

// ── Constants ───────────────────────────────────────────────────

/**
 * Maximum successful extractions per user per 24-hour window.
 * Conservative cap to prevent runaway extraction costs (DZ-13).
 * Can be tuned later based on observed usage.
 */
const EXTRACTION_DAILY_CAP_PER_USER = 50;

// ── Types ───────────────────────────────────────────────────────

interface ClaimedJob {
  id: string;
  fileId: string;
  attempts: number;
  maxAttempts: number;
}

interface ProcessResult {
  processed: boolean;
  jobId?: string;
  fileId?: string;
  status?: "COMPLETE" | "FAILED" | "RETRY";
}

interface BatchResult {
  processed: number;
  results: ProcessResult[];
}

// ── Service ─────────────────────────────────────────────────────

export const extractionQueueService = {
  /**
   * Enqueue a file for extraction. Creates or resets an ExtractionJob row.
   *
   * The upsert allows re-enqueueing (e.g., "retry" from the UI) to reset
   * a failed job cleanly. File ownership is verified via fileService.getFile
   * (userId-scoped) before touching ExtractionJob.
   *
   * @throws {Error} "Not found" if the file does not exist or belong to the user.
   */
  async enqueue(
    userId: string,
    fileId: string,
  ): Promise<{ jobId: string; scheduledAt: Date }> {
    // Verify file ownership (Safety Rule 1)
    const file = await fileService.getFile(userId, fileId);
    if (!file) throw new Error("Not found");

    const job = await prisma.extractionJob.upsert({
      where: { fileId },
      create: {
        fileId,
        status: "PENDING",
      },
      update: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
      },
    });

    return { jobId: job.id, scheduledAt: job.scheduledAt };
  },

  /**
   * Claim the next PENDING job that is ready to run.
   *
   * Uses SELECT ... FOR UPDATE SKIP LOCKED to safely claim one job
   * without racing with concurrent workers. Wraps the claim in a
   * transaction for atomicity.
   *
   * The ExtractionJob table has no userId column. The userId is derived
   * by joining to File when running the extraction.
   *
   * @returns The claimed job's metadata, or null if no jobs are ready.
   */
  async claimNext(): Promise<ClaimedJob | null> {
    return prisma.$transaction(async (tx) => {
      // Raw SQL for SELECT ... FOR UPDATE SKIP LOCKED (not expressible in Prisma query API)
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          fileId: string;
          attempts: number;
          maxAttempts: number;
        }>
      >(Prisma.sql`
        SELECT "id", "fileId", "attempts", "maxAttempts"
        FROM "ExtractionJob"
        WHERE "status" = 'PENDING'
          AND "scheduledAt" <= NOW()
        ORDER BY "scheduledAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (rows.length === 0) return null;

      const job = rows[0]!;

      // Mark as EXTRACTING
      await tx.extractionJob.update({
        where: { id: job.id },
        data: {
          status: "EXTRACTING",
          startedAt: new Date(),
        },
      });

      return {
        id: job.id,
        fileId: job.fileId,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      };
    });
  },

  /**
   * Mark a job as successfully completed.
   */
  async complete(jobId: string): Promise<void> {
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        completedAt: new Date(),
      },
    });
  },

  /**
   * Record a job failure. If max attempts are reached, mark as permanently
   * FAILED and propagate the error to the File row. Otherwise, schedule
   * a retry with exponential backoff.
   *
   * Backoff formula: scheduledAt = now + 60s * 5^(attempts+1)
   * - Attempt 1 retry: 5 minutes
   * - Attempt 2 retry: 25 minutes
   * - Attempt 3 (cap): permanent failure (maxAttempts=3)
   */
  async fail(
    jobId: string,
    error: string,
    attempts: number,
    maxAttempts: number,
    fileId: string,
  ): Promise<"FAILED" | "RETRY"> {
    const nextAttempts = attempts + 1;

    if (nextAttempts >= maxAttempts) {
      // Permanent failure
      await prisma.$transaction([
        prisma.extractionJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            attempts: nextAttempts,
            lastError: error,
            completedAt: new Date(),
          },
        }),
        // Propagate failure to File row so the UI can display the error
        prisma.file.update({
          where: { id: fileId },
          data: {
            extractionStatus: "FAILED",
            extractionError: error,
          },
        }),
      ]);
      return "FAILED";
    }

    // Schedule retry with exponential backoff
    const backoffMs = 60_000 * Math.pow(5, nextAttempts);
    const nextScheduledAt = new Date(Date.now() + backoffMs);

    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        attempts: nextAttempts,
        lastError: error,
        scheduledAt: nextScheduledAt,
      },
    });

    return "RETRY";
  },

  /**
   * Process a single extraction job: claim, run, complete or fail.
   *
   * Derives the userId from the File row (ExtractionJob has no userId column)
   * and passes it to extractionService.runExtractionForFile.
   *
   * Enforces the per-user daily extraction cap (DZ-13) before running.
   *
   * @returns {ProcessResult} with processed=true if a job was claimed, false if queue was empty.
   */
  async processOnce(): Promise<ProcessResult> {
    const job = await extractionQueueService.claimNext();
    if (!job) {
      return { processed: false };
    }

    try {
      // Look up the file to get its userId (ExtractionJob has no userId column).
      // We use a direct Prisma query here because fileService.getFile requires
      // a userId we don't have yet. The File row is fetched by fileId (globally
      // unique) and we extract userId from it. This is the one place where
      // we query File without userId in the where clause, justified because
      // ExtractionJob.fileId is a @unique FK and the job was already validated
      // at enqueue time when userId was checked.
      const file = await prisma.file.findUnique({
        where: { id: job.fileId },
        select: { userId: true },
      });

      if (!file) {
        await extractionQueueService.fail(
          job.id,
          "File not found (deleted after enqueue?)",
          job.attempts,
          job.maxAttempts,
          job.fileId,
        );
        return {
          processed: true,
          jobId: job.id,
          fileId: job.fileId,
          status: "FAILED",
        };
      }

      // DZ-13: per-user daily extraction cap
      await enforceUserDailyCap(file.userId);

      // Run extraction (userId-scoped from here on)
      await extractionService.runExtractionForFile(file.userId, job.fileId);

      // Mark job complete
      await extractionQueueService.complete(job.id);

      return {
        processed: true,
        jobId: job.id,
        fileId: job.fileId,
        status: "COMPLETE",
      };
    } catch (error) {
      // Log the raw error for debugging (never persisted to user-visible columns)
      console.error(
        `[extractionQueue] Job ${job.id} (file ${job.fileId}) failed:`,
        error,
      );

      // Sanitize before persisting to File.extractionError (user-visible)
      const message = sanitizeExtractionError(error);

      // Determine whether this error is permanent (no point retrying).
      // UnsupportedMimeTypeError: no handler will magically appear on retry.
      // ExtractionQuotaExceededError: resolves tomorrow, not on retry.
      // MissingApiKeyError: key won't appear between retries.
      // BudgetExceededError: budget won't reset between retries (daily cap).
      const isPermanent =
        error instanceof UnsupportedMimeTypeError ||
        error instanceof ExtractionQuotaExceededError ||
        (error instanceof Error &&
          (error.name === "MissingApiKeyError" ||
            error.name === "BudgetExceededError"));

      const maxAtt = isPermanent ? 1 : job.maxAttempts;

      const status = await extractionQueueService.fail(
        job.id,
        message,
        job.attempts,
        maxAtt,
        job.fileId,
      );

      return {
        processed: true,
        jobId: job.id,
        fileId: job.fileId,
        status,
      };
    }
  },

  /**
   * Process a batch of extraction jobs. Called by the HTTP cron endpoint
   * (POST /api/files/extract/run, built in Phase 3).
   *
   * Loops processOnce() up to maxJobs times or until elapsed time exceeds
   * maxMillis, whichever comes first.
   *
   * @param maxJobs Maximum jobs to process in one batch (default 5).
   * @param maxMillis Maximum wall-clock time in ms (default 25,000 = 25s).
   */
  async processBatch(
    maxJobs = 5,
    maxMillis = 25_000,
  ): Promise<BatchResult> {
    const start = Date.now();
    const results: ProcessResult[] = [];

    for (let i = 0; i < maxJobs; i++) {
      // Check wall-clock time before starting next job
      if (Date.now() - start >= maxMillis) break;

      const result = await extractionQueueService.processOnce();
      results.push(result);

      // If the queue is empty, stop early
      if (!result.processed) break;
    }

    return {
      processed: results.filter((r) => r.processed).length,
      results,
    };
  },
};

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Enforce the per-user daily extraction cap (DZ-13).
 *
 * Counts successful extractions (ExtractionJob status=COMPLETE) for the
 * user in the last 24 hours. Throws ExtractionQuotaExceededError if the
 * cap is reached.
 *
 * The count joins ExtractionJob -> File to get the userId since
 * ExtractionJob has no userId column.
 */
async function enforceUserDailyCap(userId: string): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const count = await prisma.extractionJob.count({
    where: {
      status: "COMPLETE",
      completedAt: { gte: oneDayAgo },
      file: {
        userId,
      },
    },
  });

  if (count >= EXTRACTION_DAILY_CAP_PER_USER) {
    throw new ExtractionQuotaExceededError(
      userId,
      EXTRACTION_DAILY_CAP_PER_USER,
    );
  }
}
