#!/usr/bin/env node
/**
 * Backfill embeddings for all ContextEntry rows that have NULL embedding.
 *
 * Calls embeddingService.upsertEmbeddingForEntry for each entry, which
 * generates a Gemini Embedding 2 vector (1536 dimensions) and writes it
 * to the embedding column via raw SQL. Every call goes through the budget
 * gate (DZ-9), so the daily cost cap is respected.
 *
 * Usage:
 *   pnpm --filter @ascend/web backfill:embeddings -- [options]
 *
 * Options:
 *   --dry-run               Print plan without calling Gemini or writing
 *   --user-id <id>          Embed only entries for one userId (default: all users)
 *   --batch-size <n>        Concurrent embeds per batch (default: 5)
 *   --rebuild-index         After backfill, REINDEX the HNSW index for quality
 *   --force                 Re-embed entries that already have a non-null embedding
 *   --limit <n>             Cap total entries processed (for cost-controlled testing)
 *
 * Production run (Dokploy container exec):
 *   cd /app/apps/web && node --import tsx/esm scripts/backfill-embeddings.ts --dry-run
 *
 * Idempotent: safe to re-run. Entries with existing embeddings are skipped
 * unless --force is passed. Individual entry failures are logged and skipped;
 * the script continues with remaining entries.
 *
 * Exit codes:
 *   0 — all entries embedded successfully (or dry-run)
 *   1 — env validation failed, or at least one entry failed to embed
 */

import { prisma } from "@/lib/db";
import { Prisma } from "../generated/prisma/client";
import { embeddingService } from "@/lib/services/embedding-service";
import { estimateEmbeddingCostCents } from "@ascend/llm";

// ── Argument parsing ────────────────────────────────────────────

interface CliArgs {
  dryRun: boolean;
  userId: string | null;
  batchSize: number;
  rebuildIndex: boolean;
  force: boolean;
  limit: number | null;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = {
    dryRun: false,
    userId: null,
    batchSize: 5,
    rebuildIndex: false,
    force: false,
    limit: null,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--user-id":
        args.userId = argv[++i] ?? null;
        if (!args.userId) {
          console.error("--user-id requires a value.");
          process.exit(1);
        }
        break;
      case "--batch-size": {
        const val = parseInt(argv[++i], 10);
        if (isNaN(val) || val < 1) {
          console.error("--batch-size must be a positive integer.");
          process.exit(1);
        }
        args.batchSize = val;
        break;
      }
      case "--rebuild-index":
        args.rebuildIndex = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--limit": {
        const val = parseInt(argv[++i], 10);
        if (isNaN(val) || val < 1) {
          console.error("--limit must be a positive integer.");
          process.exit(1);
        }
        args.limit = val;
        break;
      }
      case "--":
        // pnpm passes a bare "--" separator; ignore it
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        console.error(
          "Usage: backfill-embeddings.ts [--dry-run] [--user-id <id>] " +
            "[--batch-size <n>] [--rebuild-index] [--force] [--limit <n>]",
        );
        process.exit(1);
    }
  }

  return args;
}

// ── Entry row type from raw SQL ─────────────────────────────────

interface EntryRow {
  id: string;
  userId: string;
  title: string;
  content: string | null;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // 1. Validate GEMINI_API_KEY
  if (!process.env.GEMINI_API_KEY) {
    console.error(
      "GEMINI_API_KEY environment variable is required.\n" +
        "Set it before running: GEMINI_API_KEY=... pnpm --filter @ascend/web backfill:embeddings",
    );
    process.exit(1);
  }

  // 2. Query entries that need embedding via raw SQL
  //    (the embedding column is Unsupported in Prisma, so we must use raw queries)
  const embeddingCondition = args.force
    ? Prisma.sql`TRUE`
    : Prisma.sql`embedding IS NULL`;

  const userCondition = args.userId
    ? Prisma.sql`"userId" = ${args.userId}`
    : Prisma.sql`TRUE`;

  const limitClause = args.limit
    ? Prisma.sql`LIMIT ${args.limit}`
    : Prisma.sql``;

  const entries = await prisma.$queryRaw<EntryRow[]>`
    SELECT id, "userId", title, content
    FROM "ContextEntry"
    WHERE ${embeddingCondition}
      AND ${userCondition}
    ORDER BY "userId", "createdAt" ASC
    ${limitClause}
  `;

  // 3. Print the plan
  const totalEntries = entries.length;

