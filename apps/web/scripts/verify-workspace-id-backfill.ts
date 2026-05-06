#!/usr/bin/env node
/**
 * Wave 8 Phase 2: Pre-flight backfill verification.
 *
 * For each of the 18 entity tables that should have workspaceId populated,
 * counts rows where workspaceId IS NULL. Prints a summary table and exits
 * non-zero if ANY count is non-zero.
 *
 * Usage: pnpm --filter @ascend/web exec tsx scripts/verify-workspace-id-backfill.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/db";

const TABLES = [
  // Category B: Wave 0 scaffolding (5)
  "Goal",
  "Category",
  "Todo",
  "ContextEntry",
  "File",
  // Category A: newly added in migration 3 (10)
  "BlockDocument",
  "ExtractionJob",
  "ContextLink",
  "ContextMap",
  "Database",
  "DatabaseField",
  "DatabaseRow",
  "DatabaseView",
  "LlmUsage",
  "ProgressLog",
  // Category C: Wave 7 (3)
  "NodeVersion",
  "EdgeEvent",
  "GraphDailySnapshot",
] as const;

interface CheckResult {
  table: string;
  nullCount: number;
  totalCount: number;
}

async function checkTable(table: string): Promise<CheckResult> {
  const [nullResult] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "${table}" WHERE "workspaceId" IS NULL`,
  );
  const [totalResult] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "${table}"`,
  );
  return {
    table,
    nullCount: Number(nullResult.count),
    totalCount: Number(totalResult.count),
  };
}

async function main() {
  console.log("Wave 8 Phase 2 backfill verification");
  console.log("=====================================");

  const results: CheckResult[] = [];
  let hasFailures = false;

  for (const table of TABLES) {
    const result = await checkTable(table);
    results.push(result);
    const status = result.nullCount === 0 ? "PASS" : "FAIL";
    if (result.nullCount > 0) hasFailures = true;
    const paddedTable = result.table.padEnd(22);
    console.log(
      `  ${paddedTable} null_workspace_id=${result.nullCount}  total=${result.totalCount}  ${status}`,
    );
  }

  console.log("=====================================");

  if (hasFailures) {
    const failedTables = results.filter((r) => r.nullCount > 0);
    console.log(
      `VERDICT: BLOCKED — ${failedTables.length} table(s) have null workspaceId rows. Migration 4 will refuse to apply. Re-run migration 3 backfill or investigate.`,
    );
    process.exit(1);
  } else {
    console.log("VERDICT: READY FOR MIGRATION 4 — PASS");
  }
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
