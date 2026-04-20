---
name: ax:migrate
description: Safe Prisma migration orchestrator for Ascend. Wraps prisma migrate dev with pre-flight checks, SQL review, search_vector verification, backfill safety, and a post-migration audit. Use this instead of running prisma migrate dev directly. Enforces CLAUDE.md safety rule 6 at every step.
user_invocable: true
---

# ax:migrate

Standardized, safe flow for Prisma schema migrations in Ascend. This skill replaces running `prisma migrate dev` directly. It enforces the known danger zones (search_vector tsvector column, no db push, no migrate reset) and produces an audited migration trail.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**Non-negotiable:** CLAUDE.md safety rule 6 applies at every step. If at any point the skill detects that `search_vector` has been dropped, the migration is FAILED and manual recovery is required. The skill never runs `prisma db push` or `prisma migrate reset`.

**Forbidden phrases when any step fails:**
- "Migration complete" / "Schema updated" / "Ready to commit" / "Safe to deploy"
- Never report success if the post-migration search_vector verification fails

## When to Use

- Any time the Prisma schema (`prisma/schema.prisma`) has been modified
- Adding a new field, model, enum, or relation
- Changing field types (dangerous; requires explicit approval)
- Adding indexes
- As part of Wave task lists that include schema changes (e.g., Wave 1 Phase 1)

## When NOT to use

- For `prisma generate` only (no schema change, just regenerating the client). Run that directly: `npx prisma generate`
- For `prisma studio` (visual browser). Run that directly: `npx prisma studio`

## Usage

- `ax:migrate <name>` — run a migration with the given name (e.g., `ax:migrate add-context-type-field`)
- `ax:migrate` — will ask for a migration name before proceeding
- `ax:migrate --dry-run` — review the schema diff and generated SQL without applying

## Workflow

### Step 1: Pre-flight checks

Run these in parallel:

```bash
# Check git status (must be clean or explicitly allowed)
cd /Users/Shared/Domain/Code/Personal/ascend && git status --porcelain

# Check current migration status
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma migrate status 2>&1

# Verify search_vector column exists (baseline)
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma db execute --stdin <<'SQL' 2>&1
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ContextEntry' AND column_name = 'search_vector';
SQL

# Record row counts for comparison
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma db execute --stdin <<'SQL' 2>&1
SELECT
  (SELECT COUNT(*) FROM "Goal") as goals,
  (SELECT COUNT(*) FROM "Todo") as todos,
  (SELECT COUNT(*) FROM "ContextEntry") as context_entries,
  (SELECT COUNT(*) FROM "Category") as categories,
  (SELECT COUNT(*) FROM "User") as users;
SQL
```

**Abort if:**
- Migration status shows drift ("The database schema is not in sync")
- search_vector column does not exist (already in a broken state; fix that first)
- Previous migration is marked as failed (resolve it first)

**Warn if:**
- Git working tree is dirty (ask user: "Commit the schema change first, or proceed with uncommitted changes?")

