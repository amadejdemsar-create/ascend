-- Wave 8 Phase 2.1: Add workspaceId to every existing entity table + backfill
--
-- PURPOSE: Adds workspaceId (nullable) to 10 tables that lack it, adds FK
-- constraints and indexes on all 18 entity tables, then backfills every row
-- to the user's personal workspace created in migration 2.
--
-- Three categories of tables:
--   A) 10 tables that need ADD COLUMN + FK + INDEX (new):
--      BlockDocument, ExtractionJob, ContextLink, ContextMap, Database,
--      DatabaseField, DatabaseRow, DatabaseView, LlmUsage, ProgressLog
--   B) 5 tables that already have workspaceId (Wave 0 scaffolding) but
--      need FK + INDEX (never wired up):
--      Goal, Category, Todo, ContextEntry, File
--   C) 3 tables that already have workspaceId + INDEX (Wave 7) but
--      need FK (Workspace table did not exist when Wave 7 ran):
--      NodeVersion, EdgeEvent, GraphDailySnapshot
--
-- Also drops the dead User.workspaceId column (Wave 0 scaffolding replaced
-- by User.defaultWorkspaceId in Phase 1).
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.
-- DZ-21: Backfill uses deterministic Workspace lookup via ownerId = userId.
-- IDEMPOTENT: All DDL uses guards (DO $$ EXCEPTION, IF NOT EXISTS).

-- =========================================================================
-- CATEGORY A: 10 tables that need ADD COLUMN + FK + INDEX
-- =========================================================================

-- A1: BlockDocument
DO $$ BEGIN
  ALTER TABLE "BlockDocument" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BlockDocument" ADD CONSTRAINT "BlockDocument_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "BlockDocument_workspaceId_idx" ON "BlockDocument"("workspaceId");

-- A2: ExtractionJob
DO $$ BEGIN
  ALTER TABLE "ExtractionJob" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ExtractionJob_workspaceId_idx" ON "ExtractionJob"("workspaceId");

-- A3: ContextLink
DO $$ BEGIN
  ALTER TABLE "ContextLink" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ContextLink" ADD CONSTRAINT "ContextLink_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ContextLink_workspaceId_idx" ON "ContextLink"("workspaceId");

-- A4: ContextMap
DO $$ BEGIN
  ALTER TABLE "ContextMap" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ContextMap" ADD CONSTRAINT "ContextMap_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ContextMap_workspaceId_idx" ON "ContextMap"("workspaceId");

-- A5: Database
DO $$ BEGIN
  ALTER TABLE "Database" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Database" ADD CONSTRAINT "Database_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Database_workspaceId_idx" ON "Database"("workspaceId");

-- A6: DatabaseField
DO $$ BEGIN
  ALTER TABLE "DatabaseField" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DatabaseField" ADD CONSTRAINT "DatabaseField_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "DatabaseField_workspaceId_idx" ON "DatabaseField"("workspaceId");

-- A7: DatabaseRow
DO $$ BEGIN
  ALTER TABLE "DatabaseRow" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "DatabaseRow_workspaceId_idx" ON "DatabaseRow"("workspaceId");

-- A8: DatabaseView
DO $$ BEGIN
  ALTER TABLE "DatabaseView" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "DatabaseView_workspaceId_idx" ON "DatabaseView"("workspaceId");

-- A9: LlmUsage
DO $$ BEGIN
  ALTER TABLE "LlmUsage" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LlmUsage" ADD CONSTRAINT "LlmUsage_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "LlmUsage_workspaceId_idx" ON "LlmUsage"("workspaceId");

-- A10: ProgressLog
DO $$ BEGIN
  ALTER TABLE "ProgressLog" ADD COLUMN "workspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProgressLog_workspaceId_idx" ON "ProgressLog"("workspaceId");

-- =========================================================================
-- CATEGORY B: 5 tables with workspaceId from Wave 0 scaffolding (need FK + INDEX)
-- =========================================================================

-- B1: Goal
DO $$ BEGIN
  ALTER TABLE "Goal" ADD CONSTRAINT "Goal_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Goal_workspaceId_idx" ON "Goal"("workspaceId");

-- B2: Category
DO $$ BEGIN
  ALTER TABLE "Category" ADD CONSTRAINT "Category_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Category_workspaceId_idx" ON "Category"("workspaceId");

