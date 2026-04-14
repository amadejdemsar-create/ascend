import { z } from "zod";
import {
  GoalStatus,
  Horizon,
  Priority,
  RecurringFrequency,
  TodoStatus,
} from "../generated/prisma/enums";

// Enum schemas derived from Prisma-generated enums. Adding a value to
// schema.prisma and running `prisma generate` updates both the Zod
// schemas here and the MCP JSON Schemas in lib/mcp/schemas.ts (which
// also imports from generated/prisma/enums) with no manual sync step.
export const horizonEnum = z.enum(Horizon);
export const statusEnum = z.enum(GoalStatus);
export const priorityEnum = z.enum(Priority);
export const recurringFrequencyEnum = z.enum(RecurringFrequency);

// Goal schemas
export const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  horizon: horizonEnum,
  parentId: z.string().optional(),
  categoryId: z.string().optional(),
  priority: priorityEnum.default("MEDIUM"),
  startDate: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  specific: z.string().optional(),
  measurable: z.string().optional(),
  attainable: z.string().optional(),
  relevant: z.string().optional(),
  timely: z.string().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: recurringFrequencyEnum.optional(),
  recurringInterval: z.number().int().min(1).optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  status: statusEnum.optional(),
  progress: z.number().min(0).max(100).optional(),
  currentValue: z.number().optional(),
  sortOrder: z.number().optional(),
  parentId: z.string().nullable().optional(),
});

export const goalFiltersSchema = z.object({
  horizon: horizonEnum.optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  categoryId: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#4F46E5"),
  icon: z.string().optional(),
  parentId: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  sortOrder: z.number().optional(),
});

// Progress schema
export const addProgressSchema = z.object({
  value: z.number().positive(),
  note: z.string().optional(),
});

// Reorder schema
export const reorderGoalsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    sortOrder: z.number().int().min(0),
  })).min(1).max(200),
});
export type ReorderGoalsInput = z.infer<typeof reorderGoalsSchema>;

// Todo enums (derived from Prisma's TodoStatus, see note above)
export const todoStatusEnum = z.enum(TodoStatus);

// Todo schemas
export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: priorityEnum.default("MEDIUM"),
  goalId: z.string().optional(),
  categoryId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  scheduledDate: z.string().datetime().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
});

export const updateTodoSchema = createTodoSchema.partial().extend({
  status: todoStatusEnum.optional(),
  sortOrder: z.number().optional(),
  isBig3: z.boolean().optional(),
  big3Date: z.string().datetime().optional(),
  // Allow clearing these relations by sending null explicitly.
  categoryId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
});

export const todoFiltersSchema = z.object({
  status: todoStatusEnum.optional(),
  priority: priorityEnum.optional(),
  categoryId: z.string().optional(),
  goalId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  isBig3: z.enum(["true", "false"]).optional(),
});

export const bulkCompleteTodosSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

export const setBig3Schema = z.object({
  todoIds: z.array(z.string()).min(1).max(3),
  date: z.string().datetime().optional(),
});

export const reorderTodosSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(200),
});

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

// Context schemas
export const createContextSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  categoryId: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
});

export const updateContextSchema = createContextSchema.partial();

export const contextFiltersSchema = z.object({
  categoryId: z.string().optional(),
  tag: z.string().optional(),
});

export const contextSearchSchema = z.object({
  q: z.string().min(1).max(500),
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

// Exported types
// Using z.input so callers can omit fields with defaults (priority, color)
export type CreateGoalInput = z.input<typeof createGoalSchema>;
export type UpdateGoalInput = z.input<typeof updateGoalSchema>;
export type GoalFilters = z.infer<typeof goalFiltersSchema>;
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type AddProgressInput = z.infer<typeof addProgressSchema>;
export type CreateTodoInput = z.input<typeof createTodoSchema>;
export type UpdateTodoInput = z.input<typeof updateTodoSchema>;
export type TodoFilters = z.infer<typeof todoFiltersSchema>;
export type BulkCompleteTodosInput = z.infer<typeof bulkCompleteTodosSchema>;
export type SetBig3Input = z.infer<typeof setBig3Schema>;
export type ReorderTodosInput = z.infer<typeof reorderTodosSchema>;
export type CreateContextInput = z.input<typeof createContextSchema>;
export type UpdateContextInput = z.input<typeof updateContextSchema>;
export type ContextFilters = z.infer<typeof contextFiltersSchema>;

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
