/**
 * Wave 10: MCP federation service.
 *
 * CRUD for McpServerConnection rows + tool-cache refresh + connection
 * testing. Every method userId+workspaceId scoped (safety rule 1, DZ-22).
 * Writes pass through permissionService for Wave 8 RBAC compliance.
 *
 * Two consumer surfaces:
 *   1. /api/mcp-servers HTTP routes for the settings UI.
 *   2. /api/mcp (Ascend's own MCP endpoint) reads McpServerToolCache
 *      rows at tools/list time and the connection row at tools/call
 *      time. Reads bypass permissionService when called from /api/mcp
 *      because the user has already authenticated to the endpoint; we
 *      use direct prisma.findFirst with userId+workspaceId scoping.
 */

import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/db";
import { permissionService } from "@/lib/services/permission-service";
import { encryptSecret, decryptSecret } from "@/lib/services/secrets-service";
import { federationProxy } from "@/lib/mcp/federation-proxy";
import type {
  CreateMcpConnectionInput,
  UpdateMcpConnectionInput,
} from "@/lib/validations";

// ── Slug helpers (mirror canvas-layout-service pattern) ─────────────

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "server";
}

async function findUniqueSlug(
  tx: Prisma.TransactionClient,
  userId: string,
  baseSlug: string,
): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    const existing = await tx.mcpServerConnection.findFirst({
      where: { userId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

// ── Public connection shape (omits ciphertext) ──────────────────────

export interface PublicMcpConnection {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  slug: string;
  transport: "HTTP_STREAMABLE" | "SSE";
  endpoint: string;
  authType: "NONE" | "API_KEY" | "BEARER";
  /** True when credentials are stored. Never the value itself. */
  hasCredentials: boolean;
  enabled: boolean;
  lastListedAt: Date | null;
  lastListError: string | null;
  createdAt: Date;
  updatedAt: Date;
  toolCount?: number;
}

function toPublic(row: {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  slug: string;
  transport: "HTTP_STREAMABLE" | "SSE";
  endpoint: string;
  authType: "NONE" | "API_KEY" | "BEARER";
  encryptedCredentials: string | null;
  enabled: boolean;
  lastListedAt: Date | null;
  lastListError: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { toolCache: number };
}): PublicMcpConnection {
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    transport: row.transport,
    endpoint: row.endpoint,
    authType: row.authType,
    hasCredentials: row.encryptedCredentials !== null,
    enabled: row.enabled,
    lastListedAt: row.lastListedAt,
    lastListError: row.lastListError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    toolCount: row._count?.toolCache,
  };
}

// ── Service ─────────────────────────────────────────────────────────

export const mcpFederationService = {
  /**
   * List the user's connections in this workspace. Newest-updated first.
   * Includes the cached tool count for the settings UI; omits credentials.
   */
  async list(
    userId: string,
    workspaceId: string,
  ): Promise<PublicMcpConnection[]> {
    const rows = await prisma.mcpServerConnection.findMany({
      where: { userId, workspaceId },
      include: { _count: { select: { toolCache: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return rows.map(toPublic);
  },

  /**
   * Get one connection (public shape, no credentials). Returns null if
   * missing or not owned. Used by the settings UI.
   */
  async getById(
    userId: string,
    workspaceId: string,
    id: string,
  ): Promise<PublicMcpConnection | null> {
    const row = await prisma.mcpServerConnection.findFirst({
      where: { id, userId, workspaceId },
      include: { _count: { select: { toolCache: true } } },
    });
    return row ? toPublic(row) : null;
  },

  /**
   * Internal: get connection WITH decrypted credentials. Used by
   * federation-proxy + testConnection + refreshToolCache. Must NEVER
   * be returned over HTTP.
   */
  async _getInternal(
    userId: string,
    workspaceId: string,
    id: string,
  ): Promise<{
    connection: PublicMcpConnection;
    decryptedCredentials: string | null;
  } | null> {
    const row = await prisma.mcpServerConnection.findFirst({
      where: { id, userId, workspaceId },
    });
    if (!row) return null;
    const decryptedCredentials = row.encryptedCredentials
      ? decryptSecret(row.encryptedCredentials)
      : null;
    return {
      connection: toPublic(row),
      decryptedCredentials,
    };
  },

  /**
   * Variant of `_getInternal` keyed by slug (the federated tool-name
   * prefix). Used by /api/mcp tools/call routing.
   */
  async _getInternalBySlug(
    userId: string,
    workspaceId: string,
    slug: string,
  ): Promise<{
    connection: PublicMcpConnection;
    decryptedCredentials: string | null;
  } | null> {
    const row = await prisma.mcpServerConnection.findFirst({
      where: { userId, workspaceId, slug, enabled: true },
    });
    if (!row) return null;
    const decryptedCredentials = row.encryptedCredentials
      ? decryptSecret(row.encryptedCredentials)
      : null;
    return {
      connection: toPublic(row),
      decryptedCredentials,
    };
  },

  /**
   * Read the cached tools for a connection, used at /api/mcp tools/list
   * time. Returns prefixed tool descriptors ready to splice into the
   * native tools array.
   */
  async listCachedToolsForUser(
    userId: string,
    workspaceId: string,
  ): Promise<
    Array<{
      name: string; // already prefixed: <slug>__<toolName>
      description?: string;
      inputSchema: unknown;
    }>
  > {
    const rows = await prisma.mcpServerToolCache.findMany({
      where: {
        userId,
        workspaceId,
        connection: { enabled: true },
      },
      include: { connection: { select: { slug: true } } },
    });
    return rows.map((r) => ({
      name: `${r.connection.slug}__${r.toolName}`,
      description: r.description ?? undefined,
      inputSchema: r.inputSchema,
    }));
  },

  /**
   * Create a new connection. Encrypts credentials at rest. Auto-derives
   * slug from name if not supplied. Verifies workspace WRITE permission.
   */
  async create(
    userId: string,
    workspaceId: string,
    input: CreateMcpConnectionInput,
  ): Promise<PublicMcpConnection> {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );

    const encryptedCredentials =
      input.authType !== "NONE" && input.credentials
        ? encryptSecret(input.credentials)
        : null;

    const row = await prisma.$transaction(async (tx) => {
      const baseSlug = input.slug ?? slugify(input.name);
      const slug = await findUniqueSlug(tx, userId, baseSlug);
      return tx.mcpServerConnection.create({
        data: {
          userId,
          workspaceId,
          name: input.name,
          slug,
          transport: input.transport,
          endpoint: input.endpoint,
          authType: input.authType,
          encryptedCredentials,
          enabled: input.enabled,
        },
      });
    });

    return toPublic({ ...row, _count: { toolCache: 0 } });
  },

  /**
   * Update a connection. If `credentials` is present, re-encrypts and
   * replaces. If absent, leaves the existing ciphertext untouched. If
   * `authType` flips to NONE, credentials are CLEARED (set to null).
   */
  async update(
    userId: string,
    workspaceId: string,
    id: string,
    input: UpdateMcpConnectionInput,
  ): Promise<PublicMcpConnection> {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );

    const existing = await prisma.mcpServerConnection.findFirst({
      where: { id, userId, workspaceId },
    });
    if (!existing) throw new Error("MCP connection not found");

    // Compute new encrypted credentials value
    let nextEncrypted: string | null | undefined = undefined; // undefined = leave as is
    const nextAuthType = input.authType ?? existing.authType;
    if (input.credentials !== undefined) {
      nextEncrypted =
        nextAuthType !== "NONE" ? encryptSecret(input.credentials) : null;
    } else if (input.authType !== undefined && input.authType === "NONE") {
      nextEncrypted = null;
    }

    const row = await prisma.$transaction(async (tx) => {
      let slug = existing.slug;
      if (input.slug !== undefined && input.slug !== existing.slug) {
        slug = await findUniqueSlug(tx, userId, input.slug);
      }
      return tx.mcpServerConnection.update({
        where: { id },
        data: {
          name: input.name ?? undefined,
          slug,
          transport: input.transport ?? undefined,
          endpoint: input.endpoint ?? undefined,
          authType: input.authType ?? undefined,
          ...(nextEncrypted !== undefined
            ? { encryptedCredentials: nextEncrypted }
            : {}),
          enabled: input.enabled ?? undefined,
        },
        include: { _count: { select: { toolCache: true } } },
      });
    });
    return toPublic(row);
  },

  /**
   * Delete a connection. Cascades to McpServerToolCache. RBAC-gated.
   */
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

    const existing = await prisma.mcpServerConnection.findFirst({
      where: { id, userId, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new Error("MCP connection not found");

    await prisma.mcpServerConnection.delete({ where: { id } });
  },

  /**
   * Test the connection: call upstream `initialize` + `tools/list`. On
   * success, REFRESH the tool cache (upsert + delete-stale). On failure,
   * record the error message on the connection row. Returns a small
   * status object suitable for inline UI.
   */
  async testConnection(
    userId: string,
    workspaceId: string,
    id: string,
  ): Promise<{
    healthy: boolean;
    toolCount?: number;
    error?: string;
  }> {
    const internal = await this._getInternal(userId, workspaceId, id);
    if (!internal) throw new Error("MCP connection not found");

    const result = await federationProxy.listTools(
      internal.connection,
      internal.decryptedCredentials,
    );

    const now = new Date();
    if (result.ok) {
      // Replace tool cache atomically: delete then bulk-insert
      await prisma.$transaction(async (tx) => {
        await tx.mcpServerToolCache.deleteMany({
          where: { mcpServerConnectionId: id },
        });
        if (result.tools.length > 0) {
          await tx.mcpServerToolCache.createMany({
            data: result.tools.map((t) => ({
              mcpServerConnectionId: id,
              userId,
              workspaceId,
              toolName: t.name,
              description: t.description ?? null,
              inputSchema: t.inputSchema as Prisma.InputJsonValue,
            })),
          });
        }
        await tx.mcpServerConnection.update({
          where: { id },
          data: { lastListedAt: now, lastListError: null },
        });
      });
      return { healthy: true, toolCount: result.tools.length };
    }

    // Failure path: persist the truncated error message; leave cache as is.
    await prisma.mcpServerConnection.update({
      where: { id },
      data: { lastListError: result.error.slice(0, 500) },
    });
    return { healthy: false, error: result.error };
  },
};
