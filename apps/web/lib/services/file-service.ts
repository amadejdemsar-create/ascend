import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import type { File } from "../../generated/prisma/client";
import type { PresignUploadInput } from "@/lib/validations";
import {
  ALLOWED_MIME_TYPES,
  UPLOAD_MAX_BYTES,
  PRESIGN_EXPIRES_SECONDS,
  DOWNLOAD_URL_EXPIRES_SECONDS,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// S3/R2 client (lazy-init singleton)
//
// R2 is optional in dev. The env vars may be unset. The service handles this
// by throwing on the FIRST call to createPresignedUpload if env is missing,
// not at module load. Routes will 500 clearly if R2 is unconfigured, which
// is acceptable: the user opted into storage features, they provision R2,
// they restart.
// ---------------------------------------------------------------------------

let cachedS3: { client: S3Client; bucket: string } | null | undefined;

/**
 * Lazy-init singleton for the S3/R2 client. Exported so that
 * extraction-service.ts can download file contents from R2 without
 * duplicating the client setup.
 */
export function getS3Client(): { client: S3Client; bucket: string } | null {
  if (cachedS3 !== undefined) return cachedS3;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    cachedS3 = null;
    return null;
  }

  cachedS3 = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };

  return cachedS3;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a filename for use in an S3 key:
 * lowercase, replace non-[a-z0-9.-] with "-", limit to 120 chars.
 */
function safeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/**
 * Build the storage key: users/<userId>/<yyyy>/<mm>/<uuid>-<safe-filename>
 * YYYY/MM partitioning helps with cold-storage lifecycle policies later.
 */
