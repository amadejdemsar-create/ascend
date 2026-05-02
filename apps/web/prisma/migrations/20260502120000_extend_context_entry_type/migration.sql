-- Wave 5 Phase 1.4: Extend ContextEntryType enum with DATABASE and RECORD
--
-- PURPOSE: Adds DATABASE (container for structured data) and RECORD (a row
-- within a database) as new context entry types. Both are first-class graph
-- nodes, searchable, wikilinkable, and embeddable.
--
-- PostgreSQL requires each ADD VALUE to be in its own statement (cannot be
-- wrapped in a transaction together with other ADD VALUE calls in PG < 12;
-- we use IF NOT EXISTS for idempotency regardless of version).

ALTER TYPE "ContextEntryType" ADD VALUE IF NOT EXISTS 'DATABASE';
ALTER TYPE "ContextEntryType" ADD VALUE IF NOT EXISTS 'RECORD';
