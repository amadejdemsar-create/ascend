import { prisma } from "@/lib/db";

export interface TreeNode {
  id: string;
  title: string;
  parentId: string | null;
  horizon: string;
  progress: number;
  depth: number;
}

/**
 * Get all descendants of a goal using a recursive CTE.
 * Used for progress rollup and cascade operations.
 * Returns descendants only (excludes the starting goal itself).
 */
export async function getDescendants(
  goalId: string,
  userId: string,
): Promise<TreeNode[]> {
  return prisma.$queryRaw<TreeNode[]>`
    WITH RECURSIVE goal_tree AS (
      SELECT id, title, "parentId", horizon::text, progress, 0 as depth
      FROM "Goal"
      WHERE id = ${goalId} AND "userId" = ${userId}
      UNION ALL
      SELECT g.id, g.title, g."parentId", g.horizon::text, g.progress, gt.depth + 1
      FROM "Goal" g
      JOIN goal_tree gt ON g."parentId" = gt.id
    )
    SELECT * FROM goal_tree WHERE depth > 0
    ORDER BY depth, "parentId"
  `;
}

/**
 * Get all ancestors of a goal (for breadcrumb display).
 * Returns ancestors ordered by depth descending (root first).
 * Excludes the starting goal itself.
 */
export async function getAncestors(
  goalId: string,
  userId: string,
): Promise<TreeNode[]> {
  return prisma.$queryRaw<TreeNode[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, title, "parentId", horizon::text, progress, 0 as depth
      FROM "Goal"
      WHERE id = ${goalId} AND "userId" = ${userId}
      UNION ALL
      SELECT g.id, g.title, g."parentId", g.horizon::text, g.progress, a.depth + 1
      FROM "Goal" g
      JOIN ancestors a ON g.id = a."parentId"
    )
    SELECT * FROM ancestors WHERE depth > 0
    ORDER BY depth DESC
  `;
}
