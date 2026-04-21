import { z } from "zod";

// Context schemas
export const createContextSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  categoryId: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
});

export const updateContextSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const contextFiltersSchema = z.object({
  categoryId: z.string().optional(),
  tag: z.string().optional(),
});

export const contextSearchSchema = z.object({
  q: z.string().min(1).max(500),
});

// Exported types
export type CreateContextInput = z.input<typeof createContextSchema>;
export type UpdateContextInput = z.input<typeof updateContextSchema>;
export type ContextFilters = z.infer<typeof contextFiltersSchema>;
