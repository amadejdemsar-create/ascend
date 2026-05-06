/**
 * Versioning Service — snapshot orchestrator.
 *
 * Manages immutable NodeVersion snapshots for all versionable entities
 * (ContextEntry, Goal, Todo, DatabaseRow, DatabaseField). Provides:
 *
 * - In-process debounced snapshot scheduling (60s window)
 * - Immediate snapshot for EDIT_BLUR and EDIT_EXPLICIT triggers
 * - Content-hash deduplication (same hash = skip write)
 * - 10 MiB byte-size cap (matches DB CHECK constraint)
 * - userId-scoped queries throughout (safety rule 1)
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import type { NodeType, VersionTrigger } from "@/lib/validations";
import { workspaceContextService } from "./workspace-context-service";

// ── Constants ────────────────────────────────────────────────────────

/** Matches DB CHECK constraint on NodeVersion.byteSize */
const MAX_BYTE_SIZE = 10 * 1024 * 1024; // 10 MiB

/** Debounce window for non-immediate triggers */
const DEBOUNCE_MS = 60_000; // 60 seconds

// ── In-process debounce map ──────────────────────────────────────────
// Per-process state; best-effort. EDIT_BLUR / EDIT_EXPLICIT triggers
// fire immediately, guaranteeing at-least-once snapshot per session.

const debounceMap = new Map<string, NodeJS.Timeout>();

function debounceKey(userId: string, nodeType: NodeType, nodeId: string) {
  return `${userId}:${nodeType}:${nodeId}`;
}

// ── Service ──────────────────────────────────────────────────────────

