-- Add tsvector column for full-text search
ALTER TABLE "ContextEntry" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "ContextEntry_search_vector_idx" ON "ContextEntry" USING GIN ("search_vector");

-- Create trigger function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION context_entry_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."content", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW."tags", ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS context_entry_search_vector_trigger ON "ContextEntry";
CREATE TRIGGER context_entry_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "content", "tags"
  ON "ContextEntry"
  FOR EACH ROW
  EXECUTE FUNCTION context_entry_search_vector_update();

-- Backfill existing rows (if any)
UPDATE "ContextEntry" SET "search_vector" =
  setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("content", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string("tags", ' '), '')), 'C');
