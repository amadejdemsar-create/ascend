-- Wave 9 Phase 2: Add 4 canvas activity event types to ActivityEventType enum.
-- Hand-written migration (safety rule 6: never use prisma migrate dev).
-- PostgreSQL ADD VALUE appends to the enum; position in the Prisma schema
-- is for readability only.
-- Additive only. This migration does NOT touch search_vector (DZ-2 safe).
--
-- The 4 new values feed the Wave 9 canvas service layer's
-- fire-and-forget activity logging:
--   CANVAS_LAYOUT_CREATED  on canvasLayoutService.create / getDefault
--   CANVAS_LAYOUT_DELETED  on canvasLayoutService.delete
--   CANVAS_NODE_ADDED      on canvasNodeService.upsert (new row only)
--   CANVAS_NODE_REMOVED    on canvasNodeService.removeFromLayout

ALTER TYPE "ActivityEventType" ADD VALUE 'CANVAS_LAYOUT_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CANVAS_LAYOUT_DELETED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CANVAS_NODE_ADDED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CANVAS_NODE_REMOVED';
