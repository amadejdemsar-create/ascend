import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import type { File } from "../../generated/prisma/client";
import type { PresignUploadInput } from "@/lib/validations";
import {
  ALLOWED_MIME_TYPES,
  UPLOAD_MAX_BYTES,
  PRESIGN_EXPIRES_SECONDS,
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

function getS3Client(): { client: S3Client; bucket: string } | null {
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

    // Create PENDING file record
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
};
