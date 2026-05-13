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
  "NODE_RESTORED",
  "NODE_BRANCHED",
  "LINK_CREATED",
  "LINK_REMOVED",
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
});
export type LinkCreatedPayload = z.infer<typeof linkCreatedPayloadSchema>;

export const linkRemovedPayloadSchema = z.object({
  eventType: z.literal("LINK_REMOVED"),
  linkType: z.string(),
  fromEntryId: z.string(),
  toEntryId: z.string(),
});
export type LinkRemovedPayload = z.infer<typeof linkRemovedPayloadSchema>;

// ── Discriminated union of all event payloads ───────────────────────

export const activityEventPayloadSchema = z.discriminatedUnion("eventType", [
  workspaceCreatedPayloadSchema,
  memberAddedPayloadSchema,
  memberRemovedPayloadSchema,
  memberRoleChangedPayloadSchema,
  nodeCreatedPayloadSchema,
  nodeDeletedPayloadSchema,
  nodeRestoredPayloadSchema,
  nodeBranchedPayloadSchema,
  linkCreatedPayloadSchema,
  linkRemovedPayloadSchema,
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
