#!/usr/bin/env node
/**
 * Backfill v1 NodeVersions and CREATED EdgeEvents for all existing entities.
 *
 * Creates the "starting state" for the version history introduced in Wave 7.
 * For every existing ContextEntry, Goal, Todo, DatabaseRow, and DatabaseField
 * that has no NodeVersion, this script creates a v1 snapshot with trigger
 * BACKFILL. For every ContextLink (when the user has no EdgeEvents), it
 * creates a CREATED EdgeEvent.
 *
 * Serialization matches `versioningService._fetchEntityPayload` exactly so
 * content hashes are consistent with future snapshots.
 *
 * Usage:
 *   pnpm --filter @ascend/web exec tsx scripts/backfill-versions.ts
 *
 * Idempotent: safe to re-run. Entities with existing NodeVersions are
 * skipped. Users with existing EdgeEvents skip the link backfill entirely.
 *
 * Exit codes:
 *   0 — all entities processed successfully
 *   1 — uncaught error during execution
 */

import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";

// ── Constants ─────────────────────────────────────────────────────────

const MAX_BYTE_SIZE = 10 * 1024 * 1024; // 10 MiB
const PAGE_SIZE = 100;
const LINK_PAGE_SIZE = 200;

// ── Types ─────────────────────────────────────────────────────────────

type EntityCounts = { created: number; skipped: number; oversized: number };
type LinkCounts = { created: number; skipped: number };

type CountSummary = {
  contextEntries: EntityCounts;
  goals: EntityCounts;
  todos: EntityCounts;
  databaseRows: EntityCounts;
  databaseFields: EntityCounts;
  contextLinks: LinkCounts;
};

function newEntityCounts(): EntityCounts {
  return { created: 0, skipped: 0, oversized: 0 };
}

function newSummary(): CountSummary {
  return {
    contextEntries: newEntityCounts(),
    goals: newEntityCounts(),
    todos: newEntityCounts(),
    databaseRows: newEntityCounts(),
    databaseFields: newEntityCounts(),
    contextLinks: { created: 0, skipped: 0 },
  };
}

function mergeSummary(totals: CountSummary, user: CountSummary): void {
  for (const key of Object.keys(totals) as (keyof CountSummary)[]) {
    const t = totals[key];
    const u = user[key];
    for (const field of Object.keys(t) as (keyof typeof t)[]) {
      (t as Record<string, number>)[field] += (u as Record<string, number>)[field];
    }
  }
}

// ── Hashing helpers ───────────────────────────────────────────────────

function computeHash(serialized: string): string {
  return createHash("sha256").update(serialized).digest("hex");
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log(`Backfilling versions for ${users.length} user(s).\n`);

  const totals = newSummary();

  for (const user of users) {
    console.log(`\n--- User: ${user.email} (${user.id}) ---`);
    const userSummary = await backfillUser(user.id);
    console.log(`  Summary:`, JSON.stringify(userSummary, null, 2));
    mergeSummary(totals, userSummary);
  }

  console.log(`\n=== Totals ===`);
  console.log(JSON.stringify(totals, null, 2));
}

// ── Per-user orchestration ────────────────────────────────────────────

async function backfillUser(userId: string): Promise<CountSummary> {
  const summary = newSummary();
  await backfillContextEntries(userId, summary);
  await backfillGoals(userId, summary);
  await backfillTodos(userId, summary);
  await backfillDatabaseRows(userId, summary);
  await backfillDatabaseFields(userId, summary);
  await backfillContextLinks(userId, summary);
  return summary;
}

// ── ContextEntry backfill ─────────────────────────────────────────────

