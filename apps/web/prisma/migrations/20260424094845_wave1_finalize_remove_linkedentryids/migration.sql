-- Wave 1 Phase 8: Remove the legacy linkedEntryIds column from ContextEntry.
-- All data has been migrated to the ContextLink table (backfill migration
-- 20260424094844). Parity was verified before this migration was written.
--
-- DZ-2 safety: this migration ONLY drops linkedEntryIds. It does NOT touch
-- search_vector, its trigger, or its index. Those were added via raw SQL
-- and are invisible to Prisma; dropping them would break full-text search.

ALTER TABLE "ContextEntry" DROP COLUMN "linkedEntryIds";
