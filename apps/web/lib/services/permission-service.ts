import { prisma } from "@/lib/db";
import type { PermissionAction, WorkspaceRole } from "@/lib/validations";

// ---------------------------------------------------------------------------
// Permission service: single source of truth for workspace-level RBAC.
//
// Wave 8 implements the role hierarchy: OWNER > ADMIN > EDITOR > VIEWER.
// Wave 8b extends with per-node permission overrides via a NodePermission
// table; this service is the only code that needs to change when that lands.
// ---------------------------------------------------------------------------

/**
 * Role-to-action permission matrix.
 *
 * OWNER can do everything. Each lower role is a strict subset.
 * The matrix is evaluated at runtime; no database round-trip needed
 * beyond the initial membership lookup.
 */
const ROLE_PERMISSION_MATRIX: Record<
  WorkspaceRole,
  ReadonlyArray<PermissionAction>
> = {
  OWNER: [
    "READ_NODE",
    "WRITE_NODE",
    "DELETE_NODE",
    "MANAGE_MEMBERS",
    "MANAGE_WORKSPACE",
  ],
  ADMIN: ["READ_NODE", "WRITE_NODE", "DELETE_NODE", "MANAGE_MEMBERS"],
  EDITOR: ["READ_NODE", "WRITE_NODE", "DELETE_NODE"],
  VIEWER: ["READ_NODE"],
};

export const permissionService = {
  /**
   * Check whether a user can perform an action in a workspace.
   *
   * Resolves the user's ACTIVE membership role, then checks the static
   * permission matrix. Returns false if the user has no active membership
   * or the role does not include the requested action.
   */
  async canPerform(
    userId: string,
    workspaceId: string,
    action: PermissionAction,
  ): Promise<boolean> {
    const role = await this._getActiveRole(userId, workspaceId);
    if (!role) return false;
    return this._roleAllowsAction(role, action);
  },

  /**
   * Assert that a user can perform an action. Throws with "Permission denied"
   * if the check fails. The message prefix is recognized by handleApiError
   * in lib/auth.ts to produce a 403 response.
   */
  async assertCanPerform(
    userId: string,
    workspaceId: string,
    action: PermissionAction,
  ): Promise<void> {
    const ok = await this.canPerform(userId, workspaceId, action);
    if (!ok) {
      throw new Error(
        `Permission denied: action ${action} in workspace ${workspaceId}`,
      );
    }
  },

  // -----------------------------------------------------------------------
  // Internal helpers (prefixed with _ by convention, not truly private
  // because const-object services are flat).
  // -----------------------------------------------------------------------

  /**
   * Look up the user's active role in a workspace.
   *
   * Returns the WorkspaceRole if the user has an ACTIVE membership,
   * or null otherwise. The query hits the unique composite index
   * (workspaceId, userId) plus filters on status=ACTIVE.
   *
   * No request-scoped memoization in Phase 3a. The indexed lookup is
   * sub-millisecond for a single-user system. Phase 3b may add a
   * per-request Map if profiling shows contention under multi-user load.
   */
  async _getActiveRole(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceRole | null> {
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        status: "ACTIVE",
      },
      select: { role: true },
    });

    if (!membership) return null;

    // Prisma returns the enum as a string matching our WorkspaceRole type.
    return membership.role as WorkspaceRole;
  },

  /**
   * Check whether a role includes a specific action in the static matrix.
   */
  _roleAllowsAction(role: WorkspaceRole, action: PermissionAction): boolean {
    return ROLE_PERMISSION_MATRIX[role].includes(action);
  },
};
