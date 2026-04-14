-- =====================================================================
--  NOTE: prisma migrate dev auto-generated DROP statements for the
--  search_vector column and its GIN index because Prisma does not know
--  about them (added by raw SQL migration 20260409114539_add_context_fts).
--  Those DROPs have been REMOVED from this migration to satisfy
--  CLAUDE.md safety rule 6 (full-text search must remain intact).
--  The original migration that auto-generated this file applied those
--  DROPs against the local dev database before this fix was made;
--  the restoration block at the end of this file recreates the
--  column, index, and trigger so the dev DB matches production.
-- =====================================================================

-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "todoId" TEXT,
    "goalId" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusSession_userId_idx" ON "FocusSession"("userId");

-- CreateIndex
CREATE INDEX "FocusSession_todoId_idx" ON "FocusSession"("todoId");

-- CreateIndex
CREATE INDEX "FocusSession_goalId_idx" ON "FocusSession"("goalId");

-- CreateIndex
CREATE INDEX "FocusSession_startedAt_idx" ON "FocusSession"("startedAt");

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
--  Restoration of the ContextEntry full-text search column, GIN index,
--  and trigger after the auto-generated DROPs above. Mirrors
--  prisma/migrations/20260409114539_add_context_fts/migration.sql
--  exactly so the column, index, and trigger end up in their original
--  state. IF NOT EXISTS / OR REPLACE / DROP IF EXISTS make this
--  idempotent so re-running migrate is safe.
-- =====================================================================

-- Recreate tsvector column for full-text search
ALTER TABLE "ContextEntry" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Recreate GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "ContextEntry_search_vector_idx" ON "ContextEntry" USING GIN ("search_vector");

-- Recreate trigger function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION context_entry_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."content", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW."tags", ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS context_entry_search_vector_trigger ON "ContextEntry";
CREATE TRIGGER context_entry_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "content", "tags"
  ON "ContextEntry"
  FOR EACH ROW
  EXECUTE FUNCTION context_entry_search_vector_update();

-- Backfill existing rows so search_vector reflects current title/content/tags
UPDATE "ContextEntry" SET "search_vector" =
  setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("content", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string("tags", ' '), '')), 'C');
