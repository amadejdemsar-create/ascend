-- Wave 4, Phase 1: Extraction job queue table.
--
-- PURPOSE: Creates the ExtractionJob table for the async extraction pipeline.
-- Each uploaded file gets one ExtractionJob row. The extraction worker (HTTP
-- cron tick at POST /api/files/extract/run) claims PENDING rows, runs the
-- appropriate handler, and marks them COMPLETE or FAILED.
--
-- Supports retry with exponential backoff (DZ-13 mitigation):
--   - maxAttempts defaults to 3
--   - scheduledAt is bumped on failure: now() + interval * 5^attempts
--   - The (status, scheduledAt) composite index allows the worker to efficiently
--     find claimable rows: WHERE status = 'PENDING' AND scheduledAt <= now()
--
-- DEPENDENCIES: 20260427000001_add_extraction_fields_to_file must be applied
-- first (provides the "ExtractionStatus" enum type).
--
-- DZ-2 SAFETY: This migration contains ZERO references to search_vector, the
-- GIN index, or the context_entry_search_vector_update trigger. The file's
-- extracted text feeds into ContextEntry.extractedText via the service layer,
-- which the existing Wave 3 trigger already indexes. No trigger touch needed.
--
-- IDEMPOTENT: All statements use IF NOT EXISTS guards.
--
-- ROLLBACK:
--   ALTER TABLE "ExtractionJob" DROP CONSTRAINT IF EXISTS "ExtractionJob_fileId_fkey";
--   DROP INDEX IF EXISTS "ExtractionJob_status_scheduledAt_idx";
--   DROP TABLE IF EXISTS "ExtractionJob";

-- Step 1: Create the ExtractionJob table
CREATE TABLE IF NOT EXISTS "ExtractionJob" (
  "id"          TEXT NOT NULL,
  "fileId"      TEXT NOT NULL,
  "status"      "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError"   TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt"   TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExtractionJob_pkey" PRIMARY KEY ("id")
);

-- Step 2: Unique constraint on fileId (one job per file)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ExtractionJob_fileId_key'
  ) THEN
    ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_fileId_key" UNIQUE ("fileId");
  END IF;
END
$$;

-- Step 3: FK from ExtractionJob.fileId to File.id (cascade delete: if file is
-- deleted, the job row goes with it)
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "File"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Composite index for worker polling: claim PENDING rows ordered by scheduledAt
CREATE INDEX IF NOT EXISTS "ExtractionJob_status_scheduledAt_idx"
  ON "ExtractionJob"("status", "scheduledAt");
