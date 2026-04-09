import { z } from "zod";

// Enum schemas matching Prisma enums
export const horizonEnum = z.enum(["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"]);
export const statusEnum = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"]);
export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const recurringFrequencyEnum = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);

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

// Todo enums
export const todoStatusEnum = z.enum(["PENDING", "DONE", "SKIPPED"]);

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
export type CreateContextInput = z.input<typeof createContextSchema>;
export type UpdateContextInput = z.input<typeof updateContextSchema>;
export type ContextFilters = z.infer<typeof contextFiltersSchema>;
