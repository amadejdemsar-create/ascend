import { z } from "zod";

// Shared GET query param schemas. z.coerce.date() runs `new Date(input)`
// and rejects with a clean validation error if the result is Invalid Date,
// covering both yyyy-MM-dd and full ISO 8601 inputs.
export const dateQuerySchema = z.object({
  date: z.coerce.date(),
});

export const dateRangeQuerySchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

// Import schemas
// Flexible because the import surface accepts both the canonical export
// format ({ goals, categories }) and the legacy todos.json format
// ({ tasks/todos, projects }). Unknown keys on items are stripped by
// Zod's default behavior. The route/MCP handler migrates legacy keys
// to the canonical shape before calling the service layer.
const importCategoryEntrySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
});

const importGoalEntrySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  horizon: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  categoryId: z.union([z.string(), z.number()]).nullable().optional(),
  projectId: z.union([z.string(), z.number()]).nullable().optional(),
  parentId: z.union([z.string(), z.number()]).nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  specific: z.string().optional(),
  measurable: z.string().optional(),
  attainable: z.string().optional(),
  relevant: z.string().optional(),
  timely: z.string().optional(),
  completed: z.boolean().optional(),
});

export const importDataSchema = z.object({
  goals: z.array(importGoalEntrySchema).optional(),
  categories: z.array(importCategoryEntrySchema).optional(),
  // Legacy todos.json format keys (migrated at runtime by import-helpers)
  tasks: z.array(importGoalEntrySchema).optional(),
  todos: z.array(importGoalEntrySchema).optional(),
  projects: z.array(importCategoryEntrySchema).optional(),
});

export type ImportData = z.infer<typeof importDataSchema>;
export type ImportCategoryEntry = z.infer<typeof importCategoryEntrySchema>;
export type ImportGoalEntry = z.infer<typeof importGoalEntrySchema>;

// --- Weekly Review ---

export const weeklyReviewQuerySchema = z.object({
  weekStart: z.string(),
});
export type WeeklyReviewQuery = z.infer<typeof weeklyReviewQuerySchema>;

export const saveReviewSchema = z.object({
  weekStart: z.string(),
  wentWell: z.string(),
  toImprove: z.string(),
});
export type SaveReviewInput = z.infer<typeof saveReviewSchema>;

// --- Streak Heatmap ---

export const streakHistoryQuerySchema = z.object({
  days: z.coerce.number().min(7).max(365).default(90),
});
export type StreakHistoryQuery = z.infer<typeof streakHistoryQuerySchema>;

// --- Analytics Trends ---

export const analyticsQuerySchema = z.object({
  weeks: z.coerce.number().min(4).max(52).default(12),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

// --- Focus Sessions ---

export const createFocusSessionSchema = z.object({
  todoId: z.string().optional(),
  durationSeconds: z.number().int().positive(),
  mode: z.enum(["focus", "break"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});
export type CreateFocusSessionInput = z.infer<typeof createFocusSessionSchema>;

export const focusSessionFiltersSchema = z.object({
  todoId: z.string().optional(),
  goalId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type FocusSessionFilters = z.infer<typeof focusSessionFiltersSchema>;