-- B3: Todo
DO $$ BEGIN
  ALTER TABLE "Todo" ADD CONSTRAINT "Todo_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Todo_workspaceId_idx" ON "Todo"("workspaceId");

-- B4: ContextEntry
DO $$ BEGIN
  ALTER TABLE "ContextEntry" ADD CONSTRAINT "ContextEntry_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ContextEntry_workspaceId_idx" ON "ContextEntry"("workspaceId");

-- B5: File
DO $$ BEGIN
  ALTER TABLE "File" ADD CONSTRAINT "File_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "File_workspaceId_idx" ON "File"("workspaceId");

-- =========================================================================
-- CATEGORY C: 3 Wave 7 tables (have column + index, need FK only)
-- =========================================================================

-- C1: NodeVersion
DO $$ BEGIN
  ALTER TABLE "NodeVersion" ADD CONSTRAINT "NodeVersion_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index already exists (Wave 7), but include for safety
CREATE INDEX IF NOT EXISTS "NodeVersion_workspaceId_idx" ON "NodeVersion"("workspaceId");

-- C2: EdgeEvent
DO $$ BEGIN
  ALTER TABLE "EdgeEvent" ADD CONSTRAINT "EdgeEvent_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "EdgeEvent_workspaceId_idx" ON "EdgeEvent"("workspaceId");

-- C3: GraphDailySnapshot
DO $$ BEGIN
  ALTER TABLE "GraphDailySnapshot" ADD CONSTRAINT "GraphDailySnapshot_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "GraphDailySnapshot_workspaceId_idx" ON "GraphDailySnapshot"("workspaceId");

-- =========================================================================
-- BACKFILL: Set workspaceId on every row in all 18 tables
--
-- Strategy: For tables with a direct userId column, resolve workspace via
-- JOIN to Workspace WHERE ownerId = userId. For tables without userId
-- (ProgressLog, ExtractionJob), resolve through the parent entity chain.
--
-- WHERE workspaceId IS NULL ensures idempotency.
-- =========================================================================

-- Tables with direct userId column (15 tables):

-- Goal
UPDATE "Goal" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- Category
UPDATE "Category" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- Todo
UPDATE "Todo" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- ContextEntry
UPDATE "ContextEntry" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- File
UPDATE "File" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- BlockDocument
UPDATE "BlockDocument" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- ContextLink (has denormalized userId per DZ-8)
UPDATE "ContextLink" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- ContextMap
UPDATE "ContextMap" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- Database
UPDATE "Database" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- DatabaseField (has direct userId column)
UPDATE "DatabaseField" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- DatabaseRow (has direct userId column)
UPDATE "DatabaseRow" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- DatabaseView (has direct userId column)
UPDATE "DatabaseView" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- LlmUsage
UPDATE "LlmUsage" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- NodeVersion
UPDATE "NodeVersion" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- EdgeEvent
UPDATE "EdgeEvent" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- GraphDailySnapshot
UPDATE "GraphDailySnapshot" t
SET "workspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = t."userId" LIMIT 1
)
WHERE t."workspaceId" IS NULL;

-- Tables WITHOUT direct userId (resolved via parent entity):

-- ProgressLog: belongs to Goal (which has userId)
UPDATE "ProgressLog" pl
SET "workspaceId" = (
  SELECT w."id"
  FROM "Goal" g
  JOIN "Workspace" w ON w."ownerId" = g."userId"
  WHERE g."id" = pl."goalId"
  LIMIT 1
)
WHERE pl."workspaceId" IS NULL;

-- ExtractionJob: belongs to File (which has userId)
UPDATE "ExtractionJob" ej
SET "workspaceId" = (
  SELECT w."id"
  FROM "File" f
  JOIN "Workspace" w ON w."ownerId" = f."userId"
  WHERE f."id" = ej."fileId"
  LIMIT 1
)
WHERE ej."workspaceId" IS NULL;

-- =========================================================================
-- DROP dead User.workspaceId column (Wave 0 scaffolding, never used,
-- replaced by User.defaultWorkspaceId in Phase 1)
-- =========================================================================

-- Drop any index on User.workspaceId first (may or may not exist)
DROP INDEX IF EXISTS "User_workspaceId_idx";

DO $$ BEGIN
  ALTER TABLE "User" DROP COLUMN "workspaceId";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
