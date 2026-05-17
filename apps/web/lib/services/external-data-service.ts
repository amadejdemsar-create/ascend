/**
 * Wave 10: External data service.
 *
 * CRUD for ExternalDataSource + query proxy through the per-provider
 * adapter. Every method userId+workspaceId scoped. Writes RBAC-gated.
 *
 * Source create runs a 2-step transaction:
 *   1. Insert ExternalDataSource (with encrypted credentials).
 *   2. Insert a paired ContextEntry of type EXTERNAL_DATABASE with the
 *      externalDataSourceId FK pointing back.
 * Delete cascade-removes the ContextEntry via the FK SetNull and an
 * explicit ContextEntry delete in a transaction (the source's lifetime
 * is bounded by the entry's).
 *
 * Query path:
 *   - Validate the source exists + is enabled + scoped to user.
 *   - Decrypt credentials.
 *   - Build the adapter (currently GitHub-only).
 *   - Check LRU cache; on miss, delegate to adapter and cache.
 *   - Return rows + cursor.
 *
 * Cache invalidation:
 *   - Source update + delete: invalidate ALL cached rows for that source.
 *   - Schema refresh: invalidate too (might affect field types).
 */

import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/db";
import { permissionService } from "@/lib/services/permission-service";
import { activityEventService } from "@/lib/services/activity-event-service";
import { encryptSecret, decryptSecret } from "@/lib/services/secrets-service";
import {
  cacheKeyFor,
  externalDataQueryCache,
} from "@/lib/external-data/cache";
import { createGithubAdapter } from "@/lib/external-data/adapters/github-adapter";
import type {
  CreateExternalSourceInput,
  ExternalDataAdapter,
  ExternalDataField,
  ExternalDataQueryInput,
  ExternalDataQueryResult,
  GithubConfig,
  UpdateExternalSourceInput,
} from "@/lib/validations";

// ── Public source shape (omits ciphertext) ──────────────────────────

export interface PublicExternalSource {
  id: string;
  userId: string;
  workspaceId: string;
  provider: "GITHUB";
  name: string;
  authType: "PAT";
  hasCredentials: boolean;
  config: unknown;
  enabled: boolean;
  lastRefreshedAt: Date | null;
  lastRefreshError: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** The 1:1 ContextEntry id (read-only convenience). */
  contextEntryId: string | null;
}

function toPublic(row: {
  id: string;
  userId: string;
  workspaceId: string;
  provider: "GITHUB";
  name: string;
  authType: "PAT";
  encryptedCredentials: string;
  config: Prisma.JsonValue;
  enabled: boolean;
  lastRefreshedAt: Date | null;
  lastRefreshError: string | null;
  createdAt: Date;
  updatedAt: Date;
  contextEntry?: { id: string } | null;
}): PublicExternalSource {
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    provider: row.provider,
    name: row.name,
    authType: row.authType,
    hasCredentials: !!row.encryptedCredentials,
    config: row.config,
    enabled: row.enabled,
    lastRefreshedAt: row.lastRefreshedAt,
    lastRefreshError: row.lastRefreshError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    contextEntryId: row.contextEntry?.id ?? null,
  };
}

// ── Adapter factory ─────────────────────────────────────────────────

function buildAdapter(
  provider: "GITHUB",
  decryptedPat: string,
  config: GithubConfig,
): ExternalDataAdapter {
  switch (provider) {
    case "GITHUB":
      return createGithubAdapter({ pat: decryptedPat, config });
  }
}

// ── Service ─────────────────────────────────────────────────────────