### Step 2: Review the schema diff

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && git diff prisma/schema.prisma
```

Summarize the changes in plain language:
- New models: list them with fields
- New fields on existing models: list with types, nullable/required, defaults
- Changed fields: list with before/after types
- New enums or enum values
- New relations with cascade rules

If the diff touches `ContextEntry`, warn: "This migration touches ContextEntry. Extra caution: search_vector must survive."

### Step 3: Generate the migration (do NOT apply yet)

```bash
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma migrate dev --name <name> --create-only 2>&1
```

The `--create-only` flag generates the SQL file without applying it. This lets us review the SQL before execution.

### Step 4: Review the generated SQL

```bash
# Find the just-created migration
LATEST_MIGRATION=$(ls -td /Users/Shared/Domain/Code/Personal/ascend/apps/web/prisma/migrations/*/ | head -1)
cat "${LATEST_MIGRATION}migration.sql"
```

For each SQL statement, classify it:

| Classification | Examples | Action |
|---------------|----------|--------|
| SAFE | ADD COLUMN (nullable), CREATE TABLE, CREATE INDEX, ADD CONSTRAINT | Proceed |
| DANGEROUS | DROP COLUMN, ALTER COLUMN TYPE, DROP CONSTRAINT, DROP INDEX | Stop and ask user for explicit approval + rollback plan |
| FORBIDDEN | DROP TABLE on populated table, any operation on search_vector, DROP DATABASE | ABORT the migration |

If the migration adds a non-null column without a default, stop and present the backfill template (see below).

### Step 5: Launch the migration auditor

Spawn the `ascend-migration-auditor` agent with the migration SQL and the schema diff. It will verify:
- search_vector survival (static analysis of the SQL)
- Additive operations only
- Backfill idempotency
- Cascade safety
- Non-null column migration path

If the auditor returns BLOCKED, stop. Present the issues and ask the user how to proceed.

### Step 6: Apply the migration

If the auditor returns SAFE TO APPLY (or the user explicitly approves a REQUIRES REVIEW verdict):

```bash
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma migrate dev 2>&1
```

Note: `prisma migrate dev` will detect the already-created migration from Step 3 and apply it.

Capture the output. Verify it says "Your database is now in sync with your schema."

### Step 7: Post-migration verification

Run these in sequence:

```bash
# Verify search_vector survived
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma db execute --stdin <<'SQL' 2>&1
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ContextEntry' AND column_name = 'search_vector';
SQL

# Verify GIN index
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma db execute --stdin <<'SQL' 2>&1
SELECT indexname FROM pg_indexes
WHERE tablename = 'ContextEntry' AND indexdef LIKE '%search_vector%';
SQL

# Row count comparison
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma db execute --stdin <<'SQL' 2>&1
SELECT
  (SELECT COUNT(*) FROM "Goal") as goals,
  (SELECT COUNT(*) FROM "Todo") as todos,
  (SELECT COUNT(*) FROM "ContextEntry") as context_entries,
  (SELECT COUNT(*) FROM "Category") as categories,
  (SELECT COUNT(*) FROM "User") as users;
SQL
```

Compare row counts with Step 1. Flag any unexpected changes.

If search_vector is MISSING after the migration:
- **CRITICAL FAILURE.** The migration destroyed the tsvector column.
- Report the failure immediately.
- Recovery: run the original raw SQL migration that created search_vector (find it with `grep -rl "search_vector" prisma/migrations/`), read that migration, and re-execute the tsvector creation commands.

### Step 8: Regenerate Prisma client

```bash
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && npx prisma generate 2>&1
```

### Step 9: Type check

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && npx tsc --noEmit 2>&1
```

If types fail, the migration likely changed a field type or removed a field that services still reference. List the first 10 errors.

### Step 10: Report

```
ASCEND MIGRATION REPORT
=======================

Migration name: <name>
Date: D. M. YYYY HH:mm
Schema changes: <summary>

Pre-flight:
  Git state: clean | dirty (files)
  Migration status: up to date
  search_vector baseline: PRESENT

SQL review:
  Statements: N total (N safe, N dangerous, N forbidden)
  Auditor verdict: SAFE TO APPLY | REQUIRES REVIEW | BLOCKED

Post-migration:
  Applied: YES | NO (reason)
  search_vector: PRESENT | MISSING (CRITICAL)
  GIN index: PRESENT | MISSING
  Row counts: goals=N todos=N context=N categories=N users=N (delta: +/-N)
  Prisma client: regenerated
  TypeScript: PASS | FAIL (N errors)

VERDICT: MIGRATION COMPLETE | MIGRATION FAILED

Next steps:
- Run `ax:test` to verify the full build passes
- Update service methods if new fields need business logic
- Update Zod schemas in lib/validations.ts for new fields
- Add API routes for new endpoints if applicable
```

## Backfill Template

When a migration requires populating a new column on existing rows:

```sql
-- Pattern 1: Simple value backfill (most common)
-- Add nullable column
ALTER TABLE "ContextEntry" ADD COLUMN "type" TEXT;

-- Backfill with default (idempotent: WHERE IS NULL)
UPDATE "ContextEntry" SET "type" = 'note' WHERE "type" IS NULL;

-- Set NOT NULL + default for future rows
ALTER TABLE "ContextEntry" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "ContextEntry" ALTER COLUMN "type" SET DEFAULT 'note';


-- Pattern 2: Computed value backfill
-- Populate based on existing data
UPDATE "ContextEntry" SET "type" = CASE
  WHEN tags @> ARRAY['principle'] THEN 'principle'
  WHEN tags @> ARRAY['review'] THEN 'review'
  ELSE 'note'
END
WHERE "type" IS NULL;


-- Pattern 3: Relation migration (e.g., linkedEntryIds[] to ContextLink table)
-- Create new table first (in the same migration)
INSERT INTO "ContextLink" ("id", "sourceId", "targetId", "relation", "createdAt")
SELECT
  gen_random_uuid()::text,
  ce.id,
  unnest(ce."linkedEntryIds"),
  'references',
  NOW()
FROM "ContextEntry" ce
WHERE array_length(ce."linkedEntryIds", 1) > 0
ON CONFLICT DO NOTHING;
```

All backfill patterns use `WHERE ... IS NULL` or `ON CONFLICT DO NOTHING` to ensure idempotency. If the migration fails partway through and is re-run, the backfill produces the same result.

## What to Do if a Backfill Fails

1. **Check what executed:** read the migration SQL and query the affected table to see which statements completed.

2. **Do NOT run `prisma migrate reset`.** That drops search_vector.

3. **If the table is in a partial state** (some rows backfilled, some not):
   - Re-run only the backfill statement. Since it is idempotent (WHERE IS NULL), it will fill the remaining rows without duplicating.
   - Then manually mark the migration as applied:
     ```bash
     npx prisma migrate resolve --applied <migration-name>
     ```

4. **If a NOT NULL constraint failed** (because the backfill did not cover all rows):
   - Find the offending rows: `SELECT id FROM "ContextEntry" WHERE "type" IS NULL;`
   - Backfill them manually.
   - Re-run the ALTER COLUMN SET NOT NULL.
   - Mark the migration as applied.

5. **If data was corrupted** (wrong values written):
   - Run a corrective UPDATE with the right logic.
   - Verify with a SELECT.
   - Proceed.

6. **If the migration dropped a column or table you need:**
   - Restore from the most recent backup (production: Dokploy backup; dev: re-create DB).
   - Re-apply migrations from scratch: `npx prisma migrate deploy`.

## Rules

- **NEVER run `prisma db push` or `prisma migrate reset`.** This is safety rule 6. These commands drop search_vector.
- **ALWAYS review generated SQL before applying.** The `--create-only` flag is not optional; it is mandatory.
- **ALWAYS verify search_vector after migration.** Even if the migration does not touch ContextEntry, verify as a baseline.
- **ALWAYS record row counts before and after.** Unexpected row count changes indicate data loss or unintended cascade deletes.
- **ALWAYS regenerate the Prisma client after migration.** Forgetting this causes "field does not exist" errors at runtime.
- **ALWAYS run `npx tsc --noEmit` after migration.** Schema changes cascade into service types, validation types, and MCP tool types.
- **NEVER modify the SQL in a migration file after it has been applied.** Create a new migration instead. Prisma checksums applied migrations.
- **ALWAYS use kebab-case for migration names.** Example: `add-context-type-field`, not `addContextTypeField`.

## Related Skills and Agents

- `ascend-migration-auditor` agent: performs the detailed SQL review in Step 5
- `ax:test`: run after migration to verify build passes
- `ax:review`: run after migration + code changes to verify safety rules
- `ax:deploy-check`: includes migration sync check before deploy

## Edge Cases

- **Multiple pending migrations:** apply them one at a time via `prisma migrate dev`. Each gets its own audit.
- **Migration with seed data:** seed scripts should be idempotent. Run after migration, not during.
- **Enum changes:** Prisma generates `ALTER TYPE ... ADD VALUE` for new enum values. This is safe. Removing enum values is dangerous (existing rows may reference the removed value).
- **Renaming a column:** Prisma generates DROP + ADD (data loss). Use raw SQL instead: `ALTER TABLE ... RENAME COLUMN ... TO ...`. Create a custom migration with `prisma migrate dev --create-only` and replace the generated SQL.
