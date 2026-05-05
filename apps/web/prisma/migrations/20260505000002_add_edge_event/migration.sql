-- Wave 7 Phase 1.2: Create EdgeEvent table with EdgeEventType enum
--
-- PURPOSE: Append-only event log for the typed-edge graph. Each row records
-- when a ContextLink was created, removed, or updated, along with the full
-- link state at that moment (linkSnapshot). Enables edge-level time travel
-- and provenance queries.
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.

-- Step 1: Create EdgeEventType enum
CREATE TYPE "EdgeEventType" AS ENUM ('CREATED', 'REMOVED', 'UPDATED');

-- Step 2: Create EdgeEvent table
CREATE TABLE "EdgeEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "eventType" "EdgeEventType" NOT NULL,
  "linkSnapshot" JSONB NOT NULL,
  "fromEntryId" TEXT,
  "toEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EdgeEvent_pkey" PRIMARY KEY ("id")
);

-- Step 3: Foreign key
ALTER TABLE "EdgeEvent"
  ADD CONSTRAINT "EdgeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Indexes
CREATE INDEX "EdgeEvent_userId_createdAt_idx" ON "EdgeEvent"("userId", "createdAt" DESC);
CREATE INDEX "EdgeEvent_workspaceId_idx" ON "EdgeEvent"("workspaceId");
CREATE INDEX "EdgeEvent_fromEntryId_createdAt_idx" ON "EdgeEvent"("fromEntryId", "createdAt" DESC);
CREATE INDEX "EdgeEvent_toEntryId_createdAt_idx" ON "EdgeEvent"("toEntryId", "createdAt" DESC);
