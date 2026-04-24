-- Wave 2, Phase 1.5: Enable pgvector extension
--
-- PURPOSE: Enables the pgvector extension required by ContextEntry.embedding
-- (vector(1536) column added in the next migration). pgvector provides the
-- vector data type, cosine distance operator (<=>), and HNSW index support.
--
-- DEPENDENCIES: The PostgreSQL instance must have pgvector installed.
-- On Dokploy, swap the Postgres image to pgvector/pgvector:pg16 first.
-- Verify availability: SELECT * FROM pg_available_extensions WHERE name = 'vector';
--
-- IDEMPOTENT: IF NOT EXISTS makes this safe to re-run.
--
-- ROLLBACK: DROP EXTENSION IF EXISTS vector CASCADE;
--   WARNING: CASCADE will drop the embedding column and HNSW index if they exist.
--   Only roll back this migration if no downstream migrations have been applied.

CREATE EXTENSION IF NOT EXISTS vector;
