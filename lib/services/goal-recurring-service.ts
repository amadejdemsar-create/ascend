import { prisma } from "@/lib/db";
import { bumpStreak } from "@/lib/services/recurring-helpers";
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  startOfWeek,
  startOfMonth,
  format,
} from "date-fns";

/**
 * Recurring goals service: instance generation, streak tracking,
 * template listing. Uses enum frequency (DAILY/WEEKLY/MONTHLY) +
 * interval to compute the next due date, not RFC 5545 rrule strings.
 *
 * Intentionally separate from todoRecurringService (which uses rrule)
 * because the underlying date-math paths differ. The shared streak
 * bookkeeping lives in lib/services/recurring-helpers.ts.
 *
 * A recurring "template" is a goal with isRecurring=true and no
 * recurringSourceId. An "instance" is a goal created from a template
 * with recurringSourceId pointing back. Instances inherit category,
 * priority, and parent from the template.
 *
 * Streaks are tracked on the template: currentStreak increments on
 * every completion via bumpStreak, and resets to zero when a deadline
 * is missed (checked during generation).
 */
export const goalRecurringService = {
  /**
   * Compute the next due date from a given date, frequency, and interval.
   */
  getNextDueDate(
    lastDate: Date,
    frequency: string,
    interval: number,
  ): Date {
    switch (frequency) {
      case "DAILY":
        return addDays(lastDate, interval);
      case "WEEKLY":
        return addWeeks(lastDate, interval);
      case "MONTHLY":
        return addMonths(lastDate, interval);
      default:
        return addWeeks(lastDate, interval);
    }
  },

  /**
   * Check whether a streak is broken given the last completed date, frequency,
   * and interval. Uses a grace period of 1 day for DAILY goals.
   */
  isStreakBroken(
    lastCompleted: Date,
    frequency: string,
    interval: number,
  ): boolean {
    const nextDue = this.getNextDueDate(lastCompleted, frequency, interval);
    const today = startOfDay(new Date());
    const nextDueDay = startOfDay(nextDue);

    if (frequency === "DAILY") {
      // Grace period: 1 extra day for daily goals
      const graceDeadline = addDays(nextDueDay, 1);
      return today > graceDeadline;
    }

    // For weekly/monthly: streak broken if today is past the next due date
    return today > nextDueDay;
  },

  /**
   * Generate date label for an instance title based on frequency.
   */
  getInstanceLabel(dueDate: Date, frequency: string): string {
    switch (frequency) {
      case "DAILY":
        return format(dueDate, "MMM d");
      case "WEEKLY": {
        const weekStart = startOfWeek(dueDate, { weekStartsOn: 1 });
        return `Week of ${format(weekStart, "MMM d")}`;
      }
      case "MONTHLY":
        return format(startOfMonth(dueDate), "MMMM yyyy");
      default:
        return format(dueDate, "MMM d");
    }
  },

  /**
   * Generate due instances for all recurring templates belonging to a user.
   * For each template without a pending (NOT_STARTED or IN_PROGRESS) instance:
   *   1. Check if streak is broken since lastCompletedInstance; if so, reset currentStreak.
   *   2. Create a new instance copying title, horizon, priority, categoryId, parentId.
   *   3. Set the instance deadline to the next due date.
   *
   * Returns the array of newly created instances.
   */
  async generateDueInstances(userId: string) {
    // Find all recurring templates for the user
    const templates = await prisma.goal.findMany({
      where: {
        userId,
        isRecurring: true,
        recurringSourceId: null,
      },
    });

    const created: Array<Record<string, unknown>> = [];

    for (const template of templates) {
      // Check if an incomplete instance already exists
      const pendingInstance = await prisma.goal.findFirst({
        where: {
          userId,
          recurringSourceId: template.id,
          status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        },
      });

      if (pendingInstance) continue;

      const frequency = template.recurringFrequency ?? "WEEKLY";
      const interval = template.recurringInterval ?? 1;

      // Check if streak is broken. Use updateMany so the mutation is
      // scoped by userId as defense-in-depth.
      if (template.lastCompletedInstance) {
        const broken = this.isStreakBroken(
          template.lastCompletedInstance,
          frequency,
          interval,
        );
        if (broken && template.currentStreak > 0) {
          await prisma.goal.updateMany({
            where: { id: template.id, userId },
            data: { currentStreak: 0 },
          });
        }
      }

      // Compute next due date
      const baseDate = template.lastCompletedInstance ?? template.createdAt;
      const nextDue = this.getNextDueDate(baseDate, frequency, interval);

      // Create the new instance
      const label = this.getInstanceLabel(nextDue, frequency);
      const instance = await prisma.goal.create({
        data: {
          userId,
          title: `${template.title} (${label})`,
          description: template.description,
          horizon: template.horizon,
          priority: template.priority,
          categoryId: template.categoryId,
          parentId: template.parentId,
          recurringSourceId: template.id,
          deadline: nextDue,
        },
      });

      created.push(instance as unknown as Record<string, unknown>);
    }

    return created;
  },

  /**
   * Handle completion of a recurring instance: update the template's streak data.
   * Called after the goal status has already been set to COMPLETED.
   *
   * Returns the updated template with streak information.
   */
  async completeRecurringInstance(userId: string, instanceId: string) {
    const instance = await prisma.goal.findFirst({
      where: { id: instanceId, userId },
    });

    if (!instance || !instance.recurringSourceId) {
      throw new Error("Not a recurring instance");
    }

    const template = await prisma.goal.findFirst({
      where: { id: instance.recurringSourceId, userId },
    });

    if (!template) {
      throw new Error("Recurring template not found");
    }

    const { currentStreak, longestStreak } = bumpStreak({
      currentStreak: template.currentStreak,
      longestStreak: template.longestStreak,
    });

    const updated = await prisma.goal.update({
      where: { id: template.id },
      data: {
        currentStreak,
        longestStreak,
        lastCompletedInstance: new Date(),
      },
    });

    return {
      templateId: updated.id,
      currentStreak: updated.currentStreak,
      longestStreak: updated.longestStreak,
      lastCompletedInstance: updated.lastCompletedInstance,
    };
  },

  /**
   * List all recurring templates for a user with streak data and latest instance info.
   */
  async listTemplates(userId: string) {
    const templates = await prisma.goal.findMany({
      where: {
        userId,
        isRecurring: true,
        recurringSourceId: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        recurringInstances: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return templates.map((t) => ({
      id: t.id,
      title: t.title,
      horizon: t.horizon,
      priority: t.priority,
      recurringFrequency: t.recurringFrequency,
      recurringInterval: t.recurringInterval,
      currentStreak: t.currentStreak,
      longestStreak: t.longestStreak,
      lastCompletedInstance: t.lastCompletedInstance,
      category: t.category,
      latestInstance: t.recurringInstances[0] ?? null,
    }));
  },
};
