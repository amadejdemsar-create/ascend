import { z } from "zod";
import { workspaceRoleEnum } from "./workspaces";

// ── ActivityEventType enum ──────────────────────────────────────────
// Matches the Prisma enum ActivityEventType exactly.

export const ACTIVITY_EVENT_TYPE_VALUES = [
  "WORKSPACE_CREATED",
  "MEMBER_ADDED",
  "MEMBER_REMOVED",
  "MEMBER_ROLE_CHANGED",
  "NODE_CREATED",
  "NODE_DELETED",
  "NODE_UPDATED",
  "NODE_RESTORED",
  "NODE_BRANCHED",
  "LINK_CREATED",
  "LINK_REMOVED",
  "CANVAS_LAYOUT_CREATED",
  "CANVAS_LAYOUT_DELETED",
  "CANVAS_NODE_ADDED",
  "CANVAS_NODE_REMOVED",
  // Wave 10: Extensibility
  "MCP_SERVER_CONNECTED",
  "MCP_SERVER_DISCONNECTED",
  "EXTERNAL_SOURCE_CONNECTED",
  "EXTERNAL_SOURCE_DISCONNECTED",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPE_VALUES)[number];
export const activityEventTypeEnum = z.enum(ACTIVITY_EVENT_TYPE_VALUES);

// ── Per-event-type payload schemas ──────────────────────────────────

export const workspaceCreatedPayloadSchema = z.object({
  eventType: z.literal("WORKSPACE_CREATED"),
  workspaceName: z.string(),
});
export type WorkspaceCreatedPayload = z.infer<
  typeof workspaceCreatedPayloadSchema
>;

export const memberAddedPayloadSchema = z.object({
  eventType: z.literal("MEMBER_ADDED"),
  memberUserId: z.string(),
  memberDisplayName: z.string(),
  role: workspaceRoleEnum.optional(),
});
export type MemberAddedPayload = z.infer<typeof memberAddedPayloadSchema>;

export const memberRemovedPayloadSchema = z.object({
  eventType: z.literal("MEMBER_REMOVED"),
  memberUserId: z.string(),
  memberDisplayName: z.string(),
});
export type MemberRemovedPayload = z.infer<typeof memberRemovedPayloadSchema>;

export const memberRoleChangedPayloadSchema = z.object({
  eventType: z.literal("MEMBER_ROLE_CHANGED"),
  memberUserId: z.string(),
  memberDisplayName: z.string(),
  role: workspaceRoleEnum,
  previousRole: workspaceRoleEnum,
});
export type MemberRoleChangedPayload = z.infer<
  typeof memberRoleChangedPayloadSchema
>;

export const nodeCreatedPayloadSchema = z.object({
  eventType: z.literal("NODE_CREATED"),
  nodeType: z.string(),
  nodeId: z.string(),
  title: z.string(),
});
export type NodeCreatedPayload = z.infer<typeof nodeCreatedPayloadSchema>;

export const nodeDeletedPayloadSchema = z.object({
  eventType: z.literal("NODE_DELETED"),
  nodeType: z.string(),
  nodeId: z.string(),
  title: z.string(),
});
export type NodeDeletedPayload = z.infer<typeof nodeDeletedPayloadSchema>;

export const nodeUpdatedPayloadSchema = z.object({
  eventType: z.literal("NODE_UPDATED"),
  nodeType: z.string(),
  nodeId: z.string(),
  title: z.string(),
  /** Optional summary of what changed, e.g. "status", "title", "completed". */
  summary: z.string().optional(),
});
export type NodeUpdatedPayload = z.infer<typeof nodeUpdatedPayloadSchema>;

export const nodeRestoredPayloadSchema = z.object({
  eventType: z.literal("NODE_RESTORED"),
  nodeType: z.string(),
  nodeId: z.string(),
  restoredFromVersionId: z.string(),
  title: z.string(),
});
export type NodeRestoredPayload = z.infer<typeof nodeRestoredPayloadSchema>;

export const nodeBranchedPayloadSchema = z.object({
  eventType: z.literal("NODE_BRANCHED"),
  sourceNodeType: z.string(),
  sourceNodeId: z.string(),
  newNodeId: z.string(),
  title: z.string(),
});
export type NodeBranchedPayload = z.infer<typeof nodeBranchedPayloadSchema>;

export const linkCreatedPayloadSchema = z.object({
  eventType: z.literal("LINK_CREATED"),
  linkType: z.string(),
  fromEntryId: z.string(),
  toEntryId: z.string(),
  fromTitle: z.string().optional(),
  toTitle: z.string().optional(),
});
export type LinkCreatedPayload = z.infer<typeof linkCreatedPayloadSchema>;

