import { prisma } from "@/lib/db";
import { rrulestr } from "rrule";
import { startOfDay, subDays, addDays } from "date-fns";

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
  getOccurrences(rruleString: string, start: Date, end: Date): Date[] {
    const rule = rrulestr(rruleString);
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

      const rule = rrulestr(template.recurrenceRule);

      // Find the next occurrence from today (inclusive)
      const nextOccurrence = rule.after(today, true);
      if (!nextOccurrence) continue;

      const nextDate = startOfDay(nextOccurrence);

      // Check if a pending instance already exists for this date
      const existingInstance = await prisma.todo.findFirst({
        where: {
          recurringSourceId: template.id,
          status: "PENDING",
          dueDate: nextDate,
        },
      });

      if (existingInstance) continue;

      // Check if streak is broken: was the previous occurrence missed?
      const previousOccurrence = rule.before(today, false);
      if (previousOccurrence && template.lastCompletedDate) {
        const prevDate = startOfDay(previousOccurrence);
        const lastCompleted = startOfDay(template.lastCompletedDate);

        // If the previous occurrence is after the last completed date, streak is broken
        if (prevDate > lastCompleted && template.currentStreak > 0) {
          await prisma.todo.update({
            where: { id: template.id },
            data: { currentStreak: 0 },
          });
        }
      } else if (previousOccurrence && !template.lastCompletedDate && template.currentStreak > 0) {
        // Has a previous occurrence but was never completed at all
        await prisma.todo.update({
          where: { id: template.id },
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
   * Used by the calendar to ensure instances exist for every visible day in the month.
   *
   * For each template, finds all rrule occurrences between start and end,
   * then creates instances for any date that does not already have one
   * (regardless of status, so completed/skipped instances are not duplicated).
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

    const created: Array<Record<string, unknown>> = [];
    const rangeStart = startOfDay(start);
    const rangeEnd = startOfDay(addDays(end, 1)); // inclusive end

    for (const template of templates) {
      if (!template.recurrenceRule) continue;

      const rule = rrulestr(template.recurrenceRule);
      const occurrences = rule.between(rangeStart, rangeEnd, true);

      for (const occurrence of occurrences) {
        const occDate = startOfDay(occurrence);

        // Check if any instance (pending, done, or skipped) already exists for this date
        const existingInstance = await prisma.todo.findFirst({
          where: {
            recurringSourceId: template.id,
            dueDate: occDate,
          },
        });

        if (existingInstance) continue;

        const instance = await prisma.todo.create({
          data: {
            userId,
            title: template.title,
            description: template.description,
            priority: template.priority,
            goalId: template.goalId,
            categoryId: template.categoryId,
            recurringSourceId: template.id,
            dueDate: occDate,
            scheduledDate: occDate,
          },
        });

        created.push(instance as unknown as Record<string, unknown>);
      }
    }

    return created;
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
  async completeRecurringInstance(userId: string, instanceId: string) {
    const instance = await prisma.todo.findFirst({
      where: { id: instanceId, userId },
    });

    if (!instance || !instance.recurringSourceId) {
      throw new Error("Not a recurring instance");
    }

    const template = await prisma.todo.findFirst({
      where: { id: instance.recurringSourceId, userId },
    });

    if (!template) {
      throw new Error("Recurring template not found");
    }

    const newStreak = template.currentStreak + 1;
    const newLongest = Math.max(template.longestStreak, newStreak);

    // Calculate 30-day consistency score
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const completedCount = await prisma.todo.count({
      where: {
        recurringSourceId: template.id,
        status: "DONE",
        completedAt: { gte: thirtyDaysAgo },
      },
    });

    let consistencyScore = 100;
    if (template.recurrenceRule) {
      const rule = rrulestr(template.recurrenceRule);
      const expectedOccurrences = rule.between(thirtyDaysAgo, now, true);
      const expectedCount = expectedOccurrences.length;

      if (expectedCount > 0) {
        // Add 1 to completedCount because the current completion may not be saved yet
        consistencyScore = Math.round(((completedCount + 1) / expectedCount) * 100);
        consistencyScore = Math.min(100, Math.max(0, consistencyScore));
      }
    }

    const updated = await prisma.todo.update({
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
};
