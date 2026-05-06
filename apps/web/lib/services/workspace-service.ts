import { prisma } from "@/lib/db";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceRole,
} from "@/lib/validations";
import { permissionService } from "@/lib/services/permission-service";

// ---------------------------------------------------------------------------
// Workspace service
//
// Manages Workspace CRUD. Every method is userId-scoped via membership
// checks (a user can only see/modify workspaces they belong to). The owner
// is tracked both via Workspace.ownerId and via a WorkspaceMembership row
// with role=OWNER.
//
// In Wave 8, every user has exactly one personal workspace created by the
// Phase 1 seed migration. Wave 8b enables multi-workspace per user.
// ---------------------------------------------------------------------------

export const workspaceService = {
  /**
   * Create a new workspace with the user as OWNER.
   *
   * Atomically creates the Workspace row and a WorkspaceMembership row
   * with role=OWNER, status=ACTIVE. Returns the full Workspace row.
   */
  async create(userId: string, input: CreateWorkspaceInput) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug: input.slug,
          ownerId: userId,
        },
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "OWNER",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      return workspace;
    });
  },

  /**
   * Get a workspace by ID, verifying the user is an ACTIVE member.
   *
   * Returns null if the workspace does not exist or the user is not
   * an active member (defense against cross-tenant reads).
   */
  async getById(workspaceId: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    });

    return workspace;
  },

  /**
   * Get a workspace by slug, verifying the user is an ACTIVE member.
   *
   * Same membership check as getById but looks up by the unique slug.
   */
  async getBySlug(slug: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        slug,
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    });

    return workspace;
  },

  /**
   * List all workspaces where the user has an ACTIVE membership.
   *
   * Returns the workspace data plus the user's role and the total count
   * of active members in each workspace.
   */
  async listForUser(
    userId: string,
  ): Promise<
    Array<{
      id: string;
      slug: string;
      name: string;
      ownerId: string;
      createdAt: Date;
      updatedAt: Date;
      myRole: WorkspaceRole;
      memberCount: number;
    }>
  > {
    // Find all active memberships for the user, including the workspace
    // and a count of all active members in each workspace.
    const memberships = await prisma.workspaceMembership.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                memberships: {
                  where: { status: "ACTIVE" },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      slug: m.workspace.slug,
      name: m.workspace.name,
      ownerId: m.workspace.ownerId,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
      myRole: m.role as WorkspaceRole,
      memberCount: m.workspace._count.memberships,
    }));
  },

  /**
   * Update a workspace. OWNER only (MANAGE_WORKSPACE permission).
   *
   * Throws if the user does not have permission or the workspace
   * does not exist.
   */
  async update(
    userId: string,
    workspaceId: string,
    input: UpdateWorkspaceInput,
  ) {
    // Permission check: only OWNER can manage workspace settings
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "MANAGE_WORKSPACE",
    );

    // Verify workspace exists and user is a member
    const existing = await this.getById(workspaceId, userId);
    if (!existing) {
      throw new Error("Workspace not found");
    }

    return prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
      },
    });
  },

  /**
   * Delete a workspace. OWNER only.
   *
   * In Phase 3a, this is unconditionally disabled because users only have
   * one workspace. The route returns 403 with an explanatory message.
   * Wave 8b enables deletion once a user can have more than one workspace.
   */
  async delete(userId: string, workspaceId: string): Promise<void> {
    // Permission check first (even though we throw unconditionally,
    // the permission check ensures the caller is authenticated as OWNER)
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "MANAGE_WORKSPACE",
    );

    throw new Error(
      "Cannot delete the only workspace. Wave 8b enables this once a user has more than one.",
    );
  },

  /**
   * Get the user's default workspace ID.
   *
   * Reads User.defaultWorkspaceId. Used by the auth flow to resolve the
   * workspace at JWT-issue time. Returns null if the user has no default
   * workspace (should not happen post-Phase-1 backfill, but defensive).
   */
  async getUserDefaultWorkspaceId(
    userId: string,
  ): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspaceId: true },
    });

    return user?.defaultWorkspaceId ?? null;
  },
};