function buildStorageKey(userId: string, filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const safe = safeFilename(filename);
  return `users/${userId}/${yyyy}/${mm}/${uuid}-${safe}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const fileService = {
  /**
   * Create a PENDING File row and return a presigned PUT URL the client
   * can upload directly to R2.
   *
   * Enforces: 100 MiB cap, MIME allowlist, R2 env presence.
   */
  async createPresignedUpload(
    userId: string,
    input: PresignUploadInput,
    contextEntryId?: string,
  ): Promise<{
    fileId: string;
    uploadUrl: string;
    storageKey: string;
    expiresAt: string;
  }> {
    // Runtime guards (belt-and-suspenders on top of Zod schema validation)
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new Error(`MIME type not allowed: ${input.mimeType}`);
    }
    if (input.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new Error(
        `File size ${input.sizeBytes} exceeds maximum ${UPLOAD_MAX_BYTES} bytes`,
      );
    }

    const s3 = getS3Client();
    if (!s3) {
      throw new Error(
        "Storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
      );
    }

    const storageKey = buildStorageKey(userId, input.filename);

    // Create PENDING file record, optionally linked to a ContextEntry
    const file = await prisma.file.create({
      data: {
        userId,
        storageKey,
        bucket: s3.bucket,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        filename: input.filename,
        status: "PENDING",
        workspaceId: null,
        ...(contextEntryId && { contextEntryId }),
      },
    });

    // Generate presigned PUT URL
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
      ContentType: input.mimeType,
      ContentLength: input.sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3.client, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    const expiresAt = new Date(
      Date.now() + PRESIGN_EXPIRES_SECONDS * 1000,
    ).toISOString();

    return {
      fileId: file.id,
      uploadUrl,
      storageKey,
      expiresAt,
    };
  },

  /**
   * Mark a file as UPLOADED with an optional sha256 content hash.
   *
   * Rejects double-confirmation to prevent a reused presigned URL window
   * from silently succeeding.
   */
  async confirmUpload(
    userId: string,
    fileId: string,
    sha256?: string,
  ): Promise<File> {
    const existing = await prisma.file.findFirst({
      where: { id: fileId, userId },
    });
    if (!existing) throw new Error("Not found");

    if (existing.status === "UPLOADED") {
      throw new Error("File already confirmed");
    }

    return prisma.file.update({
      where: { id: fileId },
      data: {
        status: "UPLOADED",
        uploadedAt: new Date(),
        ...(sha256 && { sha256 }),
      },
    });
  },

  /**
   * Get a File by id, scoped to userId.
   */
  async getFile(userId: string, id: string): Promise<File | null> {
    return prisma.file.findFirst({
      where: { id, userId },
    });
  },

  /**
   * Serialize a File row for JSON transport.
   *
   * The schema's `sizeBytes` column is Prisma BigInt, which JSON.stringify
   * cannot handle natively (throws TypeError). Every route that returns a
   * File over HTTP MUST convert through this helper, not ship the raw row.
   *
   * Returns a plain object with sizeBytes narrowed to `number`. Safe for
   * every file up to our 100 MiB cap, far below Number.MAX_SAFE_INTEGER
   * (9,007 TiB).
   */
  serializeFile(file: File): Omit<File, "sizeBytes"> & { sizeBytes: number } {
    return { ...file, sizeBytes: Number(file.sizeBytes) };
  },

  /**
   * Server-side upload: writes bytes directly to R2 via PutObjectCommand,
   * creates the File row in UPLOADED status in one step.
   *
   * Used by the MCP `upload_file` tool and any future server-side ingestion
   * path (e.g., email-to-Ascend). Skips the presigned-URL round-trip since
   * the server already has the bytes in memory.
   *
   * @param userId The owner user ID (Safety Rule 1).
   * @param input  Filename, MIME type, and declared size.
   * @param buffer The raw file bytes.
   * @param contextEntryId Optional ContextEntry to link the file to.
   * @returns The created File row (serializable via serializeFile).
   * @throws {Error} if MIME type is not allowed, size exceeds cap, or R2 is unconfigured.
   */
  async uploadBytes(
    userId: string,
    input: { filename: string; mimeType: string; sizeBytes: number },
    buffer: Buffer,
    contextEntryId?: string,
  ): Promise<File> {
    // Runtime guards
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new Error(`MIME type not allowed: ${input.mimeType}`);
    }
    if (input.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new Error(
        `File size ${input.sizeBytes} exceeds maximum ${UPLOAD_MAX_BYTES} bytes`,
      );
    }
    if (buffer.length !== input.sizeBytes) {
      throw new Error(
        `Declared size ${input.sizeBytes} does not match buffer length ${buffer.length}`,
      );
    }

    const s3 = getS3Client();
    if (!s3) {
      throw new Error(
        "Storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
      );
    }

    const storageKey = buildStorageKey(userId, input.filename);

    // Upload directly to R2
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: input.mimeType,
        ContentLength: input.sizeBytes,
      }),
    );

    // Create File row in UPLOADED status (skip PENDING since bytes are already in R2).
    // If Prisma fails, issue a compensating R2 DELETE to avoid orphaning the object.
    try {
      const file = await prisma.file.create({
        data: {
          userId,
          storageKey,
          bucket: s3.bucket,
          mimeType: input.mimeType,
          sizeBytes: BigInt(input.sizeBytes),
          filename: input.filename,
          status: "UPLOADED",
          uploadedAt: new Date(),
          workspaceId: null,
          ...(contextEntryId && { contextEntryId }),
        },
      });

      return file;
    } catch (prismaErr) {
      // Compensating delete to avoid orphaning the R2 object (DZ-13).
      // Best-effort; if this also fails, log and surface the original error.
      try {
        await s3.client.send(
          new DeleteObjectCommand({
            Bucket: s3.bucket,
            Key: storageKey,
          }),
        );
      } catch (cleanupErr) {
        console.error(
          "[fileService.uploadBytes] R2 compensating delete failed",
          { storageKey, cleanupErr },
        );
      }
      throw prismaErr;
    }
  },

  /**
   * List files for a user, optionally filtered by MIME type prefix.
   *
   * Used by the MCP `list_files_by_type` tool for browsing a user's files.
   *
   * @param userId The owner user ID (Safety Rule 1).
   * @param opts.mimeTypePrefix Filter files whose mimeType starts with this string (e.g., "image/", "audio/").
   * @param opts.limit Maximum files to return (default 50, max 200).
   * @param opts.offset Pagination offset (default 0).
   * @returns { files, total } where total is the unfiltered count matching the where clause.
   */
  async listFiles(
    userId: string,
    opts: { mimeTypePrefix?: string; limit?: number; offset?: number } = {},
  ): Promise<{ files: File[]; total: number }> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const where: { userId: string; mimeType?: { startsWith: string } } = {
      userId,
    };
    if (opts.mimeTypePrefix) {
      where.mimeType = { startsWith: opts.mimeTypePrefix };
    }

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.file.count({ where }),
    ]);

    return { files, total };
  },

  /**
   * Delete a File row AND the R2 object. Scoped to userId.
   *
   * Deletion order: R2 first, then Prisma. If R2 delete fails, the row
   * persists and the user can retry. Orphan R2 objects (R2 succeeds but
   * Prisma fails) are recoverable via a storage reconciliation sweep;
   * orphan Prisma rows pointing to deleted R2 objects are harder to
   * detect and clean up.
   */
  async deleteFile(userId: string, id: string): Promise<void> {
    const existing = await prisma.file.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new Error("Not found");

    const s3 = getS3Client();
    if (s3) {
      await s3.client.send(
        new DeleteObjectCommand({
          Bucket: existing.bucket,
          Key: existing.storageKey,
        }),
      );
    }

    await prisma.file.delete({ where: { id } });
  },

  /**
   * Generate a presigned GET URL for downloading a file from R2.
   *
   * 5-minute expiry (shorter than the 15-minute upload URL) to limit
   * exposure of the download link.
   *
   * @throws {Error} "Not found" if the file does not exist or belong to the user.
   * @throws {Error} if R2 is not configured.
   */
  async createDownloadUrl(
    userId: string,
    id: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const file = await prisma.file.findFirst({
      where: { id, userId },
    });
    if (!file) throw new Error("Not found");

    const s3 = getS3Client();
    if (!s3) {
      throw new Error(
        "Storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
      );
    }

    const command = new GetObjectCommand({
      Bucket: file.bucket,
      Key: file.storageKey,
    });
    const url = await getSignedUrl(s3.client, command, {
      expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS,
    });

    const expiresAt = new Date(
      Date.now() + DOWNLOAD_URL_EXPIRES_SECONDS * 1000,
    ).toISOString();

    return { url, expiresAt };
  },

  /**
   * Stream a file's bytes from R2. Used for SVG serving where we must
   * add hardened security headers (Content-Disposition: attachment,
   * X-Content-Type-Options: nosniff) and cannot use a presigned URL.
   *
   * Returns the R2 response body as a web ReadableStream, plus metadata
   * needed for the response headers.
   *
   * @throws {Error} "Not found" if the file does not exist or belong to the user.
   * @throws {Error} if R2 is not configured or the download fails.
   */
  async streamFile(
    userId: string,
    id: string,
  ): Promise<{
    stream: ReadableStream<Uint8Array>;
    contentType: string;
    sizeBytes: number;
    filename: string;
  }> {
    const file = await prisma.file.findFirst({
      where: { id, userId },
    });
    if (!file) throw new Error("Not found");

    const s3 = getS3Client();
    if (!s3) {
      throw new Error(
        "Storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
      );
    }

    const response = await s3.client.send(
      new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.storageKey,
      }),
    );

    if (!response.Body) {
      throw new Error("Empty response from storage");
    }

    // Convert Node.js Readable to Web ReadableStream.
    // The AWS SDK v3 returns Body as a Readable (Node) or ReadableStream (browser).
    // In a Node/Edge environment, we need to convert.
    const { Readable } = await import("node:stream");
    const nodeReadable = response.Body as import("node:stream").Readable;
    const webStream = Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>;

    return {
      stream: webStream,
      contentType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
      filename: file.filename,
    };
  },

  /**
   * Delete orphan PENDING files older than 24 hours.
   *
   * Files stuck in PENDING status were never confirmed (the client started
   * a presign but never uploaded, or the upload failed). We clean them up
   * to reclaim R2 storage and keep the database tidy.
   *
   * Called by the cron cleanup endpoint (POST /api/files/cleanup).
   * Failures on individual files are logged and skipped so one bad file
   * does not abort the entire batch.
   */
  async cleanupOrphanPending(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const orphans = await prisma.file.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoff },
      },
      select: { id: true, userId: true },
    });

    let deleted = 0;
    for (const orphan of orphans) {
      try {
        // deleteFile is userId-scoped and handles R2 + Prisma deletion
        await fileService.deleteFile(orphan.userId, orphan.id);
        deleted++;
      } catch (err) {
        console.error(
          `[fileService.cleanupOrphanPending] Failed to delete orphan file ${orphan.id}:`,
          err instanceof Error ? err.message : err,
        );
        // Continue to next file; do not abort batch
      }
    }

    return { deleted };
  },
};
