#!/usr/bin/env node
/**
 * CLI wrapper for the Wave 7 prod backfill.
 * Calls versionBackfillService.backfillAllUsers() and prints results.
 *
 * Usage: pnpm --filter @ascend/web exec tsx scripts/backfill-versions.ts
 *
 * For HTTP-triggered backfill (preferred for prod), see:
 *   POST /api/versions/backfill (cron-secret protected)
 */

import { prisma } from "@/lib/db";
import { versionBackfillService } from "@/lib/services/version-backfill-service";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  console.log(`Starting Wave 7 backfill for ${users.length} user(s)...`);

  const result = await versionBackfillService.backfillAllUsers();
  console.log("\nResult:", JSON.stringify(result, null, 2));
}

main()
  .then(() => console.log("\nBackfill complete."))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
