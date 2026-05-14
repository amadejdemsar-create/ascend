-- Wave 9 Phase 1 (migration 1 of 3): Add CANVAS to ContextLinkSource enum.
-- Hand-written migration (safety rule 6: never use prisma migrate dev).
-- PostgreSQL ADD VALUE appends to the enum; position in the Prisma schema
-- is for readability only.
-- Additive only. This migration does NOT touch search_vector (DZ-2 safe).

ALTER TYPE "ContextLinkSource" ADD VALUE 'CANVAS';
