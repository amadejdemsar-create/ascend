-- Wave 8b Phase 2: Add NODE_UPDATED to ActivityEventType enum.
-- Hand-written migration (safety rule 6: never use prisma migrate dev).
-- PostgreSQL ADD VALUE appends to the enum; position between NODE_DELETED
-- and NODE_RESTORED in the Prisma schema is for readability only.
-- This migration does NOT touch search_vector (DZ-2 safe).

ALTER TYPE "ActivityEventType" ADD VALUE 'NODE_UPDATED';
