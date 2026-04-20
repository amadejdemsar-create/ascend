import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import { VALID_PARENT_HORIZONS } from "@/lib/constants";

// Same type used by goal-service.ts so the function works both
// standalone and inside an interactive $transaction.
type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

/**
 * Validates that a parent-child goal relationship follows the hierarchy rules:
 * YEARLY (no parent) > QUARTERLY > MONTHLY > WEEKLY
 *
 * Throws a descriptive error if the relationship is invalid.
 */
export async function validateHierarchy(
  userId: string,
  parentId: string,
  childHorizon: string,
): Promise<void> {
  const expectedParentHorizon = VALID_PARENT_HORIZONS[childHorizon];

  if (expectedParentHorizon === null) {
    throw new Error(`${childHorizon} goals cannot have a parent`);
  }

  if (expectedParentHorizon === undefined) {
    throw new Error(`Unknown horizon: ${childHorizon}`);
  }

  const parent = await prisma.goal.findFirst({
    where: { id: parentId, userId },
  });

  if (!parent) {
    throw new Error("Parent goal not found");
  }

  if (parent.horizon !== expectedParentHorizon) {
    throw new Error(
      `A ${childHorizon} goal must have a ${expectedParentHorizon} parent, ` +
      `but the specified parent is ${parent.horizon}`,
    );
  }
}

/**
 * Recalculate a parent goal's progress based on the completion ratio of
 * its children, then recurse upward through the hierarchy.
 *
 * Skips goals that have a `targetValue` set because those use
 * user-controlled progress via ProgressLog increments.
 *
 * Accepts a Prisma client so it participates in the caller's
 * transaction when invoked from completeWithSideEffects.
 */
export async function recalcParentProgress(
  userId: string,
  goalId: string,
  client: PrismaClientLike,
): Promise<void> {
  const goal = await client.goal.findFirst({
    where: { id: goalId, userId },
    select: { parentId: true },
  });

  if (!goal?.parentId) return;

  const parent = await client.goal.findFirst({
    where: { id: goal.parentId, userId },
    include: {
      children: { select: { id: true, status: true } },
    },
  });

  if (!parent) return;

  // Do not overwrite user-controlled progress on goals with a targetValue.
  if (parent.targetValue !== null) return;

  const totalChildren = parent.children.length;
  if (totalChildren === 0) return;

  const completedCount = parent.children.filter(
    (c) => c.status === "COMPLETED",
  ).length;

  const progress = Math.round((completedCount / totalChildren) * 100);

  await client.goal.update({
    where: { id: parent.id },
    data: { progress },
  });

  // Propagate upward through the hierarchy.
  await recalcParentProgress(userId, parent.id, client);
}
