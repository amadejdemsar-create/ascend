import { z } from "zod";
import { PRIORITY_VALUES, TODO_STATUS_VALUES } from "../constants/enums";

// Re-derive from the shared enum values (same shape as goal-schemas.ts
// but isolated to avoid cross-schema import coupling).
const priorityEnum = z.enum(PRIORITY_VALUES);
const todoStatusEnum = z.enum(TODO_STATUS_VALUES);

// Public re-export so consumers importing from @ascend/core get it
export { todoStatusEnum };

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

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().datetime().optional(),
  scheduledDate: z.string().datetime().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
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

// Exported types
export type CreateTodoInput = z.input<typeof createTodoSchema>;
export type UpdateTodoInput = z.input<typeof updateTodoSchema>;
export type TodoFilters = z.infer<typeof todoFiltersSchema>;
export type BulkCompleteTodosInput = z.infer<typeof bulkCompleteTodosSchema>;
export type SetBig3Input = z.infer<typeof setBig3Schema>;
export type ReorderTodosInput = z.infer<typeof reorderTodosSchema>;
