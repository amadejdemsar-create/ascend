/**
 * Test helpers for service-layer integration tests.
 *
 * These tests hit a real local Postgres database via the generated
 * Prisma client. Each test uses a unique userId so concurrent state
 * doesn't leak, and cleanup runs in afterAll.
 *
 * The CLAUDE.md feedback rule says "don't mock the database in these
 * tests" — we go through the same service layer call path as the
 * production API so that schema drift, userId scoping, and raw SQL
 * side effects are all exercised end to end.
 */

import { prisma } from "@/lib/db";

export async function createTestUser(prefix: string) {
  const id = `test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const apiKey = `${id}-key`;
  await prisma.user.create({
    data: {
      id,
      apiKey,
      onboardingComplete: true,
    },
  });
  return { id, apiKey };
}

/**
 * Hard-delete a test user and everything they own. Uses onDelete:
 * Cascade on the User relation to clean up Goal, Todo, ContextEntry,
 * Category, UserStats, XpEvent in one shot.
 */
export async function deleteTestUser(userId: string) {
  await prisma.user
    .delete({ where: { id: userId } })
    .catch(() => {
      // Ignore: user might already be gone if the test failed mid-flow.
    });
}
