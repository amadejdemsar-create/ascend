-- Wave 2, Phase 4 post-backfill: HNSW index on ContextEntry.embedding
--
-- IMPORTANT: Apply this migration AFTER the Phase 4 embedding backfill
-- completes (apps/web/scripts/backfill-embeddings.ts). Building an HNSW
-- index on a column that is already populated is significantly faster than
-- building it on an empty column and then inserting rows one at a time,
-- because the bulk build uses a more efficient construction algorithm.
--
-- The migration file is authored now (Phase 1) so the SQL is reviewed
-- alongside the other schema changes, but it must NOT be applied until
-- the backfill has run to completion on both dev and prod.
--
-- OPERATOR: vector_cosine_ops provides the <=> cosine distance operator,
-- which is used by embeddingService.searchSemantic for ORDER BY embedding <=> $1.
--
-- DEPENDENCIES: Migration 20260425000001_enable_pgvector (extension) and
-- 20260425000002_wave2_ai_native_schema (embedding column) must be applied first.
--
-- ROLLBACK: DROP INDEX IF EXISTS "ContextEntry_embedding_hnsw_idx";
--
-- TUNING: Default HNSW parameters (m=16, ef_construction=64) are used.
-- If the graph grows beyond ~10K entries, consider tuning:
--   CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 24, ef_construction = 100);

CREATE INDEX IF NOT EXISTS "ContextEntry_embedding_hnsw_idx"
    ON "ContextEntry" USING hnsw (embedding vector_cosine_ops);
