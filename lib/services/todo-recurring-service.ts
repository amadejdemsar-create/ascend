import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import { bumpStreak, clampStreakDown } from "@/lib/services/recurring-helpers";
import { rrulestr } from "rrule";
import { startOfDay, endOfDay, subDays, addDays, format, isBefore } from "date-fns";

// Reusable client type so methods can run inside an interactive
// $transaction or standalone. See goal-service.ts for the same pattern.
type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

/**
 * Build a full rrule string with DTSTART from the template's creation date.
 * rrulestr() requires DTSTART to generate occurrences within a date range.
 */
function buildRruleString(rule: string, dtstart: Date): string {
  const dt = format(dtstart, "yyyyMMdd'T'000000'Z'");
  const cleanRule = rule.replace(/^RRULE:/i, "");
  return `DTSTART:${dt}\nRRULE:${cleanRule}`;
}

/**
 * Recurring to-do service: instance generation via rrule, streak tracking,
 * and consistency score calculation.
 *
 * A recurring "template" is a to-do with isRecurring=true and no recurringSourceId.
 * An "instance" is a to-do created from a template, with recurringSourceId pointing
 * back to the template. Templates carry streak and consistency data.
 *
 * Unlike the goal recurring service which uses frequency + interval, to-do recurrence
 * uses standard rrule strings (RFC 5545) for full flexibility (e.g., "FREQ=WEEKLY;BYDAY=TU,TH").
 */
