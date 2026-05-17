-- Wave 10 Phase 10: ActivityEventType enum extension for federation +
-- external data lifecycle events.
--
-- Purely additive. All existing values untouched. The activity feed
-- (apps/web/components/activity/activity-feed-view.tsx) treats unknown
-- event types as a generic "activity" row, so this migration is safe
-- to apply before the renderer is taught the new types.

ALTER TYPE "ActivityEventType" ADD VALUE 'MCP_SERVER_CONNECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'MCP_SERVER_DISCONNECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'EXTERNAL_SOURCE_CONNECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'EXTERNAL_SOURCE_DISCONNECTED';
