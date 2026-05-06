/**
 * Graph History Service — graph-at-date dispatcher.
 *
 * Provides a single entry point for querying the context graph at any
 * historical date. Dispatches to:
 * - contextService.getGraph() for today/future dates (live state)
 * - GraphDailySnapshot table for historical dates (precomputed)
 *
 * The 90-day window matches the retention policy: snapshots older than
 * 90 days may have been pruned.
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import { contextService } from "./context-service";

// ── Types ────────────���───────────────────────────────────────────────

export type GraphAtResult = {
  nodes: unknown[];
  edges: unknown[];
  source: "live" | "snapshot";
  snapshotDate?: string;
};

// ── Custom error codes ────��──────────────────────────────────────────

export class GraphHistoryError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "GraphHistoryError";
    this.code = code;
  }
}

// ── Service ──────────────���──────────────────────���────────────────────

export const graphHistoryService = {
  /**
   * Get the context graph at a specific date.
   *
   * - If date >= start of today UTC: returns the live graph via contextService.
   * - If date < today and a snapshot exists: returns the precomputed snapshot.
   * - If date < today and no snapshot exists:
   *   - Within 90 days: throws NOT_FOUND (snapshot not yet computed)
   *   - Older than 90 days: throws GONE (outside retention window)
   */
  async getGraphAt(userId: string, workspaceId: string, date: Date): Promise<GraphAtResult> {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    if (date >= todayUtc) {
      const graph = await contextService.getGraph(userId, workspaceId);
      return {
        nodes: graph.nodes,
        edges: graph.edges,
        source: "live",
      };
    }

    // Normalize the requested date to UTC midnight for snapshot lookup
    const snapshotDate = new Date(date);
    snapshotDate.setUTCHours(0, 0, 0, 0);

    const snapshot = await prisma.graphDailySnapshot.findFirst({
      where: { userId, workspaceId, snapshotDate },
    });

    if (!snapshot) {
      const ninetyDaysAgo = new Date(todayUtc);
      ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

      if (snapshotDate < ninetyDaysAgo) {
        throw new GraphHistoryError(
          "Snapshot date is outside the 90-day retention window",
          "GONE_410",
        );
      }

      throw new GraphHistoryError(
        "Snapshot not yet computed for this date. Try again after the nightly precompute runs.",
        "NOT_FOUND_404",
      );
    }

    return {
      nodes: snapshot.nodes as unknown[],
      edges: snapshot.edges as unknown[],
      source: "snapshot",
      snapshotDate: snapshotDate.toISOString().split("T")[0],
    };
  },
};
