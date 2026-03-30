import { prisma } from "@/lib/db";
import { VALID_PARENT_HORIZONS } from "@/lib/constants";

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
