/**
 * Graph Snapshot Service — nightly precomputation of graph-at-date.
 *
 * Materializes the context graph (nodes + edges) as it existed at a given
 * date into the GraphDailySnapshot table. This precomputed view supports
 * time-travel queries and graph playback without running expensive replay
 * logic at query time.
 *
 * Algorithm:
 * 1. For nodes: picks the latest NodeVersion per ContextEntry with
 *    createdAt < (date + 1 day). Entries without any version at that
 *    date are skipped (they didn't exist yet).
 * 2. For edges: replays EdgeEvent rows up to the cutoff to determine
 *    which links existed at that date.
 *
 * Called nightly by a cron endpoint (Phase 5) for all users, producing
 * yesterday's snapshot. Idempotent via upsert on (userId, snapshotDate).
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import { edgeEventService } from "./edge-event-service";
import { workspaceContextService } from "./workspace-context-service";

// ── Constants ────────────��───────────────────────────────────────────

/** Matches DB CHECK constraint on GraphDailySnapshot payload size */
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024; // 5 MiB

// ── Service ─────────────────────────────────���────────────────────────

export const graphSnapshotService = {
  /**
   * Precompute the daily graph snapshot for a specific user and date.
   * Idempotent: upserts on (userId, snapshotDate).
   *
   * Returns the upserted snapshot record, or null if the snapshot
   * exceeds the 5 MiB size cap.
   */
  async precomputeDailySnapshot(
    userId: string,
    workspaceId: string,
    date: Date,
  ): Promise<{ id: string } | null> {
    const snapshotDate = new Date(date);
    snapshotDate.setUTCHours(0, 0, 0, 0);
    const cutoff = new Date(snapshotDate);
    cutoff.setUTCDate(cutoff.getUTCDate() + 1); // exclusive upper bound

    // ── Build nodes from latest version per ContextEntry ─────────────
    // For each ContextEntry owned by user in this workspace: pick the
    // latest NodeVersion with createdAt < cutoff.
    const versions = await prisma.$queryRaw<
      Array<{ nodeId: string; payload: unknown }>
    >`
      SELECT DISTINCT ON ("nodeId") "nodeId", "payload"
      FROM "NodeVersion"
      WHERE "userId" = ${userId}
        AND "workspaceId" = ${workspaceId}
        AND "nodeType" = 'CONTEXT_ENTRY'
        AND "createdAt" < ${cutoff}
      ORDER BY "nodeId", "versionNumber" DESC
    `;

    const nodes = versions.map((v) => {
      const p = v.payload as Record<string, unknown>;
      return {
        id: v.nodeId,
        label: (p.title as string | null) ?? "(untitled)",
        type: (p.type as string | null) ?? "NOTE",
        categoryId: (p.categoryId as string | null) ?? null,
      };
    });

    // ── Build edges by replaying EdgeEvent log ──────────��────────────
    // Replay all events up to cutoff. A link is "alive" if its last
    // event was CREATED or UPDATED (not REMOVED).
    const events = await edgeEventService.listEventsBeforeCutoff(
      userId,
      workspaceId,
      cutoff,
    );

    const linkState = new Map<
      string,
      {
        fromEntryId: string | null;
        toEntryId: string | null;
        type: string;
        alive: boolean;
      }
    >();

    for (const ev of events) {
      const snap = ev.linkSnapshot as Record<string, unknown>;
      // Extract the link ID from the snapshot
      let linkId: string | undefined;
      if (ev.eventType === "UPDATED") {
        // Updated events store { before, after }
        const after = (snap as { after?: Record<string, unknown> }).after;
        linkId = (after?.id as string | undefined) ?? (snap.id as string | undefined);
      } else {
        linkId = snap.id as string | undefined;
      }
      if (!linkId) continue;

      if (ev.eventType === "CREATED") {
        linkState.set(linkId, {
          fromEntryId: ev.fromEntryId,
          toEntryId: ev.toEntryId,
          type: String(snap.type ?? "REFERENCES"),
          alive: true,
        });
      } else if (ev.eventType === "REMOVED") {
        const existing = linkState.get(linkId);
        if (existing) {
          existing.alive = false;
        } else {
          // Link was created before event logging started; mark as removed
          linkState.set(linkId, {
            fromEntryId: ev.fromEntryId,
            toEntryId: ev.toEntryId,
            type: "REFERENCES",
            alive: false,
          });
        }
      } else if (ev.eventType === "UPDATED") {
        const after = (snap as { after?: Record<string, unknown> }).after;
        if (after) {
          linkState.set(linkId, {
            fromEntryId: ev.fromEntryId,
            toEntryId: ev.toEntryId,
            type: String(after.type ?? "REFERENCES"),
            alive: true,
          });
        }
      }
    }

    const edges = Array.from(linkState.entries())
      .filter(([, s]) => s.alive && s.fromEntryId && s.toEntryId)
      .map(([id, s]) => ({
        id,
        fromId: s.fromEntryId,
        toId: s.toEntryId,
        type: s.type,
      }));

    // ─�� Size cap check ───────────────────────────────────────────────
    const nodesJson = JSON.stringify(nodes);
    const edgesJson = JSON.stringify(edges);
    const totalBytes =
      Buffer.byteLength(nodesJson, "utf8") +
      Buffer.byteLength(edgesJson, "utf8");

    if (totalBytes > MAX_SNAPSHOT_BYTES) {
      console.error("[graph-snapshot] daily snapshot exceeds 5 MiB; skipping", {
        userId,
        date: snapshotDate.toISOString(),
        totalBytes,
      });
      return null;
    }

    // ── Upsert ──────────────────────────────────────────���────────────
    const upserted = await prisma.graphDailySnapshot.upsert({
      where: { userId_snapshotDate: { userId, snapshotDate } },
      update: {
        workspaceId,
        nodes: nodes as never,
        edges: edges as never,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
      create: {
        userId,
        workspaceId,
        snapshotDate,
        nodes: nodes as never,
        edges: edges as never,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
      select: { id: true },
    });
    return upserted;
  },

  /**
   * Precompute daily snapshots for ALL users for yesterday.
   * Called by the nightly cron endpoint.
   */
  /**
   * Precompute daily snapshots for ALL users for yesterday.
   * Called by the nightly cron endpoint.
   *
   * Cron-driven: iterates users and resolves workspaceId per-user via
   * User.defaultWorkspaceId (or workspaceContextService fallback).
   */
  async precomputeAllForYesterday(): Promise<{
    usersProcessed: number;
    snapshotsWritten: number;
  }> {
    const yesterday = new Date();
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const users = await prisma.user.findMany({
      select: { id: true, defaultWorkspaceId: true },
    });
    let snapshotsWritten = 0;

    for (const u of users) {
      // Resolve workspaceId: primary from User.defaultWorkspaceId, fallback
      // via workspaceContextService.
      const wsId =
        u.defaultWorkspaceId ??
        (await workspaceContextService
          .resolveDefaultWorkspaceId(u.id)
          .catch(() => null));
      if (!wsId) {
        console.error("[graph-snapshot] no workspaceId for user; skipping", {
          userId: u.id,
        });
        continue;
      }
      const result = await this.precomputeDailySnapshot(u.id, wsId, yesterday).catch(
        (err) => {
          console.error("[graph-snapshot] failed for user", {
            userId: u.id,
            err,
          });
          return null;
        },
      );
      if (result) snapshotsWritten++;
    }

    return { usersProcessed: users.length, snapshotsWritten };
  },
};
