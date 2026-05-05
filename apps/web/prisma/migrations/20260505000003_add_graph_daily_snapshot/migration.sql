-- Wave 7 Phase 1.3: Create GraphDailySnapshot table
--
-- PURPOSE: Materialized per-day snapshot of the full user graph (nodes and
-- edges) for time-travel queries and graph playback. One row per user per
-- calendar date. Enables "show me my graph on March 15" queries.
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.
-- DZ-19: CHECK constraint caps combined nodes+edges payload at 5 MiB.

-- Step 1: Create GraphDailySnapshot table
CREATE TABLE "GraphDailySnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "snapshotDate" DATE NOT NULL,
  "nodes" JSONB NOT NULL,
  "edges" JSONB NOT NULL,
  "nodeCount" INTEGER NOT NULL,
  "edgeCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GraphDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- Step 2: CHECK constraint (DZ-19 size cap on combined nodes+edges payload)
ALTER TABLE "GraphDailySnapshot"
  ADD CONSTRAINT "GraphDailySnapshot_size_max" CHECK (
    octet_length("nodes"::text) + octet_length("edges"::text) <= 5242880
  );

-- Step 3: Foreign key
ALTER TABLE "GraphDailySnapshot"
  ADD CONSTRAINT "GraphDailySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Unique constraint
CREATE UNIQUE INDEX "GraphDailySnapshot_userId_snapshotDate_key" ON "GraphDailySnapshot"("userId", "snapshotDate");

-- Step 5: Indexes
CREATE INDEX "GraphDailySnapshot_snapshotDate_idx" ON "GraphDailySnapshot"("snapshotDate");
CREATE INDEX "GraphDailySnapshot_workspaceId_idx" ON "GraphDailySnapshot"("workspaceId");
