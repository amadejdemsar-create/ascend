-- Wave 8 Phase 2.2: Finalize workspaceId as NOT NULL on all 18 entity tables
--
-- PURPOSE: Flips workspaceId from nullable to NOT NULL on every entity table
-- after migration 3 has backfilled all rows. Includes a pre-flight gate that
-- raises an exception if any table still has null rows (DZ-21 safety net).
--
-- Also adds the FK constraint on User.defaultWorkspaceId -> Workspace.id
-- (Phase 1 created the column; now that Workspace is populated, we wire the FK).
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.
-- IDEMPOTENT: SET NOT NULL on an already-NOT-NULL column is a no-op in Postgres.
-- The FK uses DO $$ EXCEPTION WHEN duplicate_object guard.

-- =========================================================================
-- PRE-FLIGHT GATE: Refuse to apply if ANY table has null workspaceId rows.
-- This is the DZ-21 safety net. If migration 3's backfill failed or was
-- incomplete, this block raises an exception and the migration aborts.
-- =========================================================================

DO $$
DECLARE
  null_count BIGINT;
BEGIN
  -- Goal
  SELECT COUNT(*) INTO null_count FROM "Goal" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in Goal have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- Category
  SELECT COUNT(*) INTO null_count FROM "Category" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in Category have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- Todo
  SELECT COUNT(*) INTO null_count FROM "Todo" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in Todo have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- ContextEntry
  SELECT COUNT(*) INTO null_count FROM "ContextEntry" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in ContextEntry have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- File
  SELECT COUNT(*) INTO null_count FROM "File" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in File have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- BlockDocument
  SELECT COUNT(*) INTO null_count FROM "BlockDocument" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in BlockDocument have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- ExtractionJob
  SELECT COUNT(*) INTO null_count FROM "ExtractionJob" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in ExtractionJob have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- ContextLink
  SELECT COUNT(*) INTO null_count FROM "ContextLink" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in ContextLink have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- ContextMap
  SELECT COUNT(*) INTO null_count FROM "ContextMap" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in ContextMap have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- Database
  SELECT COUNT(*) INTO null_count FROM "Database" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in Database have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- DatabaseField
  SELECT COUNT(*) INTO null_count FROM "DatabaseField" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in DatabaseField have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- DatabaseRow
  SELECT COUNT(*) INTO null_count FROM "DatabaseRow" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in DatabaseRow have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- DatabaseView
  SELECT COUNT(*) INTO null_count FROM "DatabaseView" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in DatabaseView have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- LlmUsage
  SELECT COUNT(*) INTO null_count FROM "LlmUsage" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in LlmUsage have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- ProgressLog
  SELECT COUNT(*) INTO null_count FROM "ProgressLog" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in ProgressLog have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- NodeVersion
  SELECT COUNT(*) INTO null_count FROM "NodeVersion" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in NodeVersion have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- EdgeEvent
  SELECT COUNT(*) INTO null_count FROM "EdgeEvent" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in EdgeEvent have null workspaceId. Re-run migration 3.', null_count;
  END IF;

  -- GraphDailySnapshot
  SELECT COUNT(*) INTO null_count FROM "GraphDailySnapshot" WHERE "workspaceId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Wave 8 finalize: % rows in GraphDailySnapshot have null workspaceId. Re-run migration 3.', null_count;
  END IF;
END $$;

-- =========================================================================
-- FLIP TO NOT NULL: All 18 entity tables
-- Postgres is fine with SET NOT NULL on an already-NOT-NULL column (no-op).
-- =========================================================================

-- Wave 0 scaffolded (5)
ALTER TABLE "Goal" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Todo" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContextEntry" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "File" ALTER COLUMN "workspaceId" SET NOT NULL;

-- Newly added in migration 3 (10)
ALTER TABLE "BlockDocument" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ExtractionJob" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContextLink" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContextMap" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Database" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "DatabaseField" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "DatabaseRow" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "DatabaseView" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "LlmUsage" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ProgressLog" ALTER COLUMN "workspaceId" SET NOT NULL;

-- Wave 7 (3)
ALTER TABLE "NodeVersion" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "EdgeEvent" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "GraphDailySnapshot" ALTER COLUMN "workspaceId" SET NOT NULL;

-- =========================================================================
-- ADD FK on User.defaultWorkspaceId -> Workspace.id
-- Phase 1 created the column; now we wire the FK.
-- ON DELETE SET NULL: deleting a workspace clears the user's default
-- rather than blocking deletion. Correct for Wave 8b multi-workspace.
-- =========================================================================

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_defaultWorkspaceId_fkey"
    FOREIGN KEY ("defaultWorkspaceId") REFERENCES "Workspace"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
