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

/**
 * Create a test user with a default workspace and membership.
 *
 * Wave 8 multi-tenancy requires every entity to be scoped to a
 * workspace. This helper creates the User, Workspace,
 * WorkspaceMembership (OWNER/ACTIVE), and sets the user's
 * defaultWorkspaceId so the test user mirrors production state.
 *
 * Returns `{ id, apiKey, workspaceId }`.
 */
export async function createTestUser(prefix: string) {
  const id = `test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const apiKey = `${id}-key`;
  const user = await prisma.user.create({
    data: {
      id,
      apiKey,
      onboardingComplete: true,
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      slug: `test-${user.id.slice(-8)}`,
      name: "Test",
      ownerId: user.id,
    },
  });

  await prisma.workspaceMembership.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { defaultWorkspaceId: workspace.id },
  });

  return { id, apiKey, workspaceId: workspace.id };
}

/**
 * Hard-delete a test user and everything they own. Deletes the
 * workspace first (cascades to memberships and workspace-scoped
 * entities), then deletes the user (cascades to remaining
 * user-scoped entities like UserStats, XpEvent).
 */
export async function deleteTestUser(userId: string) {
  // Delete workspaces owned by this user first (cascade handles
  // memberships and workspace-scoped entities).
  await prisma.workspace
    .deleteMany({ where: { ownerId: userId } })
    .catch(() => {});

  await prisma.user
    .delete({ where: { id: userId } })
    .catch(() => {
      // Ignore: user might already be gone if the test failed mid-flow.
    });
}
