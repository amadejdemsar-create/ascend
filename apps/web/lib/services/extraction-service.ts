/**
 * Extraction Service.
 *
 * Orchestrates the extraction pipeline for a single file: downloads from R2,
 * dispatches to the appropriate modality handler, writes results back to the
 * File row. Called by the extraction queue service (extraction-queue-service.ts).
 *
 * Follows the const-object service pattern (see goal-service.ts).
 * userId is always the first parameter.
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db";
import { getS3Client } from "@/lib/services/file-service";
import { dispatch, ExtractionTimeoutError } from "@/lib/extraction";

// ── Constants ───────────────────────────────────────────────────

/**
 * Maximum file size in bytes that the extraction pipeline will process.
 * Files above this threshold are marked as FAILED immediately.
 * 50 MiB is generous for text extraction; very large files should be
 * chunked or processed via a dedicated pipeline.
 */
const MAX_EXTRACTION_BYTES = 50 * 1024 * 1024;

/**
 * Per-handler timeout in milliseconds. If a single handler takes longer
 * than this, the extraction is aborted and the job can be retried.
 */
const HANDLER_TIMEOUT_MS = 60_000;

// ── Service ─────────────────────────────────────────────────────

export const extractionService = {
  /**
   * Run the full extraction pipeline for a single file.
   *
   * 1. Fetch the File row (userId-scoped per Safety Rule 1).
   * 2. Reject files >50 MiB (mark FAILED on the File row).
   * 3. Download the file content from R2.
   * 4. Dispatch to the modality handler with a 60s timeout.
   * 5. On success: update File with extracted text, page count, etc.
   * 6. On failure: rethrow so the queue can record the error.
   *
   * @throws {Error} "Not found" if the file does not exist or belong to the user.
   * @throws {Error} if R2 is not configured or the download fails.
   * @throws {ExtractionTimeoutError} if the handler exceeds 60s.
   * @throws Any error from the modality handler (propagated for queue retry logic).
   */
  async runExtractionForFile(userId: string, fileId: string): Promise<void> {
    // 1. Fetch file (userId-scoped)
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId },
    });
    if (!file) throw new Error("Not found");

    // 2. Size guard
    const sizeBytes = Number(file.sizeBytes);
    if (sizeBytes > MAX_EXTRACTION_BYTES) {
      await prisma.file.update({
        where: { id: fileId },
        data: {
          extractionStatus: "FAILED",
          extractionError: `File too large for extraction (${Math.round(sizeBytes / 1024 / 1024)} MiB exceeds ${MAX_EXTRACTION_BYTES / 1024 / 1024} MiB limit)`,
        },
      });
      return;
    }

    // 3. Download from R2
    const s3 = getS3Client();
    if (!s3) {
      throw new Error(
        "Storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
          "R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
      );
    }

    const getCmd = new GetObjectCommand({
      Bucket: file.bucket,
      Key: file.storageKey,
    });

    const response = await s3.client.send(getCmd);
    if (!response.Body) {
      throw new Error(`R2 returned empty body for key: ${file.storageKey}`);
    }

    // Stream to buffer
    const chunks: Uint8Array[] = [];
    // The Body from S3 client is a Readable stream (Node.js environment)
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 4. Dispatch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HANDLER_TIMEOUT_MS);

    try {
      const result = await Promise.race([
        dispatch(buffer, file.mimeType, {
          userId,
          workspaceId: file.workspaceId,
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          // Belt-and-suspenders timeout: if AbortSignal doesn't propagate
          // cleanly through all handler internals, this catches it.
          setTimeout(
            () => reject(new ExtractionTimeoutError(HANDLER_TIMEOUT_MS)),
            HANDLER_TIMEOUT_MS + 1000,
          );
        }),
      ]);

      // 5. Success: update File row
      await prisma.file.update({
        where: { id: fileId },
        data: {
          extractedText: result.text,
          pageCount: result.pageCount ?? null,
          thumbnailKey: result.thumbnailKey ?? null,
          durationSec: result.durationSec ?? null,
          tags: result.tags ?? [],
          extractionStatus: "COMPLETE",
          extractionError: null,
          extractedAt: new Date(),
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
