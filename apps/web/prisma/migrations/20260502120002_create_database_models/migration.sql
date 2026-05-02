-- Wave 5 Phase 1.6: Create Database, DatabaseField, DatabaseRow, DatabaseView tables
--
-- PURPOSE: Introduces the four tables backing the Ascend database system.
-- Each Database has a 1:1 link to a ContextEntry (type DATABASE). Each row
-- has a 1:1 link to a ContextEntry (type RECORD). DatabaseField defines the
-- schema; DatabaseView stores per-view config (filters, sorts, layout).
--
-- Also adds the databaseFieldId nullable FK on ContextLink for RELATION
-- field provenance.
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.
-- DZ-15: CHECK constraint on DatabaseRow.properties caps JSONB at 512 KiB.
--
-- All IDs are TEXT (app-level cuid generation, matching all other Ascend tables).

-- Step 1: Create new enums
CREATE TYPE "DatabaseFieldType" AS ENUM (
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
  'RELATION',
  'FORMULA',
  'USER',
  'CHECKBOX',
  'RATING',
  'URL',
  'EMAIL',
  'PHONE',
  'FILE'
);

CREATE TYPE "DatabaseViewType" AS ENUM (
  'TABLE',
  'BOARD',
  'CALENDAR',
  'GALLERY',
  'TIMELINE'
);

-- Step 2: Create Database table
CREATE TABLE "Database" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextEntryId" TEXT NOT NULL,
  "defaultViewId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Database_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create DatabaseField table
CREATE TABLE "DatabaseField" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DatabaseFieldType" NOT NULL,
  "position" INTEGER NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DatabaseField_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create DatabaseRow table
CREATE TABLE "DatabaseRow" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "contextEntryId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "properties" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DatabaseRow_pkey" PRIMARY KEY ("id")
);

-- Step 5: Create DatabaseView table
CREATE TABLE "DatabaseView" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DatabaseViewType" NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DatabaseView_pkey" PRIMARY KEY ("id")
);

-- Step 6: Unique constraints
CREATE UNIQUE INDEX "Database_contextEntryId_key" ON "Database"("contextEntryId");
CREATE UNIQUE INDEX "DatabaseField_databaseId_position_key" ON "DatabaseField"("databaseId", "position");
CREATE UNIQUE INDEX "DatabaseRow_contextEntryId_key" ON "DatabaseRow"("contextEntryId");

-- Step 7: Indexes
CREATE INDEX "Database_userId_idx" ON "Database"("userId");
CREATE INDEX "DatabaseField_databaseId_idx" ON "DatabaseField"("databaseId");
CREATE INDEX "DatabaseField_userId_idx" ON "DatabaseField"("userId");
CREATE INDEX "DatabaseRow_databaseId_idx" ON "DatabaseRow"("databaseId");
CREATE INDEX "DatabaseRow_userId_idx" ON "DatabaseRow"("userId");
CREATE INDEX "DatabaseView_databaseId_idx" ON "DatabaseView"("databaseId");
CREATE INDEX "DatabaseView_userId_idx" ON "DatabaseView"("userId");

-- Step 8: Foreign keys on Database
ALTER TABLE "Database" ADD CONSTRAINT "Database_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Database" ADD CONSTRAINT "Database_contextEntryId_fkey"
  FOREIGN KEY ("contextEntryId") REFERENCES "ContextEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Foreign keys on DatabaseField
ALTER TABLE "DatabaseField" ADD CONSTRAINT "DatabaseField_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatabaseField" ADD CONSTRAINT "DatabaseField_databaseId_fkey"
  FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 10: Foreign keys on DatabaseRow
ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_databaseId_fkey"
  FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_contextEntryId_fkey"
  FOREIGN KEY ("contextEntryId") REFERENCES "ContextEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 11: Foreign keys on DatabaseView
ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_databaseId_fkey"
  FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 12: Add databaseFieldId column to ContextLink
ALTER TABLE "ContextLink" ADD COLUMN "databaseFieldId" TEXT;

-- Step 13: Foreign key and index on ContextLink.databaseFieldId
ALTER TABLE "ContextLink" ADD CONSTRAINT "ContextLink_databaseFieldId_fkey"
  FOREIGN KEY ("databaseFieldId") REFERENCES "DatabaseField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ContextLink_databaseFieldId_idx" ON "ContextLink"("databaseFieldId");

-- Step 14: DZ-15 backstop — cap properties JSONB at 512 KiB
ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_properties_size_check"
  CHECK (octet_length("properties"::text) <= 524288);
