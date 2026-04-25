# Embedding Backfill

Generates Gemini Embedding 2 vectors (1536 dimensions) for all ContextEntry
rows that have a NULL embedding column. Idempotent on re-run: entries with
existing embeddings are skipped unless `--force` is passed. Individual entry
failures are logged and skipped; the script continues with remaining entries.

## Local run (dev DB)

Requires a local PostgreSQL with pgvector extension installed and the Wave 2
migrations applied (`prisma migrate deploy`). Also requires `GEMINI_API_KEY`.

```bash
# Dry run (no Gemini calls, no writes)
GEMINI_API_KEY=... pnpm --filter @ascend/web backfill:embeddings -- --dry-run

# Full backfill
GEMINI_API_KEY=... pnpm --filter @ascend/web backfill:embeddings

# Backfill with options
GEMINI_API_KEY=... pnpm --filter @ascend/web backfill:embeddings -- \
  --batch-size 3 --limit 50 --rebuild-index
```

## Production run (Dokploy container exec)

Open a shell in the running Dokploy container (via the Dokploy dashboard
terminal or `docker exec`) and run:

```bash
cd /app/apps/web

# Dry run first (always)
node --import tsx/esm scripts/backfill-embeddings.ts --dry-run

# Full backfill
node --import tsx/esm scripts/backfill-embeddings.ts

# With HNSW index rebuild after backfill
node --import tsx/esm scripts/backfill-embeddings.ts --rebuild-index
```

`GEMINI_API_KEY` and `DATABASE_URL` are already in the container env via
Dokploy. No extra env setup needed.

## Options

| Flag              | Default | Description                                          |
|-------------------|---------|------------------------------------------------------|
| `--dry-run`       | false   | Print plan without calling Gemini or writing          |
| `--user-id <id>`  | all     | Embed only entries for one userId                     |
| `--batch-size <n>`| 5       | Concurrent embeds per batch (safe for 100 RPM limit)  |
| `--rebuild-index` | false   | REINDEX the HNSW index after backfill for quality     |
| `--force`         | false   | Re-embed entries that already have a non-null embedding |
| `--limit <n>`     | none    | Cap total entries processed (for cost-controlled testing) |

## Cost expectations

Gemini Embedding 2 pricing: $0.20 per 1M input tokens.

| Entries | Avg tokens/entry | Total tokens | Estimated cost |
|---------|------------------|--------------|----------------|
| 100     | 500              | 50,000       | $0.01          |
| 500     | 500              | 250,000      | $0.05          |
| 1,000   | 500              | 500,000      | $0.10          |
| 5,000   | 500              | 2,500,000    | $0.50          |

The `--dry-run` flag prints the exact estimated cost before any API calls.

## HNSW index

The HNSW index migration (`20260425000003_embedding_hnsw_index`) is applied
automatically by `prisma migrate deploy` at container startup. If the index
was built on an empty column (before the backfill), its internal graph
structure is suboptimal. Use `--rebuild-index` after a large backfill to
reconstruct the graph with actual data, which improves query performance.

For small datasets (under 1,000 entries) the difference is negligible.

## Exit codes

- **0**: All entries embedded successfully (or dry-run completed)
- **1**: Environment validation failed, or at least one entry failed to embed
