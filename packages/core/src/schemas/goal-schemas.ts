import { z } from "zod";
import {
  HORIZON_VALUES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  RECURRING_FREQUENCY_VALUES,
} from "../constants/enums";

// Enum schemas
export const horizonEnum = z.enum(HORIZON_VALUES);
export const statusEnum = z.enum(STATUS_VALUES);
export const priorityEnum = z.enum(PRIORITY_VALUES);
export const recurringFrequencyEnum = z.enum(RECURRING_FREQUENCY_VALUES);

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

// Hand-rolled (not createGoalSchema.partial()) so Zod 4's .partial() does
// not preserve the .default("MEDIUM") on priority. A PATCH that omits
// priority would otherwise inject "MEDIUM" and overwrite the stored value.
// Same reasoning applies to updateCategorySchema, updateTodoSchema, and
// updateContextSchema.
export const updateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  horizon: horizonEnum.optional(),
  categoryId: z.string().optional(),
  priority: priorityEnum.optional(),
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

// Progress schema
export const addProgressSchema = z.object({
  value: z.number().positive(),
  note: z.string().optional(),
});

// Reorder schema
export const reorderGoalsSchema = z.object({
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

// Exported types
// Using z.input so callers can omit fields with defaults (priority, color)
export type CreateGoalInput = z.input<typeof createGoalSchema>;
export type UpdateGoalInput = z.input<typeof updateGoalSchema>;
export type GoalFilters = z.infer<typeof goalFiltersSchema>;
export type AddProgressInput = z.infer<typeof addProgressSchema>;
export type ReorderGoalsInput = z.infer<typeof reorderGoalsSchema>;
