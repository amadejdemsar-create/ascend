import { z } from "zod";

// ── WorkspaceRole enum ──────────────────────────────────────────────
// Matches the Prisma enum WorkspaceRole exactly.

export const WORKSPACE_ROLE_VALUES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "VIEWER",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLE_VALUES)[number];
export const workspaceRoleEnum = z.enum(WORKSPACE_ROLE_VALUES);

// ── MembershipStatus enum ───────────────────────────────────────────
// Matches the Prisma enum MembershipStatus exactly.

export const MEMBERSHIP_STATUS_VALUES = [
  "PENDING",
  "ACTIVE",
  "REMOVED",
] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS_VALUES)[number];
export const membershipStatusEnum = z.enum(MEMBERSHIP_STATUS_VALUES);

// ── Workspace schemas ───────────────────────────────────────────────

/** Full Workspace row shape */
export const workspaceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

/** Input for creating a new workspace */
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/** Input for updating an existing workspace */
export const updateWorkspaceSchema = createWorkspaceSchema.partial();
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// ── WorkspaceMembership schemas ─────────────────────────────────────

/** Full WorkspaceMembership row shape */
export const workspaceMembershipSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  role: workspaceRoleEnum,
  status: membershipStatusEnum,
  invitedAt: z.coerce.date().nullable(),
  acceptedAt: z.coerce.date().nullable(),
  removedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WorkspaceMembership = z.infer<typeof workspaceMembershipSchema>;