async function backfillContextEntries(userId: string, summary: CountSummary) {
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    const entries = await prisma.contextEntry.findMany({
      where: { userId },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      include: { blockDocument: true, category: true },
    });
    if (entries.length === 0) break;

    for (const entry of entries) {
      const existing = await prisma.nodeVersion.findFirst({
        where: { userId, nodeType: "CONTEXT_ENTRY", nodeId: entry.id },
        select: { id: true },
      });
      if (existing) {
        summary.contextEntries.skipped++;
        continue;
      }

      // Serialize matching versioningService._fetchEntityPayload shape
      const { blockDocument, ...rest } = entry;
      const payload = {
        ...rest,
        blockDocumentSnapshot: blockDocument?.snapshot ?? null,
        blockDocumentVersion: blockDocument?.version ?? null,
      };

      const serialized = JSON.stringify(payload);
      const byteSize = Buffer.byteLength(serialized, "utf8");
      if (byteSize > MAX_BYTE_SIZE) {
        summary.contextEntries.oversized++;
        console.warn(`  [WARN] Oversized CONTEXT_ENTRY ${entry.id} (${byteSize} bytes), skipping`);
        continue;
      }

      const contentHash = computeHash(serialized);
      await prisma.nodeVersion.create({
        data: {
          userId,
          nodeType: "CONTEXT_ENTRY",
          nodeId: entry.id,
          versionNumber: 1,
          payload: payload as never,
          contentHash,
          byteSize,
          trigger: "BACKFILL",
        },
      });
      summary.contextEntries.created++;
      processed++;
      if (processed % 100 === 0) {
        console.log(`  ContextEntry: ${processed} created so far`);
      }
    }

    cursor = entries[entries.length - 1].id;
    if (entries.length < PAGE_SIZE) break;
  }
}

// ── Goal backfill ─────────────────────────────────────────────────────

async function backfillGoals(userId: string, summary: CountSummary) {
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    const goals = await prisma.goal.findMany({
      where: { userId },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });
    if (goals.length === 0) break;

    for (const goal of goals) {
      const existing = await prisma.nodeVersion.findFirst({
        where: { userId, nodeType: "GOAL", nodeId: goal.id },
        select: { id: true },
      });
      if (existing) {
        summary.goals.skipped++;
        continue;
      }

      const payload = goal;
      const serialized = JSON.stringify(payload);
      const byteSize = Buffer.byteLength(serialized, "utf8");
      if (byteSize > MAX_BYTE_SIZE) {
        summary.goals.oversized++;
        console.warn(`  [WARN] Oversized GOAL ${goal.id} (${byteSize} bytes), skipping`);
        continue;
      }

      const contentHash = computeHash(serialized);
      await prisma.nodeVersion.create({
        data: {
          userId,
          nodeType: "GOAL",
          nodeId: goal.id,
          versionNumber: 1,
          payload: payload as never,
          contentHash,
          byteSize,
          trigger: "BACKFILL",
        },
      });
      summary.goals.created++;
      processed++;
      if (processed % 100 === 0) {
        console.log(`  Goal: ${processed} created so far`);
      }
    }

    cursor = goals[goals.length - 1].id;
    if (goals.length < PAGE_SIZE) break;
  }
}

// ── Todo backfill ─────────────────────────────────────────────────────

async function backfillTodos(userId: string, summary: CountSummary) {
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    const todos = await prisma.todo.findMany({
      where: { userId },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });
    if (todos.length === 0) break;

    for (const todo of todos) {
      const existing = await prisma.nodeVersion.findFirst({
        where: { userId, nodeType: "TODO", nodeId: todo.id },
        select: { id: true },
      });
      if (existing) {
        summary.todos.skipped++;
        continue;
      }

      const payload = todo;
      const serialized = JSON.stringify(payload);
      const byteSize = Buffer.byteLength(serialized, "utf8");
      if (byteSize > MAX_BYTE_SIZE) {
        summary.todos.oversized++;
        console.warn(`  [WARN] Oversized TODO ${todo.id} (${byteSize} bytes), skipping`);
        continue;
      }

      const contentHash = computeHash(serialized);
      await prisma.nodeVersion.create({
        data: {
          userId,
          nodeType: "TODO",
          nodeId: todo.id,
          versionNumber: 1,
          payload: payload as never,
          contentHash,
          byteSize,
          trigger: "BACKFILL",
        },
      });
      summary.todos.created++;
      processed++;
      if (processed % 100 === 0) {
        console.log(`  Todo: ${processed} created so far`);
      }
    }

    cursor = todos[todos.length - 1].id;
    if (todos.length < PAGE_SIZE) break;
  }
}

// ── DatabaseRow backfill ──────────────────────────────────────────────

