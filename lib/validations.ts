import { z } from "zod";

// Enum schemas matching Prisma enums
export const horizonEnum = z.enum(["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"]);
export const statusEnum = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"]);
export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

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
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  status: statusEnum.optional(),
  progress: z.number().min(0).max(100).optional(),
  currentValue: z.number().optional(),
  sortOrder: z.number().optional(),
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

// Exported types
// Using z.input so callers can omit fields with defaults (priority, color)
export type CreateGoalInput = z.input<typeof createGoalSchema>;
export type UpdateGoalInput = z.input<typeof updateGoalSchema>;
export type GoalFilters = z.infer<typeof goalFiltersSchema>;
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type AddProgressInput = z.infer<typeof addProgressSchema>;
