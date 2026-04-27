-- Wave 4, Phase 1: Extraction pipeline fields on File + 1:1 FK to ContextEntry.
--
-- PURPOSE: Adds extraction-related columns to the existing File model so files
-- can be processed asynchronously (text extraction, vision tagging, transcription).
-- Also adds a contextEntryId FK on File to link each file to its parent context
-- entry (1:1: a file belongs to at most one entry). The ContextEntry side uses
-- a back-relation only (no extra FK column on ContextEntry), keeping the schema
-- clean and avoiding bidirectional FK pitfalls.
--
-- DEPENDENCIES: File table must exist (Wave 0). pgvector extension must be
-- enabled (20260425000001_enable_pgvector).
--
-- DZ-2 SAFETY: This migration contains ZERO references to search_vector, the
-- GIN index (ContextEntry_search_vector_idx), or the
-- context_entry_search_vector_update trigger function. The file's extracted
-- text is denormalized into ContextEntry.extractedText at extraction time by
-- the service layer, which already flows through the existing Wave 3 trigger.
-- No trigger modification is needed in this wave.
--
-- IDEMPOTENT: All statements use IF NOT EXISTS / IF NOT EXISTS guards.
--
-- ROLLBACK (reverse order):
--   ALTER TABLE "File" DROP CONSTRAINT IF EXISTS "File_contextEntryId_fkey";
--   DROP INDEX IF EXISTS "File_contextEntryId_key";
--   DROP INDEX IF EXISTS "File_extractionStatus_idx";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "contextEntryId";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "multimodalEmbedding";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "extractedAt";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "extractionError";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "extractionStatus";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "pageCount";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "thumbnailKey";
--   ALTER TABLE "File" DROP COLUMN IF EXISTS "extractedText";
--   DROP TYPE IF EXISTS "ExtractionStatus";

-- Step 1: Create the ExtractionStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExtractionStatus') THEN
    CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'EXTRACTING', 'COMPLETE', 'FAILED');
  END IF;
END
$$;

-- Step 2: Add extraction columns to File
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "extractedText" TEXT;
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "thumbnailKey" TEXT;
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "pageCount" INTEGER;
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "extractionError" TEXT;
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "extractedAt" TIMESTAMP(3);
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "multimodalEmbedding" vector(1536);

-- Step 3: Add contextEntryId FK on File (one direction only)
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "contextEntryId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "File_contextEntryId_key" ON "File"("contextEntryId");

ALTER TABLE "File" ADD CONSTRAINT "File_contextEntryId_fkey"
  FOREIGN KEY ("contextEntryId") REFERENCES "ContextEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Performance index for extraction worker polling
CREATE INDEX IF NOT EXISTS "File_extractionStatus_idx" ON "File"("extractionStatus");
