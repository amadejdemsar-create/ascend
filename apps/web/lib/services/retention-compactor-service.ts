/**
 * Retention Compactor Service — version retention policy enforcement.
 *
 * Applies a tiered retention policy to NodeVersion rows per user:
 * - Last 30 days: keep ALL versions (full fidelity)
 * - Days 31 to 60: keep 1 per UTC-day (daily granularity)
 * - Older than 60 days: keep 1 per ISO week (Monday-anchored)
 *
 * The compaction is per (userId, nodeType, nodeId) group. Within each
 * group, versions are walked from newest to oldest. The "keeper" for
 * each day/week bucket is the NEWEST version in that bucket (closest
 * to real-time for that period).
 *
 * Bulk deletes use raw SQL with userId guard for defense-in-depth.
 * Called nightly by a cron endpoint alongside graph-snapshot precompute.
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";

// ── Constants ────────────────────────────────────────────────────────

/** Keep all versions from the last 30 days */
const FRESH_DAYS = 30;
/** Keep 1 per day for days 31 to 60 */
const DAILY_DAYS = 30;
/** Anything older than 60 days: keep 1 per ISO week */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Service ──────────────────────────────────────────────────────────

export const retentionCompactorService = {
  /**
   * Compact NodeVersion rows for a single user. Groups versions by
   * (nodeType, nodeId), applies the tiered retention policy, and bulk-
   * deletes surplus versions.
   *
   * Returns the total number of versions deleted.
   */
  async compactUserVersions(userId: string): Promise<{ deleted: number }> {
    const now = new Date();
    const freshCutoff = new Date(now.getTime() - FRESH_DAYS * MS_PER_DAY);
    const dailyCutoff = new Date(
      now.getTime() - (FRESH_DAYS + DAILY_DAYS) * MS_PER_DAY,
    );

    // Get distinct (nodeType, nodeId) groups for this user
    const groups = await prisma.$queryRaw<
      Array<{ nodeType: string; nodeId: string }>
    >`
      SELECT DISTINCT "nodeType", "nodeId"
      FROM "NodeVersion"
      WHERE "userId" = ${userId}
    `;

    let totalDeleted = 0;

    for (const { nodeType, nodeId } of groups) {
      // Fetch all versions for this node, newest first
      const versions = await prisma.nodeVersion.findMany({
        where: { userId, nodeType: nodeType as never, nodeId },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      });

      const keep = new Set<string>();
      const seenDay = new Set<string>();
      const seenWeek = new Set<string>();

      for (const v of versions) {
        if (v.createdAt >= freshCutoff) {
          // Fresh: keep all
          keep.add(v.id);
          continue;
        }
        if (v.createdAt >= dailyCutoff) {
          // Daily tier: keep the newest per UTC day
          const dayKey = utcDayKey(v.createdAt);
          if (!seenDay.has(dayKey)) {
            seenDay.add(dayKey);
            keep.add(v.id);
          }
          continue;
        }
        // Weekly tier: keep the newest per ISO week (Monday-anchored)
        const weekKey = isoWeekKey(v.createdAt);
        if (!seenWeek.has(weekKey)) {
          seenWeek.add(weekKey);
          keep.add(v.id);
        }
      }

      const toDelete = versions
        .filter((v) => !keep.has(v.id))
        .map((v) => v.id);

      if (toDelete.length > 0) {
        // Bulk delete with userId guard for defense-in-depth
        const result = await prisma.$executeRaw`
          DELETE FROM "NodeVersion"
          WHERE "id" = ANY(${toDelete}::text[])
            AND "userId" = ${userId}
        `;
        totalDeleted += Number(result);
      }
    }

    return { deleted: totalDeleted };
  },

  /**
   * Compact all users' versions. Called by the nightly cron.
   * Processes each user independently; a single user's failure
   * does not abort the entire batch.
   */
  async compactAllUsers(): Promise<{
    usersProcessed: number;
    totalDeleted: number;
  }> {
    const users = await prisma.user.findMany({ select: { id: true } });
    let totalDeleted = 0;

    for (const u of users) {
      const result = await this.compactUserVersions(u.id).catch((err) => {
        console.error("[retention] compaction failed for user", {
          userId: u.id,
          err,
        });
        return { deleted: 0 };
      });
      totalDeleted += result.deleted;
    }

    return { usersProcessed: users.length, totalDeleted };
  },
};

// ── Private helpers ──────────────────────────────────────────────────

/**
 * UTC day key for grouping: "YYYY-MM-DD"
 */
function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * ISO week key (Monday-anchored): "YYYY-WNN"
 *
 * Uses the ISO 8601 week-numbering algorithm:
 * - Week 1 is the week containing the first Thursday of the year.
 * - Weeks start on Monday.
 */
function isoWeekKey(date: Date): string {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
  const dayNum = target.getUTCDay() || 7; // Convert Sunday from 0 to 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  // Get first day of year for the week-year
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  // Calculate full weeks between yearStart and the Thursday
  const weekNumber = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}
