import { prisma } from "@/lib/db";

/**
 * User-level operations: API key lookup, onboarding, and admin counts.
 *
 * Three of the methods here deliberately skip the userId-in-where-clause
 * rule because they either ARE the auth mechanism (findByApiKey) or they
 * already scope by userId as the primary key (markOnboardingComplete),
 * or they are admin-level counts for the health endpoint (countUsers).
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
   * Flip the onboardingComplete flag for the authenticated user.
   */
  async markOnboardingComplete(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { onboardingComplete: true },
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
