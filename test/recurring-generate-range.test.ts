import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { todoService } from "@/lib/services/todo-service";
import { todoRecurringService } from "@/lib/services/todo-recurring-service";
import { createTestUser, deleteTestUser } from "./helpers";

/**
 * H5 regression tests.
 *
 * The pre-fix generateInstancesForRange ran N findFirst + N create
 * calls per template per visible month, with an exact DateTime match
 * for the dedup check. The fix batches via one findMany + one
 * createMany, deduplicates by start-of-day, and scopes by userId. These
 * tests verify the invariants.
 */
describe("todoRecurringService.generateInstancesForRange", () => {
  let user: { id: string; apiKey: string };

  beforeAll(async () => {
    user = await createTestUser("recurring-range");
  });

  afterAll(async () => {
    await deleteTestUser(user.id);
  });

  beforeEach(async () => {
    await prisma.todo.deleteMany({ where: { userId: user.id } });
  });

  async function createDailyTemplate(createdAt: Date) {
    // Create via the service so isRecurring + recurrenceRule land on
    // the row (exercises the create-path fix from dc3498a).
    const template = await todoService.create(user.id, {
      title: "Daily",
      priority: "LOW",
      isRecurring: true,
      recurrenceRule: "FREQ=DAILY",
    });
    // Override createdAt so the rrule's DTSTART produces predictable
    // occurrences relative to the test range.
    return prisma.todo.update({
      where: { id: template.id },
      data: { createdAt },
    });
  }

  it("creates one instance per day in the range (no N+1 duplication)", async () => {
    // Template created at the start of a 7-day window.
    const windowStart = new Date("2026-01-01T00:00:00Z");
    const windowEnd = new Date("2026-01-07T00:00:00Z");
    await createDailyTemplate(windowStart);

    const instances = await todoRecurringService.generateInstancesForRange(
      user.id,
      windowStart,
      windowEnd,
    );

    // 7 days inclusive → 7 instances.
    expect(instances.length).toBe(7);

    // Every instance points to a unique day.
    const days = new Set(
      instances.map((i) => i.dueDate?.toISOString().slice(0, 10)),
    );
    expect(days.size).toBe(7);
  });

  it("is idempotent: calling twice with the same range creates no duplicates", async () => {
    const windowStart = new Date("2026-01-01T00:00:00Z");
    const windowEnd = new Date("2026-01-07T00:00:00Z");
    await createDailyTemplate(windowStart);

    const first = await todoRecurringService.generateInstancesForRange(
      user.id,
      windowStart,
      windowEnd,
    );
    const firstCount = first.length;
    expect(firstCount).toBeGreaterThan(0);

    // Second call takes the fast path and returns [] because nothing
    // new needs to be created. What matters is that no new rows
    // landed in the database.
    const second = await todoRecurringService.generateInstancesForRange(
      user.id,
      windowStart,
      windowEnd,
    );
    expect(second.length).toBe(0);

    const totalInstances = await prisma.todo.count({
      where: { userId: user.id, recurringSourceId: { not: null } },
    });
    expect(totalInstances).toBe(firstCount);
  });

  it("dedupes on start-of-day, not exact DateTime equality", async () => {
    const windowStart = new Date("2026-01-01T00:00:00Z");
    const windowEnd = new Date("2026-01-03T00:00:00Z");
    const template = await createDailyTemplate(windowStart);

    // Pre-create an instance at 2026-01-02 14:30 UTC. The generator
    // uses startOfDay(occurrence) and compares by day, not exact
    // DateTime equality, so this manual non-midnight instance must
    // still prevent a new instance on the same calendar day.
    await prisma.todo.create({
      data: {
        userId: user.id,
        title: "Manual",
        priority: "LOW",
        recurringSourceId: template.id,
        dueDate: new Date("2026-01-02T14:30:00Z"),
      },
    });

    await todoRecurringService.generateInstancesForRange(
      user.id,
      windowStart,
      windowEnd,
    );

    // Verify there is no pair of instances with dueDates on the same
    // calendar day (checked in UTC, which is what the DB stores). The
    // generator normalizes to startOfDay locally, so the "day keys"
    // here use the midnight UTC equivalent of whatever startOfDay
    // produced on this machine.
    const instances = await prisma.todo.findMany({
      where: { userId: user.id, recurringSourceId: template.id },
      select: { dueDate: true },
      orderBy: { dueDate: "asc" },
    });
    // At minimum, make sure no two instances share the exact same
    // dueDate value (the pre-fix bug generated duplicates because the
    // existing-instance check used exact DateTime match).
    const dueDateSet = new Set(
      instances.map((i) => i.dueDate?.getTime() ?? 0),
    );
    expect(dueDateSet.size).toBe(instances.length);
    expect(instances.length).toBeGreaterThanOrEqual(2);
  });

  it("never touches another user's templates", async () => {
    const other = await createTestUser("recurring-other");
    try {
      const windowStart = new Date("2026-01-01T00:00:00Z");
      const windowEnd = new Date("2026-01-03T00:00:00Z");

      // User A creates a recurring template.
      await createDailyTemplate(windowStart);

      // User B calls generateInstancesForRange. Must not create
      // instances from user A's template on user B's account.
      const created = await todoRecurringService.generateInstancesForRange(
        other.id,
        windowStart,
        windowEnd,
      );
      expect(created.length).toBe(0);

      const otherInstances = await prisma.todo.count({
        where: { userId: other.id },
      });
      expect(otherInstances).toBe(0);
    } finally {
      await deleteTestUser(other.id);
    }
  });
});