  // Group by userId for progress reporting
  const byUser = new Map<string, EntryRow[]>();
  for (const entry of entries) {
    const userEntries = byUser.get(entry.userId) ?? [];
    userEntries.push(entry);
    byUser.set(entry.userId, userEntries);
  }

  // Estimate tokens and cost
  let totalEstimatedTokens = 0;
  for (const entry of entries) {
    const text = `${entry.title}\n\n${entry.content ?? ""}`.trim();
    totalEstimatedTokens += Math.ceil(text.length / 4);
  }
  const estimatedCostCents = estimateEmbeddingCostCents(totalEstimatedTokens);

  console.log("=== Embedding Backfill Plan ===");
  console.log(`Entries to process: ${totalEntries}`);
  console.log(`Users: ${byUser.size}`);
  console.log(`Estimated tokens: ${totalEstimatedTokens.toLocaleString()}`);
  console.log(
    `Estimated cost: $${(estimatedCostCents / 100).toFixed(4)} (${estimatedCostCents} cents)`,
  );
  console.log(`Batch size: ${args.batchSize}`);
  console.log(`Force re-embed: ${args.force}`);
  if (args.userId) console.log(`Filtered to userId: ${args.userId}`);
  if (args.limit) console.log(`Capped at: ${args.limit} entries`);
  console.log("");

  if (totalEntries === 0) {
    console.log("Nothing to do. All entries already have embeddings.");
    await prisma.$disconnect();
    process.exit(0);
  }

  // 4. If dry-run, stop here
  if (args.dryRun) {
    console.log("[dry-run] Exiting without making any changes.");
    await prisma.$disconnect();
    process.exit(0);
  }

  // 5. Process entries in batches per user
  let globalOk = 0;
  let globalFail = 0;
  let globalProcessed = 0;
  const failedEntries: Array<{ id: string; error: string }> = [];
  const startTime = Date.now();

  for (const [userId, userEntries] of byUser) {
    console.log(
      `\nProcessing user ${userId} (${userEntries.length} entries)...`,
    );

    for (let i = 0; i < userEntries.length; i += args.batchSize) {
      const batch = userEntries.slice(i, i + args.batchSize);
      const results = await Promise.allSettled(
        batch.map((entry) =>
          embeddingService.upsertEmbeddingForEntry(entry.userId, entry.id),
        ),
      );

      let batchOk = 0;
      let batchFail = 0;

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          batchOk++;
        } else {
          batchFail++;
          const errMsg =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          failedEntries.push({
            id: batch[j].id,
            error: errMsg.slice(0, 100),
          });
          console.error(
            `  FAIL entry=${batch[j].id} error="${errMsg.slice(0, 50)}"`,
          );
        }
      }

      globalOk += batchOk;
      globalFail += batchFail;
      globalProcessed += batch.length;

      console.log(
        `  [${globalProcessed}/${totalEntries}] user=${userId.slice(0, 8)}... ok=${batchOk} fail=${batchFail}`,
      );
    }
  }

  // 6. Print summary
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n=== Backfill Summary ===");
  console.log(`Total processed: ${globalProcessed}`);
  console.log(`Successful: ${globalOk}`);
  console.log(`Failed: ${globalFail}`);
  console.log(`Elapsed: ${elapsedSec}s`);
  console.log(
    `Estimated cost: $${(estimatedCostCents / 100).toFixed(4)}`,
  );

  if (failedEntries.length > 0) {
    console.log("\nFailed entries:");
    for (const f of failedEntries) {
      console.log(`  ${f.id}: ${f.error}`);
    }
  }

  // 7. Optionally rebuild the HNSW index
  if (args.rebuildIndex) {
    console.log("\nRebuilding HNSW index...");
    const reindexStart = Date.now();
    await prisma.$executeRawUnsafe(
      'REINDEX INDEX "ContextEntry_embedding_hnsw_idx";',
    );
    const reindexSec = ((Date.now() - reindexStart) / 1000).toFixed(1);
    console.log(`HNSW index rebuilt in ${reindexSec}s.`);
  }

  // 8. Disconnect and exit
  await prisma.$disconnect();

  if (globalFail > 0) {
    console.error(
      `\nExiting with code 1 due to ${globalFail} failed entries.`,
    );
    process.exit(1);
  }

  console.log("\nBackfill complete.");
  process.exit(0);
}

main().catch(async (err) => {
  console.error(
    "Backfill script crashed:",
    err instanceof Error ? err.message : String(err),
  );
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
