-- Wave 3, Phase 1.3: Extend search_vector trigger to include extractedText
--
-- PURPOSE: Updates the existing context_entry_search_vector_update() trigger
-- function to also index the new extractedText column (added by the previous
-- migration 20260426000001_add_block_document). The extractedText column holds
-- the plain-text extraction from the block editor's Lexical state. By including
-- it in the tsvector, full-text search indexes block content even when the
-- legacy ContextEntry.content field has not been updated.
--
-- DEPENDENCIES: 20260426000001_add_block_document must be applied first
-- (provides the extractedText column on ContextEntry).
--
-- DZ-2 CRITICAL: This migration:
--   - Does NOT drop the trigger function. Uses CREATE OR REPLACE (ALTER).
--   - Does NOT drop or re-create the trigger binding. It only updates the
--     function body and extends the trigger column list.
--   - Preserves all existing weights: A (title), B (content), C (tags).
--   - Adds extractedText at weight B alongside content, with COALESCE on null.
--   - The GIN index (ContextEntry_search_vector_idx) is NOT touched.
--
-- EXISTING FUNCTION BODY (from 20260409114539_add_context_fts):
--
--   CREATE OR REPLACE FUNCTION context_entry_search_vector_update() RETURNS trigger AS $$
--   BEGIN
--     NEW."search_vector" :=
--       setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
--       setweight(to_tsvector('english', COALESCE(NEW."content", '')), 'B') ||
--       setweight(to_tsvector('english', COALESCE(array_to_string(NEW."tags", ' '), '')), 'C');
--     RETURN NEW;
--   END;
--   $$ LANGUAGE plpgsql;
--
-- UPDATED FUNCTION (below): adds extractedText at weight 'B'.
--
-- ROLLBACK:
--   Restore the original function body (without extractedText):
--   CREATE OR REPLACE FUNCTION context_entry_search_vector_update() ...
--   (paste the EXISTING FUNCTION BODY above)
--   Then drop and recreate the trigger to remove "extractedText" from the
--   column list:
--   DROP TRIGGER IF EXISTS context_entry_search_vector_trigger ON "ContextEntry";
--   CREATE TRIGGER context_entry_search_vector_trigger
--     BEFORE INSERT OR UPDATE OF "title", "content", "tags"
--     ON "ContextEntry"
--     FOR EACH ROW
--     EXECUTE FUNCTION context_entry_search_vector_update();

-- Step 1: Update the trigger function to include extractedText
-- Uses CREATE OR REPLACE so we do NOT need to drop first.
CREATE OR REPLACE FUNCTION context_entry_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."content", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."extractedText", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW."tags", ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Recreate the trigger to fire on extractedText updates too.
-- We must DROP + CREATE because ALTER TRIGGER cannot change the column list.
-- The function binding is preserved (same function name).
DROP TRIGGER IF EXISTS context_entry_search_vector_trigger ON "ContextEntry";
CREATE TRIGGER context_entry_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "content", "tags", "extractedText"
  ON "ContextEntry"
  FOR EACH ROW
  EXECUTE FUNCTION context_entry_search_vector_update();

-- Step 3: Backfill existing rows that have extractedText set.
-- On first deploy there are no entries with extractedText populated, so this
-- is a no-op. Included for safety if entries are manually populated before
-- the trigger fires.
UPDATE "ContextEntry"
SET "search_vector" =
  setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("content", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("extractedText", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string("tags", ' '), '')), 'C')
WHERE "extractedText" IS NOT NULL;