export const todoRecurringService = {
  /**
   * Parse an rrule string and return all occurrences between start and end dates.
   * Used by the calendar view to show recurring to-do markers.
   */
  getOccurrences(rruleString: string, start: Date, end: Date, dtstart?: Date): Date[] {
    const fullRule = buildRruleString(rruleString, dtstart ?? new Date("2026-01-01"));
    const rule = rrulestr(fullRule);
    return rule.between(start, end, true);
  },

  /**
   * Generate due instances for all recurring to-do templates belonging to a user.
   *
   * For each template:
   *   1. Parse the rrule to find the next occurrence from today
   *   2. Check if a pending instance already exists for that date
   *   3. Check if the streak is broken (previous occurrence was missed)
   *   4. Create the new instance
   *
   * Returns the array of newly created instances.
   */
  async generateDueInstances(userId: string) {
    const templates = await prisma.todo.findMany({
      where: {
        userId,
        isRecurring: true,
        recurringSourceId: null,
        status: "PENDING",
      },
    });

    const created: Array<Record<string, unknown>> = [];
    const today = startOfDay(new Date());

    for (const template of templates) {
      if (!template.recurrenceRule) continue;

      const rule = rrulestr(buildRruleString(template.recurrenceRule, template.createdAt));

      // Find the next occurrence from today (inclusive)
      const nextOccurrence = rule.after(today, true);
      if (!nextOccurrence) continue;

      const nextDate = startOfDay(nextOccurrence);

      // Check if a pending instance already exists for this date
      const existingInstance = await prisma.todo.findFirst({
        where: {
          userId,
          recurringSourceId: template.id,
          status: "PENDING",
          dueDate: nextDate,
        },
      });

      if (existingInstance) continue;

      // Check if streak is broken: was the previous occurrence missed?
      // Use updateMany so we can scope by userId as defense-in-depth, even
      // though the template was already fetched via a user-scoped findMany.
      const previousOccurrence = rule.before(today, false);
      if (previousOccurrence && template.lastCompletedDate) {
        const prevDate = startOfDay(previousOccurrence);
        const lastCompleted = startOfDay(template.lastCompletedDate);

        // If the previous occurrence is after the last completed date, streak is broken
        if (prevDate > lastCompleted && template.currentStreak > 0) {
          await prisma.todo.updateMany({
            where: { id: template.id, userId },
            data: { currentStreak: 0 },
          });
        }
      } else if (previousOccurrence && !template.lastCompletedDate && template.currentStreak > 0) {
        // Has a previous occurrence but was never completed at all
        await prisma.todo.updateMany({
          where: { id: template.id, userId },
          data: { currentStreak: 0 },
        });
      }

      // Create the new instance
      const instance = await prisma.todo.create({
        data: {
          userId,
          title: template.title,
          description: template.description,
          priority: template.priority,
          goalId: template.goalId,
          categoryId: template.categoryId,
          recurringSourceId: template.id,
          dueDate: nextDate,
          scheduledDate: nextDate,
        },
      });

      created.push(instance as unknown as Record<string, unknown>);
    }

    return created;
  },

  /**
   * Generate recurring to-do instances for all occurrences within a date range.
   * Used by the calendar to ensure instances exist for every visible day in
   * the month.
   *
   * Implementation notes:
   * - Batches via a single findMany + createMany instead of N per-occurrence
   *   findFirst/create pairs. This removes the N+1 that previously fired on
   *   every calendar month navigation.
   * - Dedup keys compare by start-of-day rather than exact DateTime equality,
   *   so pre-existing instances with any time-of-day still prevent duplicates.
   * - Every query is userId-scoped.
   *
   * Returns the array of newly created instances.
   */
  async generateInstancesForRange(userId: string, start: Date, end: Date) {
    const templates = await prisma.todo.findMany({
      where: {
        userId,
        isRecurring: true,
        recurringSourceId: null,
        status: "PENDING",
      },
    });

    if (templates.length === 0) return [];

    const rangeStart = startOfDay(start);
    const rangeEnd = startOfDay(addDays(end, 1)); // inclusive end

    // Compute the list of occurrence days we'd want to materialize,
    // grouped by template. Each occurrence is normalized to startOfDay.
    const templateOccurrences = new Map<string, Date[]>();
    for (const template of templates) {
      if (!template.recurrenceRule) continue;
      const rule = rrulestr(buildRruleString(template.recurrenceRule, template.createdAt));
      const occurrences = rule
        .between(rangeStart, rangeEnd, true)
        .map((d) => startOfDay(d));
      if (occurrences.length > 0) {
        templateOccurrences.set(template.id, occurrences);
      }
    }

    if (templateOccurrences.size === 0) return [];

    // Fetch every existing instance for ALL templates in the range with a
    // single query, then index by "templateId|dayTimestamp" for O(1) lookup.
    // Day-based comparison so legacy instances with non-midnight dueDate
    // are still deduped correctly.
    const templateIds = Array.from(templateOccurrences.keys());
    const existingInstances = await prisma.todo.findMany({
      where: {
        userId,
        recurringSourceId: { in: templateIds },
        dueDate: { gte: rangeStart, lt: rangeEnd },
      },
      select: { recurringSourceId: true, dueDate: true },
    });

    const existingKeys = new Set<string>();
    for (const inst of existingInstances) {
      if (inst.recurringSourceId && inst.dueDate) {
        existingKeys.add(`${inst.recurringSourceId}|${startOfDay(inst.dueDate).getTime()}`);
      }
    }

    // Build the full createMany payload in-memory, skipping any key that
    // already exists. Update existingKeys as we go so duplicate rrule
    // occurrences within the same template batch are also deduped.
    const templatesById = new Map(templates.map((t) => [t.id, t]));
    const instancesToCreate: Prisma.TodoCreateManyInput[] = [];

    for (const [templateId, occurrences] of templateOccurrences) {
      const template = templatesById.get(templateId);
      if (!template) continue;
      for (const occDate of occurrences) {
        const key = `${templateId}|${occDate.getTime()}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        instancesToCreate.push({
          userId,
          title: template.title,
          description: template.description,
          priority: template.priority,
          goalId: template.goalId,
          categoryId: template.categoryId,
          recurringSourceId: template.id,
          dueDate: occDate,
          scheduledDate: occDate,
        });
      }
    }

    if (instancesToCreate.length === 0) return [];

    // Single batch insert. skipDuplicates guards against races with
    // concurrent calendar navigations.
    await prisma.todo.createMany({
      data: instancesToCreate,
      skipDuplicates: true,
    });

    // Refetch the actual rows so the caller has a consistent shape.
    // createMany does not return records on Postgres.
    return prisma.todo.findMany({
      where: {
        userId,
        recurringSourceId: { in: templateIds },
        dueDate: { gte: rangeStart, lt: rangeEnd },
      },
      orderBy: { dueDate: "asc" },
    });
  },

  /**
   * Handle completion of a recurring to-do instance: update the template's streak data
   * and recalculate the 30-day consistency score.
   *
   * Streak logic:
   *   - currentStreak increments by 1
   *   - longestStreak = max(longestStreak, newStreak)
   *   - lastCompletedDate = now
   *
   * Consistency score:
   *   - Count completed instances in last 30 days
   *   - Count expected occurrences via rrule in last 30 days
   *   - Score = round((completed / expected) * 100), clamped 0 to 100
   *   - If expected = 0, score = 100 (no occurrences expected means perfect)
   */
  async completeRecurringInstance(
    userId: string,
    instanceId: string,
    client: PrismaClientLike = prisma,
  ) {
    const instance = await client.todo.findFirst({
      where: { id: instanceId, userId },
    });

    if (!instance || !instance.recurringSourceId) {
      throw new Error("Not a recurring instance");
    }

    const template = await client.todo.findFirst({
      where: { id: instance.recurringSourceId, userId },
    });

    if (!template) {
      throw new Error("Recurring template not found");
    }

    const { currentStreak: newStreak, longestStreak: newLongest } = bumpStreak({
      currentStreak: template.currentStreak,
      longestStreak: template.longestStreak,
    });

    // Calculate 30-day consistency score
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const completedCount = await client.todo.count({
      where: {
        userId,
        recurringSourceId: template.id,
        status: "DONE",
        completedAt: { gte: thirtyDaysAgo },
      },
    });

    let consistencyScore = 100;
    if (template.recurrenceRule) {
      const rule = rrulestr(buildRruleString(template.recurrenceRule, template.createdAt));
      const expectedOccurrences = rule.between(thirtyDaysAgo, now, true);
      const expectedCount = expectedOccurrences.length;

      if (expectedCount > 0) {
        // Add 1 to completedCount because the current completion may not be saved yet
        consistencyScore = Math.round(((completedCount + 1) / expectedCount) * 100);
        consistencyScore = Math.min(100, Math.max(0, consistencyScore));
      }
    }

    // Template ownership was already verified via the findFirst above.
    const updated = await client.todo.update({
      where: { id: template.id },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCompletedDate: now,
        consistencyScore,
      },
    });

    return {
      templateId: updated.id,
      currentStreak: updated.currentStreak,
      longestStreak: updated.longestStreak,
      lastCompletedDate: updated.lastCompletedDate,
      consistencyScore: updated.consistencyScore,
    };
  },

  /**
   * Reverse a recurring instance completion: decrement the template's
   * currentStreak (clamped to 0) and recompute the 30-day consistency
   * score from the post-uncomplete database state. Does NOT touch
   * lastCompletedDate (that points to the most recent completion which
   * may belong to a different instance) or longestStreak (a high-water
   * mark that should never decrease).
   *
   * Accepts an optional Prisma client to participate in a transaction.
   */
  async reverseRecurringInstance(
    userId: string,
    instanceId: string,
    client: PrismaClientLike = prisma,
  ) {
    const instance = await client.todo.findFirst({
      where: { id: instanceId, userId },
    });

    if (!instance || !instance.recurringSourceId) {
      throw new Error("Not a recurring instance");
    }

    const template = await client.todo.findFirst({
      where: { id: instance.recurringSourceId, userId },
    });

    if (!template) {
      throw new Error("Recurring template not found");
    }

    const newStreak = clampStreakDown(template.currentStreak);

    // Recompute consistency from CURRENT db state. This call runs after
    // the instance has been moved back to PENDING by the caller, so the
    // count below already excludes it.
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const completedCount = await client.todo.count({
      where: {
        userId,
        recurringSourceId: template.id,
        status: "DONE",
        completedAt: { gte: thirtyDaysAgo },
      },
    });

    let consistencyScore = 100;
    if (template.recurrenceRule) {
      const rule = rrulestr(buildRruleString(template.recurrenceRule, template.createdAt));
      const expectedOccurrences = rule.between(thirtyDaysAgo, now, true);
      const expectedCount = expectedOccurrences.length;

      if (expectedCount > 0) {
        consistencyScore = Math.round((completedCount / expectedCount) * 100);
        consistencyScore = Math.min(100, Math.max(0, consistencyScore));
      }
    }

    await client.todo.update({
      where: { id: template.id },
      data: {
        currentStreak: newStreak,
        consistencyScore,
      },
    });
  },

  /**
   * Get streak and consistency data for a recurring template.
   */
  async getStreakData(userId: string, templateId: string) {
    const template = await prisma.todo.findFirst({
      where: { id: templateId, userId, isRecurring: true, recurringSourceId: null },
      select: {
        id: true,
        title: true,
        currentStreak: true,
        longestStreak: true,
        lastCompletedDate: true,
        consistencyScore: true,
        recurrenceRule: true,
      },
    });

    if (!template) {
      throw new Error("Recurring template not found");
    }

    return template;
  },

  /**
   * Get day-by-day completion history for a recurring template over N days.
   * Powers the streak heatmap component.
   *
   * Each day in the range is classified as:
   *   - "completed": instance exists and was completed
   *   - "missed": instance exists, not completed, and due date is in the past
   *   - "pending": instance exists, not completed, and due date is today or future
   *   - "none": no instance exists for that day
   */
  async getCompletionHistory(userId: string, templateId: string, days: number = 90) {
    const template = await prisma.todo.findFirst({
      where: { id: templateId, userId, isRecurring: true, recurringSourceId: null },
      select: {
        id: true,
        title: true,
        currentStreak: true,
        longestStreak: true,
        consistencyScore: true,
        recurrenceRule: true,
      },
    });

    if (!template) {
      throw new Error("Recurring template not found");
    }

    const now = new Date();
    const rangeStart = startOfDay(subDays(now, days));
    const rangeEnd = endOfDay(now);

    const instances = await prisma.todo.findMany({
      where: {
        userId,
        recurringSourceId: templateId,
        dueDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: { dueDate: true, completedAt: true, status: true },
      orderBy: { dueDate: "asc" },
    });

    // Index instances by date string for O(1) lookup
    const instanceMap = new Map<string, { dueDate: Date | null; completedAt: Date | null; status: string }>();
    for (const inst of instances) {
      if (inst.dueDate) {
        const key = format(inst.dueDate, "yyyy-MM-dd");
        instanceMap.set(key, inst);
      }
    }

    // Build day-by-day array
    const todayStart = startOfDay(now);
    const dayEntries: Array<{ date: string; status: "completed" | "missed" | "pending" | "none" }> = [];
    let cursor = rangeStart;

    while (!isBefore(rangeEnd, cursor)) {
      const dateStr = format(cursor, "yyyy-MM-dd");
      const instance = instanceMap.get(dateStr);

      let status: "completed" | "missed" | "pending" | "none";
      if (instance) {
        if (instance.completedAt !== null) {
          status = "completed";
        } else if (instance.dueDate && isBefore(instance.dueDate, todayStart)) {
          status = "missed";
        } else {
          status = "pending";
        }
      } else {
        status = "none";
      }

      dayEntries.push({ date: dateStr, status });
      cursor = addDays(cursor, 1);
    }

    return {
      templateId: template.id,
      title: template.title,
      currentStreak: template.currentStreak,
      longestStreak: template.longestStreak,
      consistencyScore: template.consistencyScore,
      recurrenceRule: template.recurrenceRule,
      days: dayEntries,
    };
  },
};