export const linkRemovedPayloadSchema = z.object({
  eventType: z.literal("LINK_REMOVED"),
  linkType: z.string(),
  fromEntryId: z.string(),
  toEntryId: z.string(),
  fromTitle: z.string().optional(),
  toTitle: z.string().optional(),
});
export type LinkRemovedPayload = z.infer<typeof linkRemovedPayloadSchema>;

// ── Wave 9: Canvas activity payloads ────────────────────────────────

export const canvasLayoutCreatedPayloadSchema = z.object({
  eventType: z.literal("CANVAS_LAYOUT_CREATED"),
  layoutId: z.string(),
  layoutName: z.string(),
});
export type CanvasLayoutCreatedPayload = z.infer<
  typeof canvasLayoutCreatedPayloadSchema
>;

export const canvasLayoutDeletedPayloadSchema = z.object({
  eventType: z.literal("CANVAS_LAYOUT_DELETED"),
  layoutId: z.string(),
  layoutName: z.string(),
});
export type CanvasLayoutDeletedPayload = z.infer<
  typeof canvasLayoutDeletedPayloadSchema
>;

export const canvasNodeAddedPayloadSchema = z.object({
  eventType: z.literal("CANVAS_NODE_ADDED"),
  layoutId: z.string(),
  layoutName: z.string(),
  contextEntryId: z.string(),
  entryTitle: z.string(),
});
export type CanvasNodeAddedPayload = z.infer<
  typeof canvasNodeAddedPayloadSchema
>;

export const canvasNodeRemovedPayloadSchema = z.object({
  eventType: z.literal("CANVAS_NODE_REMOVED"),
  layoutId: z.string(),
  layoutName: z.string(),
  contextEntryId: z.string(),
  entryTitle: z.string(),
});
export type CanvasNodeRemovedPayload = z.infer<
  typeof canvasNodeRemovedPayloadSchema
>;

// Wave 10: Extensibility payloads

export const mcpServerConnectedPayloadSchema = z.object({
  eventType: z.literal("MCP_SERVER_CONNECTED"),
  connectionId: z.string(),
  name: z.string(),
  slug: z.string(),
  transport: z.string(),
});
export type McpServerConnectedPayload = z.infer<
  typeof mcpServerConnectedPayloadSchema
>;

export const mcpServerDisconnectedPayloadSchema = z.object({
  eventType: z.literal("MCP_SERVER_DISCONNECTED"),
  connectionId: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type McpServerDisconnectedPayload = z.infer<
  typeof mcpServerDisconnectedPayloadSchema
>;

export const externalSourceConnectedPayloadSchema = z.object({
  eventType: z.literal("EXTERNAL_SOURCE_CONNECTED"),
  sourceId: z.string(),
  provider: z.string(),
  name: z.string(),
});
export type ExternalSourceConnectedPayload = z.infer<
  typeof externalSourceConnectedPayloadSchema
>;

export const externalSourceDisconnectedPayloadSchema = z.object({
  eventType: z.literal("EXTERNAL_SOURCE_DISCONNECTED"),
  sourceId: z.string(),
  provider: z.string(),
  name: z.string(),
});
export type ExternalSourceDisconnectedPayload = z.infer<
  typeof externalSourceDisconnectedPayloadSchema
>;

// ── Discriminated union of all event payloads ───────────────────────

export const activityEventPayloadSchema = z.discriminatedUnion("eventType", [
  workspaceCreatedPayloadSchema,
  memberAddedPayloadSchema,
  memberRemovedPayloadSchema,
  memberRoleChangedPayloadSchema,
  nodeCreatedPayloadSchema,
  nodeDeletedPayloadSchema,
  nodeUpdatedPayloadSchema,
  nodeRestoredPayloadSchema,
  nodeBranchedPayloadSchema,
  linkCreatedPayloadSchema,
  linkRemovedPayloadSchema,
  canvasLayoutCreatedPayloadSchema,
  canvasLayoutDeletedPayloadSchema,
  canvasNodeAddedPayloadSchema,
  canvasNodeRemovedPayloadSchema,
  mcpServerConnectedPayloadSchema,
  mcpServerDisconnectedPayloadSchema,
  externalSourceConnectedPayloadSchema,
  externalSourceDisconnectedPayloadSchema,
]);
export type ActivityEventPayload = z.infer<typeof activityEventPayloadSchema>;

// ── Full ActivityEvent row schema ───────────────────────────────────

export const activityEventSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string().nullable(),
  eventType: activityEventTypeEnum,
  payload: activityEventPayloadSchema,
  createdAt: z.coerce.date(),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

// ── Activity feed query params schema ─────────────────────────────

export const activityFeedQuerySchema = z.object({
  eventType: z
    .union([activityEventTypeEnum, z.array(activityEventTypeEnum)])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return Array.isArray(v) ? v : [v];
    }),
  since: z.coerce.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .optional(),
});
export type ActivityFeedQuery = z.infer<typeof activityFeedQuerySchema>;
