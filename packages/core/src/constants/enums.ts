/**
 * Canonical enum definitions for Ascend.
 *
 * These are the platform-agnostic source of truth. The Prisma schema
 * defines the same values in the database layer; if a new enum value is
 * added in schema.prisma, it must also be added here (and vice versa).
 *
 * Object forms (Horizon, GoalStatus, Priority, TodoStatus, RecurringFrequency)
 * mirror the shape Prisma generates so that code referencing `Horizon.YEARLY`
 * continues to work when importing from @ascend/core instead of generated/prisma.
 *
 * Tuple forms (HORIZON_VALUES, STATUS_VALUES, etc.) are used by Zod's z.enum()
 * which requires a readonly tuple with at least one element.
 *
 * Array forms (HORIZON_ENUM, STATUS_ENUM, etc.) are plain string arrays for
 * use in MCP JSON Schema definitions.
 */

// ── Horizon ─────────────────────────────────────────────────────────

export const Horizon = {
  YEARLY: "YEARLY",
  QUARTERLY: "QUARTERLY",
  MONTHLY: "MONTHLY",
  WEEKLY: "WEEKLY",
} as const;

export type Horizon = (typeof Horizon)[keyof typeof Horizon];

export const HORIZON_VALUES = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;
export const HORIZON_ENUM: string[] = [...HORIZON_VALUES];

// ── GoalStatus ──────────────────────────────────────────────────────

export const GoalStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
} as const;

export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const STATUS_VALUES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
] as const;
export const STATUS_ENUM: string[] = [...STATUS_VALUES];

// ── Priority ────────────────────────────────────────────────────────

export const Priority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];

export const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
export const PRIORITY_ENUM: string[] = [...PRIORITY_VALUES];

// ── RecurringFrequency ──────────────────────────────────────────────

export const RecurringFrequency = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} as const;

export type RecurringFrequency =
  (typeof RecurringFrequency)[keyof typeof RecurringFrequency];

export const RECURRING_FREQUENCY_VALUES = ["DAILY", "WEEKLY", "MONTHLY"] as const;

// ── TodoStatus ──────────────────────────────────────────────────────

export const TodoStatus = {
  PENDING: "PENDING",
  DONE: "DONE",
  SKIPPED: "SKIPPED",
} as const;

export type TodoStatus = (typeof TodoStatus)[keyof typeof TodoStatus];

export const TODO_STATUS_VALUES = ["PENDING", "DONE", "SKIPPED"] as const;
export const TODO_STATUS_ENUM: string[] = [...TODO_STATUS_VALUES];
