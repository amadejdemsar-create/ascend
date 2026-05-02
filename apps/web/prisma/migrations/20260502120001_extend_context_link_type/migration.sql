-- Wave 5 Phase 1.5: Extend ContextLinkType enum with DATABASE_RELATION
--
-- PURPOSE: Adds DATABASE_RELATION as a new link type used by RELATION fields.
-- When a database row's RELATION property is updated, the system creates
-- ContextLink rows with this type and a databaseFieldId to identify the
-- source field.

ALTER TYPE "ContextLinkType" ADD VALUE IF NOT EXISTS 'DATABASE_RELATION';
