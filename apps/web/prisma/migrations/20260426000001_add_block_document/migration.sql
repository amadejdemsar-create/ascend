-- Wave 3, Phase 1.2: Add BlockDocument table and ContextEntry FK columns
--
-- PURPOSE: Creates the BlockDocument table for Yjs-backed block editor state,
-- adds blockDocumentId (nullable FK) and extractedText (denormalized plain text)
-- columns to ContextEntry. The block editor stores its Yjs binary state and a
-- JSON snapshot of the Lexical editor state per context entry.
--
-- DEPENDENCIES: None beyond the base schema. ContextEntry and User tables must
-- exist (they do since 20260409114535_add_context_system).
--
-- DZ-2 SAFETY: This migration does NOT touch search_vector, its GIN index
-- (ContextEntry_search_vector_idx), or the context_entry_search_vector_update
-- trigger/function. Those are invisible to Prisma and must be preserved.
-- The trigger extension for extractedText is handled by the NEXT migration
-- (20260426000002_extend_search_vector_trigger).
--
-- ROLLBACK (reverse order):
--   ALTER TABLE "ContextEntry" DROP CONSTRAINT IF EXISTS "ContextEntry_blockDocumentId_fkey";
--   DROP INDEX IF EXISTS "ContextEntry_blockDocumentId_key";
--   ALTER TABLE "ContextEntry" DROP COLUMN IF EXISTS "blockDocumentId";
--   ALTER TABLE "ContextEntry" DROP COLUMN IF EXISTS "extractedText";
--   DROP TABLE IF EXISTS "BlockDocument";

-- AlterTable: add nullable columns to ContextEntry
ALTER TABLE "ContextEntry" ADD COLUMN IF NOT EXISTS "blockDocumentId" TEXT;
ALTER TABLE "ContextEntry" ADD COLUMN IF NOT EXISTS "extractedText" TEXT;

-- CreateIndex: unique index on blockDocumentId (one BlockDocument per entry)
CREATE UNIQUE INDEX IF NOT EXISTS "ContextEntry_blockDocumentId_key"
  ON "ContextEntry"("blockDocumentId");

-- CreateTable: BlockDocument (per-entry Yjs doc state + JSON snapshot)
CREATE TABLE IF NOT EXISTS "BlockDocument" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "entryId"   TEXT NOT NULL,
    "state"     BYTEA NOT NULL,
    "snapshot"  JSONB NOT NULL,
    "version"   INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on entryId (one doc per entry)
CREATE UNIQUE INDEX IF NOT EXISTS "BlockDocument_entryId_key"
  ON "BlockDocument"("entryId");

-- CreateIndex: composite for userId-scoped lookups by entry
CREATE INDEX IF NOT EXISTS "BlockDocument_userId_entryId_idx"
  ON "BlockDocument"("userId", "entryId");

-- AddForeignKey: BlockDocument.userId -> User.id (cascade delete)
ALTER TABLE "BlockDocument" ADD CONSTRAINT "BlockDocument_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BlockDocument.entryId -> ContextEntry.id (cascade delete)
ALTER TABLE "BlockDocument" ADD CONSTRAINT "BlockDocument_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "ContextEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ContextEntry.blockDocumentId -> BlockDocument.id (set null on delete)
ALTER TABLE "ContextEntry" ADD CONSTRAINT "ContextEntry_blockDocumentId_fkey"
    FOREIGN KEY ("blockDocumentId") REFERENCES "BlockDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: cap Yjs binary state at 1 MiB (1048576 bytes)
-- Application layer also enforces this, but the DB constraint is the hard backstop.
ALTER TABLE "BlockDocument" ADD CONSTRAINT "BlockDocument_state_size_check"
    CHECK (octet_length("state") <= 1048576);
