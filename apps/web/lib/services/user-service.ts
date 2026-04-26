import { prisma } from "@/lib/db";

/**
 * User-level operations: API key lookup, email lookup, password management,
 * onboarding, and admin counts.
 *
 * Several methods here deliberately skip the userId-in-where-clause rule
 * because they either ARE the auth mechanism (findByApiKey, findByEmail,
 * findById) or they already scope by userId as the primary key
 * (markOnboardingComplete, setPassword), or they are admin-level counts
 * for the health endpoint (countUsers).
 */
export const userService = {
  /**
   * Look up a user by API key. Used by the auth middleware; the apiKey
   * itself is the identifier, so there is no cross-tenant concern.
   * Returns null if no user matches.
   */
  async findByApiKey(apiKey: string) {
    return prisma.user.findUnique({ where: { apiKey } });
  },

  /**
   * Look up a user by email. Used by the login flow; the email is the
   * query input (already normalized by Zod), so there is no cross-tenant
   * concern.
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  /**
   * Look up a user by primary key. Used by auth rotation (to fetch
   * user.email for the new access token) and the /api/auth/me route.
   */
  async findById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  /**
   * Update the user's password hash. Used exclusively by the CLI seed
   * script (scripts/set-password.ts). The userId is the primary key,
   * so no additional scoping is needed.
   */
  async setPassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  /**
   * Flip the onboardingComplete flag for the authenticated user.
   */
  async markOnboardingComplete(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { onboardingComplete: true },
    });
  },

  /**
   * Find the first user who has at least one context entry.
   * Used by the cron path of /api/context/map/refresh to determine which
   * user to generate a map for in a single-user deployment.
   *
   * No userId parameter because this runs in an unauthenticated (cron-secret)
   * context. The query does not expose user data beyond the ID.
   */
  async findFirstWithContextEntries() {
    return prisma.user.findFirst({
      where: { contextEntries: { some: {} } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * Total user count. For the public health endpoint.
   */
  async countUsers() {
    return prisma.user.count();
  },

  /**
   * Total UserStats row count. For the public health endpoint.
   */
  async countUserStats() {
    return prisma.userStats.count();
  },
};
