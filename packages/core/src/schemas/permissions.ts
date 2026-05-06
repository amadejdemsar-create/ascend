import { z } from "zod";

// ── PermissionAction enum ───────────────────────────────────────────
// Actions that can be checked via permissionService.canPerform().
// Wave 8 implements the skeleton; Wave 8b extends with per-node overrides.

export const PERMISSION_ACTION_VALUES = [
  "READ_NODE",
  "WRITE_NODE",
  "DELETE_NODE",
  "MANAGE_MEMBERS",
  "MANAGE_WORKSPACE",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTION_VALUES)[number];
export const permissionActionEnum = z.enum(PERMISSION_ACTION_VALUES);
