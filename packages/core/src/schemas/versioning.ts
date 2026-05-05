import { z } from "zod";

// ── NodeType enum ────────────────────────────────────────────────────
// Matches the Prisma enum NodeType exactly.

export const NODE_TYPE_VALUES = [
  "CONTEXT_ENTRY",
  "GOAL",
  "TODO",
  "DATABASE_ROW",
  "DATABASE_FIELD",
] as const;

export type NodeType = (typeof NODE_TYPE_VALUES)[number];
export const nodeTypeEnum = z.enum(NODE_TYPE_VALUES);

// ── VersionTrigger enum ──────────────────────────────────────────────
// Matches the Prisma enum VersionTrigger exactly.

export const VERSION_TRIGGER_VALUES = [
  "EDIT_DEBOUNCED",
  "EDIT_BLUR",
  "EDIT_EXPLICIT",
  "RESTORE",
  "BRANCH",
  "BACKFILL",
  "MIGRATION",
] as const;

export type VersionTrigger = (typeof VERSION_TRIGGER_VALUES)[number];
export const versionTriggerEnum = z.enum(VERSION_TRIGGER_VALUES);

// ── EdgeEventType enum ───────────────────────────────────────────────
// Matches the Prisma enum EdgeEventType exactly.

export const EDGE_EVENT_TYPE_VALUES = [
  "CREATED",
  "REMOVED",
  "UPDATED",
] as const;

export type EdgeEventType = (typeof EDGE_EVENT_TYPE_VALUES)[number];
export const edgeEventTypeEnum = z.enum(EDGE_EVENT_TYPE_VALUES);

// ── Query/Body schemas for versioning API routes (Phase 3+) ─────────

/** Tolerant payload schema: actual structure validated by per-type service code */
export const nodeVersionPayloadSchema = z.record(z.string(), z.unknown());

/** Cursor-paginated list of versions for a specific node */
export const listVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});
export type ListVersionsQuery = z.infer<typeof listVersionsQuerySchema>;

/** Request body for diffing two versions */
export const diffVersionsBodySchema = z.object({
  fromVersionId: z.string().nullable(),
  toVersionId: z.string(),
});
export type DiffVersionsBody = z.infer<typeof diffVersionsBodySchema>;

/** Request body for restoring a node to a previous version */
export const restoreVersionBodySchema = z.object({
  versionId: z.string(),
  dryRun: z.boolean().optional(),
});
export type RestoreVersionBody = z.infer<typeof restoreVersionBodySchema>;

/** Request body for branching a node from a specific version */
export const branchNodeBodySchema = z.object({
  versionId: z.string(),
  title: z.string().min(1).max(200),
});
export type BranchNodeBody = z.infer<typeof branchNodeBodySchema>;

/** Query parameter for graph-at-date time-travel */
export const graphAtQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD required"),
});
export type GraphAtQuery = z.infer<typeof graphAtQuerySchema>;
