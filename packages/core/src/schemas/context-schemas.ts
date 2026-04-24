import { z } from "zod";
import {
  CONTEXT_ENTRY_TYPE_VALUES,
  CONTEXT_LINK_TYPE_VALUES,
  CONTEXT_LINK_SOURCE_VALUES,
} from "../constants/context-types";

// ── Context type enum schemas ──────────────────────────────────────

export const contextEntryTypeSchema = z.enum(CONTEXT_ENTRY_TYPE_VALUES);
export const contextLinkTypeSchema = z.enum(CONTEXT_LINK_TYPE_VALUES);
export const contextLinkSourceSchema = z.enum(CONTEXT_LINK_SOURCE_VALUES);

// ── Context entry schemas ──────────────────────────────────────────

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
  type: contextEntryTypeSchema.optional(),
});

export const contextFiltersSchema = z.object({
  categoryId: z.string().optional(),
  tag: z.string().optional(),
});

export const contextSearchSchema = z.object({
  q: z.string().min(1).max(500),
});

// ── Context link schemas ──────────────────────────────────────────

export const createContextLinkSchema = z.object({
  fromEntryId: z.string().min(1),
  toEntryId: z.string().min(1),
  type: z.enum(CONTEXT_LINK_TYPE_VALUES).default("REFERENCES"),
  source: z.enum(CONTEXT_LINK_SOURCE_VALUES).default("MANUAL"),
});
export type CreateContextLinkInput = z.infer<typeof createContextLinkSchema>;

export const updateContextLinkSchema = z.object({
  type: z.enum(CONTEXT_LINK_TYPE_VALUES),
});
export type UpdateContextLinkInput = z.infer<typeof updateContextLinkSchema>;

export const deleteContextLinkQuerySchema = z.object({
  force: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
export type DeleteContextLinkQuery = z.infer<typeof deleteContextLinkQuerySchema>;

// ── Context graph query schemas ───────────────────────────────────

export const contextGraphFiltersSchema = z.object({
  types: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined))
    .pipe(z.array(z.enum(CONTEXT_ENTRY_TYPE_VALUES)).optional()),
  categoryId: z.string().optional(),
  tag: z.string().optional(),
  cap: z.coerce.number().int().positive().max(5000).optional().default(1000),
});
export type ContextGraphFilters = z.infer<typeof contextGraphFiltersSchema>;

export const contextNeighborsQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(3).optional().default(1),
});
export type ContextNeighborsQuery = z.infer<typeof contextNeighborsQuerySchema>;

// Exported types
export type CreateContextInput = z.input<typeof createContextSchema>;
export type UpdateContextInput = z.input<typeof updateContextSchema>;
export type ContextFilters = z.infer<typeof contextFiltersSchema>;