export const versioningService = {
  /**
   * Schedule a snapshot, debounced 60s. EDIT_BLUR and EDIT_EXPLICIT bypass
   * debounce and fire immediately (still async). Other triggers reset the
   * timer.
   *
   * workspaceId is the workspace of the entity being versioned; recorded
   * on the NodeVersion row.
   */
  scheduleSnapshot(
    userId: string,
    workspaceId: string,
    nodeType: NodeType,
    nodeId: string,
    trigger: VersionTrigger,
  ): void {
    const key = debounceKey(userId, nodeType, nodeId);
    const existing = debounceMap.get(key);
    if (existing) clearTimeout(existing);

    if (trigger === "EDIT_BLUR" || trigger === "EDIT_EXPLICIT") {
      debounceMap.delete(key);
      // Fire-and-forget; errors are logged but never thrown to the caller
      void versioningService
        .createSnapshot(userId, workspaceId, nodeType, nodeId, trigger)
        .catch((err) => {
          console.error("[versioning] immediate snapshot failed", {
            key,
            trigger,
            err,
          });
        });
      return;
    }

    const timer = setTimeout(() => {
      debounceMap.delete(key);
      void versioningService
        .createSnapshot(userId, workspaceId, nodeType, nodeId, trigger)
        .catch((err) => {
          console.error("[versioning] debounced snapshot failed", {
            key,
            trigger,
            err,
          });
        });
    }, DEBOUNCE_MS);
    debounceMap.set(key, timer);
  },

  /**
   * Create a snapshot of a node's current state. Deduplicates via content
   * hash: if the latest version has the same hash, returns null without
   * writing.
   *
   * Returns the created version metadata, or null if:
   * - The entity no longer exists (deleted between schedule and fire)
   * - The payload exceeds 10 MiB
   * - The latest version already has the same content hash (dedup)
   */
  async createSnapshot(
    userId: string,
    workspaceId: string,
    nodeType: NodeType,
    nodeId: string,
    trigger: VersionTrigger,
    parentVersionId?: string,
  ): Promise<{ id: string; versionNumber: number } | null> {
    const payload = await versioningService._fetchEntityPayload(
      userId,
      nodeType,
      nodeId,
    );
    if (!payload) return null; // entity gone (deleted between schedule and fire)

    const serialized = JSON.stringify(payload);
    const byteSize = Buffer.byteLength(serialized, "utf8");
    if (byteSize > MAX_BYTE_SIZE) {
      console.error("[versioning] snapshot exceeds 10 MiB; skipping", {
        userId,
        nodeType,
        nodeId,
        byteSize,
      });
      return null;
    }
    const contentHash = createHash("sha256").update(serialized).digest("hex");

    // Dedup: skip if latest version has same hash
    const latest = await prisma.nodeVersion.findFirst({
      where: { userId, workspaceId, nodeType, nodeId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true, contentHash: true },
    });
    if (latest && latest.contentHash === contentHash) {
      return null;
    }
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const created = await prisma.nodeVersion.create({
      data: {
        userId,
        workspaceId,
        nodeType,
        nodeId,
        versionNumber,
        payload: payload as never,
        contentHash,
        byteSize,
        trigger,
        parentVersionId: parentVersionId ?? null,
      },
      select: { id: true, versionNumber: true },
    });
    return created;
  },

  /**
   * Paginated list of versions for a specific node, ordered by createdAt DESC.
   * Cursor-based pagination using version ID.
   */
  async listVersions(
    userId: string,
    workspaceId: string,
    nodeType: NodeType,
    nodeId: string,
    opts?: { limit?: number; cursor?: string },
  ) {
    const limit = Math.min(opts?.limit ?? 20, 100);
    const versions = await prisma.nodeVersion.findMany({
      where: { userId, workspaceId, nodeType, nodeId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        versionNumber: true,
        trigger: true,
        byteSize: true,
        createdAt: true,
        parentVersionId: true,
      },
    });
    const hasMore = versions.length > limit;
    const slice = hasMore ? versions.slice(0, limit) : versions;
    return {
      versions: slice,
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  },

  /**
   * Get a single version by ID. userId-scoped (safety rule 1).
   */
  async getVersion(userId: string, workspaceId: string, versionId: string) {
    return prisma.nodeVersion.findFirst({
      where: { id: versionId, userId, workspaceId },
    });
  },

  /**
   * Flush all pending debounced snapshots. Used for graceful shutdown or
   * test teardown. If userId is provided, only flushes that user's pending
   * snapshots.
   */
  async flushPendingSnapshots(userId?: string): Promise<void> {
    const keys = Array.from(debounceMap.keys());
    const toFlush = userId
      ? keys.filter((k) => k.startsWith(`${userId}:`))
      : keys;
    for (const key of toFlush) {
      const timer = debounceMap.get(key);
      if (timer) clearTimeout(timer);
      debounceMap.delete(key);
      const parts = key.split(":");
      const u = parts[0];
      const nodeType = parts[1] as NodeType;
      const nodeId = parts.slice(2).join(":"); // nodeId could theoretically contain ':'
      // Resolve workspaceId per-user for the flush path (graceful shutdown /
      // test teardown). Best-effort: if resolution fails, the snapshot is lost
      // but the debounce guarantee (EDIT_BLUR fires per session) still holds.
      const wsId = await workspaceContextService
        .resolveDefaultWorkspaceId(u)
        .catch(() => null);
      if (!wsId) {
        console.error("[versioning] flush skipped: no workspaceId", { key });
        continue;
      }
      await versioningService
        .createSnapshot(u, wsId, nodeType, nodeId, "EDIT_BLUR")
        .catch((err) => {
          console.error("[versioning] flush failed", { key, err });
        });
    }
  },

  /**
   * Internal: fetches the live entity by nodeType+nodeId for snapshot
   * serialization. Returns null if the entity does not exist (deleted
   * between schedule and fire) or if the user does not own it.
   *
   * NOTE: Queries Prisma directly (allowed because this IS the service
   * layer). Phase 4 will wire triggers from other services into this one.
   */
  async _fetchEntityPayload(
    userId: string,
    nodeType: NodeType,
    nodeId: string,
  ): Promise<Record<string, unknown> | null> {
    switch (nodeType) {
      case "CONTEXT_ENTRY": {
        const entry = await prisma.contextEntry.findFirst({
          where: { id: nodeId, userId },
          include: { blockDocument: true, category: true },
        });
        if (!entry) return null;
        const { blockDocument, ...rest } = entry;
        return {
          ...rest,
          blockDocumentSnapshot: blockDocument?.snapshot ?? null,
          blockDocumentVersion: blockDocument?.version ?? null,
        } as unknown as Record<string, unknown>;
      }
      case "GOAL": {
        const goal = await prisma.goal.findFirst({
          where: { id: nodeId, userId },
        });
        return goal as unknown as Record<string, unknown> | null;
      }
      case "TODO": {
        const todo = await prisma.todo.findFirst({
          where: { id: nodeId, userId },
        });
        return todo as unknown as Record<string, unknown> | null;
      }
      case "DATABASE_ROW": {
        const row = await prisma.databaseRow.findFirst({
          where: { id: nodeId, userId },
          include: { contextEntry: { include: { blockDocument: true } } },
        });
        if (!row) return null;
        return {
          ...row,
          bodySnapshot: row.contextEntry.blockDocument?.snapshot ?? null,
        } as unknown as Record<string, unknown>;
      }
      case "DATABASE_FIELD": {
        const field = await prisma.databaseField.findFirst({
          where: { id: nodeId, userId },
        });
        return field as unknown as Record<string, unknown> | null;
      }
      default:
        return null;
    }
  },
};
