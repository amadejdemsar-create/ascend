-- Wave 10 Phase 1.4: ContextEntry.externalDataSourceId nullable FK
--
-- The EXTERNAL_DATABASE-typed ContextEntry rows point to their backing
-- ExternalDataSource via this nullable FK. SetNull on delete so a manual
-- ExternalDataSource removal does not orphan the entry; the user is
-- expected to delete the entry separately if they want to.
--
-- DZ-2 SAFE: only ADDS a nullable column to ContextEntry. The
-- search_vector tsvector column, the GIN index, and the generated
-- trigger are untouched. Existing rows have NULL for the new column,
-- which is the correct behavior for non-EXTERNAL_DATABASE entries.

ALTER TABLE "ContextEntry"
  ADD COLUMN "externalDataSourceId" TEXT;

CREATE UNIQUE INDEX "ContextEntry_externalDataSourceId_key"
  ON "ContextEntry"("externalDataSourceId");

ALTER TABLE "ContextEntry"
  ADD CONSTRAINT "ContextEntry_externalDataSourceId_fkey"
  FOREIGN KEY ("externalDataSourceId") REFERENCES "ExternalDataSource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