export const externalDataService = {
  async list(
    userId: string,
    workspaceId: string,
  ): Promise<PublicExternalSource[]> {
    const rows = await prisma.externalDataSource.findMany({
      where: { userId, workspaceId },
      include: { contextEntry: { select: { id: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return rows.map(toPublic);
  },

  async getById(
    userId: string,
    workspaceId: string,
    id: string,
  ): Promise<PublicExternalSource | null> {
    const row = await prisma.externalDataSource.findFirst({
      where: { id, userId, workspaceId },
      include: { contextEntry: { select: { id: true } } },
    });
    return row ? toPublic(row) : null;
  },

  async create(
    userId: string,
    workspaceId: string,
    input: CreateExternalSourceInput,
  ): Promise<PublicExternalSource> {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );
    const encryptedCredentials = encryptSecret(input.credentials);

    // 2-step transaction: source row → ContextEntry → link the entry's
    // externalDataSourceId back to the source row.
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.externalDataSource.create({
        data: {
          userId,
          workspaceId,
          provider: input.provider,
          name: input.name,
          authType: input.authType,
          encryptedCredentials,
          config: (input.config as Prisma.InputJsonValue) ?? {},
          enabled: input.enabled,
        },
      });
      const entry = await tx.contextEntry.create({
        data: {
          userId,
          workspaceId,
          title: input.name,
          content: `External database backed by ${input.provider}.`,
          type: "EXTERNAL_DATABASE",
          externalDataSourceId: source.id,
        },
      });
      return { source, entryId: entry.id };
    });

    void activityEventService.log(
      workspaceId,
      userId,
      "EXTERNAL_SOURCE_CONNECTED",
      {
        eventType: "EXTERNAL_SOURCE_CONNECTED",
        sourceId: result.source.id,
        provider: result.source.provider,
        name: result.source.name,
      },
    );

    return toPublic({
      ...result.source,
      contextEntry: { id: result.entryId },
    });
  },

  async update(
    userId: string,
    workspaceId: string,
    id: string,
    input: UpdateExternalSourceInput,
  ): Promise<PublicExternalSource> {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );

    const existing = await prisma.externalDataSource.findFirst({
      where: { id, userId, workspaceId },
    });
    if (!existing) throw new Error("External data source not found");

    const data: Prisma.ExternalDataSourceUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.credentials !== undefined) {
      data.encryptedCredentials = encryptSecret(input.credentials);
    }
    if (input.config !== undefined) {
      data.config = input.config as Prisma.InputJsonValue;
    }
    if (input.enabled !== undefined) data.enabled = input.enabled;

    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.externalDataSource.update({
        where: { id },
        data,
        include: { contextEntry: { select: { id: true } } },
      });
      // Keep the paired ContextEntry title in sync when name changes.
      if (input.name !== undefined && row.contextEntry?.id) {
        await tx.contextEntry.update({
          where: { id: row.contextEntry.id },
          data: { title: input.name },
        });
      }
      return row;
    });

    // Invalidate cache for this source — both name + config + creds
    // changes can affect what the adapter returns.
    externalDataQueryCache.invalidatePrefix(`${userId}${workspaceId}${id}`);

    return toPublic(result);
  },

  async delete(
    userId: string,
    workspaceId: string,
    id: string,
  ): Promise<void> {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "DELETE_NODE",
    );

    const existing = await prisma.externalDataSource.findFirst({
      where: { id, userId, workspaceId },
      include: { contextEntry: { select: { id: true } } },
    });
    if (!existing) throw new Error("External data source not found");

    await prisma.$transaction(async (tx) => {
      // Delete the paired ContextEntry explicitly (the FK is
      // ContextEntry.externalDataSourceId → SetNull on delete, so we
      // need this for the entry itself to go away).
      if (existing.contextEntry?.id) {
        await tx.contextEntry.delete({
          where: { id: existing.contextEntry.id },
        });
      }
      await tx.externalDataSource.delete({ where: { id } });
    });

    externalDataQueryCache.invalidatePrefix(`${userId}${workspaceId}${id}`);

    void activityEventService.log(
      workspaceId,
      userId,
      "EXTERNAL_SOURCE_DISCONNECTED",
      {
        eventType: "EXTERNAL_SOURCE_DISCONNECTED",
        sourceId: existing.id,
        provider: existing.provider,
        name: existing.name,
      },
    );
  },

  /** Re-fetch + cache the per-shape schemas for a source. */
  async refreshSchema(
    userId: string,
    workspaceId: string,
    id: string,
  ): Promise<PublicExternalSource> {
    const existing = await prisma.externalDataSource.findFirst({
      where: { id, userId, workspaceId },
    });
    if (!existing) throw new Error("External data source not found");

    const pat = decryptSecret(existing.encryptedCredentials);
    const adapter = buildAdapter(
      existing.provider,
      pat,
      existing.config as GithubConfig,
    );

    const shapeSchemas: Record<string, ExternalDataField[]> = {};
    for (const shape of adapter.listShapes()) {
      try {
        shapeSchemas[shape.id] = await adapter.getSchema(shape.id);
      } catch {
        // Skip individual failures; refresh remains best-effort.
      }
    }

    const nextConfig = {
      ...(existing.config as object),
      shapeSchemas,
    } as unknown as Prisma.InputJsonValue;

    const result = await prisma.externalDataSource.update({
      where: { id },
      data: {
        config: nextConfig,
        lastRefreshedAt: new Date(),
        lastRefreshError: null,
      },
      include: { contextEntry: { select: { id: true } } },
    });

    externalDataQueryCache.invalidatePrefix(`${userId}${workspaceId}${id}`);

    return toPublic(result);
  },

  /** Read-only query against the adapter, cached for 5 minutes. */
  async query(
    userId: string,
    workspaceId: string,
    sourceId: string,
    input: ExternalDataQueryInput,
  ): Promise<ExternalDataQueryResult> {
    const source = await prisma.externalDataSource.findFirst({
      where: { id: sourceId, userId, workspaceId, enabled: true },
    });
    if (!source) throw new Error("External data source not found or disabled");

    const key = cacheKeyFor({
      userId,
      workspaceId,
      sourceId,
      shape: input.shape,
      filter: input.filter,
      sort: input.sort,
      cursor: input.cursor,
      perPage: input.perPage,
    });
    const cached = externalDataQueryCache.get(key) as
      | ExternalDataQueryResult
      | null;
    if (cached) return cached;

    const pat = decryptSecret(source.encryptedCredentials);
    const adapter = buildAdapter(
      source.provider,
      pat,
      source.config as GithubConfig,
    );
    const result = await adapter.query(input.shape, {
      filter: input.filter,
      sort: input.sort,
      cursor: input.cursor,
      perPage: input.perPage,
    });
    externalDataQueryCache.set(key, result);
    return result;
  },

  /** Resolve a single row by its remoteId (used by wikilink resolver). */
  async getRow(
    userId: string,
    workspaceId: string,
    sourceId: string,
    shape: string,
    remoteId: string,
  ) {
    const source = await prisma.externalDataSource.findFirst({
      where: { id: sourceId, userId, workspaceId, enabled: true },
    });
    if (!source) return null;
    const pat = decryptSecret(source.encryptedCredentials);
    const adapter = buildAdapter(
      source.provider,
      pat,
      source.config as GithubConfig,
    );
    return adapter.getRow(shape, remoteId);
  },
};
