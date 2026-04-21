/**
 * Enum display helpers. Converts Prisma const-object enum values
 * ("WEEKLY", "HIGH", "NOT_STARTED", "PENDING") into Title Case labels
 * ("Weekly", "High", "Not started", "Pending") for rendering in
 * forms, filter bars, detail panels, and tables.
 *
 * Use these helpers anywhere enum values are shown to the user.
 * Avoid calling `.charAt(0) + .slice(1).toLowerCase()` inline in
 * components; centralizing here keeps the casing consistent across
 * the app.
 *
 * Base UI's Select.Root accepts an `items` prop of
 * `Array<{ value: string; label: React.ReactNode }>` which it uses
 * to render the currently-selected item's label inside the trigger.
 * Each of the *Items exports below is ready to pass straight to
 * `<Select items={...}>`.
 */

import {
  GoalStatus,
  Horizon,
  Priority,
  RecurringFrequency,
  TodoStatus,
} from "@ascend/core";

// ---- Labels ------------------------------------------------------

export const horizonLabel: Record<string, string> = {
  [Horizon.YEARLY]: "Yearly",
  [Horizon.QUARTERLY]: "Quarterly",
  [Horizon.MONTHLY]: "Monthly",
  [Horizon.WEEKLY]: "Weekly",
};

export const goalStatusLabel: Record<string, string> = {
  [GoalStatus.NOT_STARTED]: "Not started",
  [GoalStatus.IN_PROGRESS]: "In progress",
  [GoalStatus.COMPLETED]: "Completed",
  [GoalStatus.ABANDONED]: "Abandoned",
};

export const priorityLabel: Record<string, string> = {
  [Priority.LOW]: "Low",
  [Priority.MEDIUM]: "Medium",
  [Priority.HIGH]: "High",
};

export const todoStatusLabel: Record<string, string> = {
  [TodoStatus.PENDING]: "Pending",
  [TodoStatus.DONE]: "Done",
  [TodoStatus.SKIPPED]: "Skipped",
};

export const recurringFrequencyLabel: Record<string, string> = {
  [RecurringFrequency.DAILY]: "Daily",
  [RecurringFrequency.WEEKLY]: "Weekly",
  [RecurringFrequency.MONTHLY]: "Monthly",
};

// ---- Select items (for Base UI Select.Root items prop) -----------

export interface EnumItem {
  value: string;
  label: string;
}

export const horizonItems: EnumItem[] = Object.values(Horizon).map((v) => ({
  value: v,
  label: horizonLabel[v],
}));

export const goalStatusItems: EnumItem[] = Object.values(GoalStatus).map((v) => ({
  value: v,
  label: goalStatusLabel[v],
}));

export const priorityItems: EnumItem[] = Object.values(Priority).map((v) => ({
  value: v,
  label: priorityLabel[v],
}));

export const todoStatusItems: EnumItem[] = Object.values(TodoStatus).map((v) => ({
  value: v,
  label: todoStatusLabel[v],
}));

export const recurringFrequencyItems: EnumItem[] = Object.values(RecurringFrequency).map((v) => ({
  value: v,
  label: recurringFrequencyLabel[v],
}));