async function backfillDatabaseRows(userId: string, summary: CountSummary) {
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    const rows = await prisma.databaseRow.findMany({
      where: { userId },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      include: { contextEntry: { include: { blockDocument: true } } },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const existing = await prisma.nodeVersion.findFirst({
        where: { userId, nodeType: "DATABASE_ROW", nodeId: row.id },
        select: { id: true },
      });
      if (existing) {
        summary.databaseRows.skipped++;
        continue;
      }

      // Match versioningService: include bodySnapshot from linked entry's blockDocument
      const payload = {
        ...row,
        bodySnapshot: row.contextEntry.blockDocument?.snapshot ?? null,
      };

      const serialized = JSON.stringify(payload);
      const byteSize = Buffer.byteLength(serialized, "utf8");
      if (byteSize > MAX_BYTE_SIZE) {
        summary.databaseRows.oversized++;
        console.warn(`  [WARN] Oversized DATABASE_ROW ${row.id} (${byteSize} bytes), skipping`);
        continue;
      }

      const contentHash = computeHash(serialized);
      await prisma.nodeVersion.create({
        data: {
          userId,
          nodeType: "DATABASE_ROW",
          nodeId: row.id,
          versionNumber: 1,
          payload: payload as never,
          contentHash,
          byteSize,
          trigger: "BACKFILL",
        },
      });
      summary.databaseRows.created++;
      processed++;
      if (processed % 100 === 0) {
        console.log(`  DatabaseRow: ${processed} created so far`);
      }
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < PAGE_SIZE) break;
  }
}

// ── DatabaseField backfill ────────────────────────────────────────────

async function backfillDatabaseFields(userId: string, summary: CountSummary) {
  let cursor: string | undefined;
  let processed = 0;

  while (true) {
    const fields = await prisma.databaseField.findMany({
      where: { userId },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });
    if (fields.length === 0) break;

    for (const field of fields) {
      const existing = await prisma.nodeVersion.findFirst({
        where: { userId, nodeType: "DATABASE_FIELD", nodeId: field.id },
        select: { id: true },
      });
      if (existing) {
        summary.databaseFields.skipped++;
        continue;
      }

      const payload = field;
      const serialized = JSON.stringify(payload);
      const byteSize = Buffer.byteLength(serialized, "utf8");
      if (byteSize > MAX_BYTE_SIZE) {
        summary.databaseFields.oversized++;
        console.warn(`  [WARN] Oversized DATABASE_FIELD ${field.id} (${byteSize} bytes), skipping`);
        continue;
      }

      const contentHash = computeHash(serialized);
      await prisma.nodeVersion.create({
        data: {
          userId,
          nodeType: "DATABASE_FIELD",
          nodeId: field.id,
          versionNumber: 1,
          payload: payload as never,
          contentHash,
          byteSize,
          trigger: "BACKFILL",
        },
      });
      summary.databaseFields.created++;
      processed++;
      if (processed % 100 === 0) {
        console.log(`  DatabaseField: ${processed} created so far`);
      }
    }

    cursor = fields[fields.length - 1].id;
    if (fields.length < PAGE_SIZE) break;
  }
}

// ── ContextLink backfill (EdgeEvents) ─────────────────────────────────

async function backfillContextLinks(userId: string, summary: CountSummary) {
  // Idempotency heuristic: if user already has any EdgeEvent rows,
  // skip the entire link backfill for this user. Backfill is one-shot;
  // if EdgeEvents exist, it has already been run.
  const existingEvent = await prisma.edgeEvent.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (existingEvent) {
    const linkCount = await prisma.contextLink.count({ where: { userId } });
    summary.contextLinks.skipped = linkCount;
    return;
  }

  let cursor: string | undefined;

  while (true) {
    const links = await prisma.contextLink.findMany({
      where: { userId },
      take: LINK_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });
    if (links.length === 0) break;

    for (const link of links) {
      await prisma.edgeEvent.create({
        data: {
          userId,
          eventType: "CREATED",
          linkSnapshot: link as never,
          fromEntryId: link.fromEntryId,
          toEntryId: link.toEntryId,
        },
      });
      summary.contextLinks.created++;
    }

    cursor = links[links.length - 1].id;
    if (links.length < LINK_PAGE_SIZE) break;
  }
}

// ── Entry point ───────────────────────────────────────────────────────

main()
  .then(() => {
    console.log("\nBackfill complete.");
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(
      "Backfill script crashed:",
      err instanceof Error ? err.message : String(err),
    );
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
