-- Wave 7 Phase 1.1: Create NodeVersion table with NodeType and VersionTrigger enums
--
-- PURPOSE: Introduces immutable version snapshots for any versionable node
-- (context entries, goals, todos, database rows, database fields). Each
-- version stores a full JSON payload, a content hash for dedup, and a byte
-- size for cap enforcement.
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.
-- DZ-17: CHECK constraints cap byteSize at 10 MiB (positive integer, max 10485760).

-- Step 1: Create NodeType enum
CREATE TYPE "NodeType" AS ENUM (
  'CONTEXT_ENTRY',
  'GOAL',
  'TODO',
  'DATABASE_ROW',
  'DATABASE_FIELD'
);

-- Step 2: Create VersionTrigger enum
CREATE TYPE "VersionTrigger" AS ENUM (
  'EDIT_DEBOUNCED',
  'EDIT_BLUR',
  'EDIT_EXPLICIT',
  'RESTORE',
  'BRANCH',
  'BACKFILL',
  'MIGRATION'
);

-- Step 3: Create NodeVersion table
CREATE TABLE "NodeVersion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "nodeType" "NodeType" NOT NULL,
  "nodeId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "trigger" "VersionTrigger" NOT NULL,
  "parentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NodeVersion_pkey" PRIMARY KEY ("id")
);

-- Step 4: CHECK constraints (DZ-17 size cap)
ALTER TABLE "NodeVersion"
  ADD CONSTRAINT "NodeVersion_byteSize_positive" CHECK ("byteSize" >= 0),
  ADD CONSTRAINT "NodeVersion_byteSize_max" CHECK ("byteSize" <= 10485760);

-- Step 5: Foreign keys
ALTER TABLE "NodeVersion"
  ADD CONSTRAINT "NodeVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NodeVersion"
  ADD CONSTRAINT "NodeVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "NodeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Unique constraint
CREATE UNIQUE INDEX "NodeVersion_nodeType_nodeId_versionNumber_key" ON "NodeVersion"("nodeType", "nodeId", "versionNumber");

-- Step 7: Indexes
CREATE INDEX "NodeVersion_nodeType_nodeId_createdAt_idx" ON "NodeVersion"("nodeType", "nodeId", "createdAt" DESC);
CREATE INDEX "NodeVersion_userId_createdAt_idx" ON "NodeVersion"("userId", "createdAt" DESC);
CREATE INDEX "NodeVersion_contentHash_idx" ON "NodeVersion"("contentHash");
CREATE INDEX "NodeVersion_workspaceId_idx" ON "NodeVersion"("workspaceId");
