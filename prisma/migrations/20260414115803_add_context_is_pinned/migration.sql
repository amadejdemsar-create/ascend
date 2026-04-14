-- Add isPinned column to ContextEntry for pin-to-top functionality.
-- Safe: additive only, no destructive operations. The search_vector
-- column, its GIN index, and trigger are unaffected.

ALTER TABLE "ContextEntry" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ContextEntry_userId_isPinned_idx" ON "ContextEntry"("userId", "isPinned");
