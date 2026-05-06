import { prisma } from "@/lib/db";
import type { WorkspaceRole, MembershipStatus } from "@/lib/validations";
import { permissionService } from "@/lib/services/permission-service";

// ---------------------------------------------------------------------------
// Workspace membership service
//
// Manages the WorkspaceMembership join table between User and Workspace.
// In Wave 8, only OWNER + ACTIVE memberships exist (created during workspace
// creation). Wave 8b adds invitations (PENDING), multi-member workflows,
// and the UI surfaces for updateRole and remove.
// ---------------------------------------------------------------------------

export const workspaceMembershipService = {
  /**
   * Add a member to a workspace.
   *
   * In Phase 3a this is only called during workspace creation (role=OWNER).
   * Wave 8b extends this for invitation acceptance.
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    options?: { status?: MembershipStatus },
  ) {
    return prisma.workspaceMembership.create({
      data: {
        workspaceId,
        userId,
        role,
        status: options?.status ?? "ACTIVE",
        acceptedAt: options?.status === "ACTIVE" ? new Date() : undefined,
      },
    });
  },

  /**
   * Get a user's active role in a workspace.
   *
   * Returns the WorkspaceRole string if the user has an ACTIVE membership,
   * or null if no active membership exists.
   */
  async getRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | null> {
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId,
        status: "ACTIVE",
      },
      select: { role: true },
    });

    if (!membership) return null;
    return membership.role as WorkspaceRole;
  },

  /**
   * List all members of a workspace with enriched user data.
   *
   * Returns displayName (from User.name), role, status, and joinedAt.
   * Per PRD Open Question 4, email is NOT returned.
   */
  async listMembers(
    workspaceId: string,
  ): Promise<
    Array<{
      userId: string;
      displayName: string | null;
      role: WorkspaceRole;
      status: MembershipStatus;
      joinedAt: Date;
    }>
  > {
    const memberships = await prisma.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      userId: m.user.id,
      displayName: m.user.name,
      role: m.role as WorkspaceRole,
      status: m.status as MembershipStatus,
      joinedAt: m.createdAt,
    }));
  },

  /**
   * Update a member's role.
   *
   * The actor must have MANAGE_MEMBERS permission. Cannot change the OWNER's
   * own role (prevents lockout). In Phase 3a, never invoked through any
   * route; the method exists for Wave 8b.
   */
  async updateRole(
    actorUserId: string,
    workspaceId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
  ) {
    // Permission check: actor must be able to manage members
    await permissionService.assertCanPerform(
      actorUserId,
      workspaceId,
      "MANAGE_MEMBERS",
    );

    // Prevent OWNER from demoting themselves (lockout prevention)
    const targetMembership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: targetUserId,
        status: "ACTIVE",
      },
    });

    if (!targetMembership) {
      throw new Error("Target user is not an active member of this workspace");
    }

    if (
      targetUserId === actorUserId &&
      targetMembership.role === "OWNER"
    ) {
      throw new Error(
        "Cannot change your own role from OWNER. Transfer ownership first.",
      );
    }

    return prisma.workspaceMembership.update({
      where: { id: targetMembership.id },
      data: { role: newRole },
    });
  },

  /**
   * Remove a member from a workspace (soft remove).
   *
   * Sets status to REMOVED and records removedAt timestamp. The actor must
   * have MANAGE_MEMBERS permission. Cannot remove the OWNER. In Phase 3a,
   * never invoked through any route; the method exists for Wave 8b.
   */
  async remove(
    actorUserId: string,
    workspaceId: string,
    targetUserId: string,
  ): Promise<void> {
    // Permission check: actor must be able to manage members
    await permissionService.assertCanPerform(
      actorUserId,
      workspaceId,
      "MANAGE_MEMBERS",
    );

    const targetMembership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: targetUserId,
        status: "ACTIVE",
      },
    });

    if (!targetMembership) {
      throw new Error("Target user is not an active member of this workspace");
    }

    if (targetMembership.role === "OWNER") {
      throw new Error(
        "Cannot remove the workspace owner. Transfer ownership first.",
      );
    }

    await prisma.workspaceMembership.update({
      where: { id: targetMembership.id },
      data: {
        status: "REMOVED",
        removedAt: new Date(),
      },
    });
  },
};
