import { z } from "zod";
import {
  CHAT_PROVIDER_KIND_VALUES,
  USAGE_WINDOW_VALUES,
} from "../constants/llm-types";

// ── Enum schemas ─────────────────────────────────────────────────

export const chatProviderKindSchema = z.enum(CHAT_PROVIDER_KIND_VALUES);
export const usageWindowSchema = z.enum(USAGE_WINDOW_VALUES);

// ── Context Map content schema ───────────────────────────────────

/**
 * A single item within a Context Map section (theme, principle, etc.).
 * Each item has a title, optional description, and a list of source
 * ContextEntry IDs that contributed to this item.
 */
const contextMapItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  entryIds: z.array(z.string()).default([]),
});

export type ContextMapItem = z.infer<typeof contextMapItemSchema>;

/**
 * The full structured content of a Context Map.
 * Stored as JSONB in ContextMap.content. Each section is a list of items
 * synthesized from the user's context graph by the selected chat provider.
 */
export const contextMapContentSchema = z.object({
  summary: z.string().optional(),
  themes: z.array(contextMapItemSchema),
  principles: z.array(contextMapItemSchema),
  projects: z.array(contextMapItemSchema),
  tensions: z.array(contextMapItemSchema),
  orphans: z.array(contextMapItemSchema),
});

export type ContextMapContent = z.infer<typeof contextMapContentSchema>;

// ── ContextMap row schema ────────────────────────────────────────

/**
 * Schema for a ContextMap table row as returned from the API.
 * Validates the shape of the full row including LLM metadata.
 */
export const contextMapSchema = z.object({
  id: z.string(),
  userId: z.string(),
  content: contextMapContentSchema,
  provider: chatProviderKindSchema,
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative(),
  generatedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ContextMap = z.infer<typeof contextMapSchema>;

// ── LlmUsage row schema ─────────────────────────────────────────

/**
 * Schema for an LlmUsage table row. Used for validating API responses
 * and for structured output in the usage panel.
 */
export const llmUsageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: chatProviderKindSchema,
  model: z.string(),
  purpose: z.string(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  estimatedCostCents: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
});

export type LlmUsage = z.infer<typeof llmUsageSchema>;

// ── Settings update schema (PATCH semantics) ─────────────────────

/**
 * Schema for PATCH /api/settings AI preferences.
 * Both fields optional; only provided fields are updated.
 */
export const updateAiSettingsSchema = z.object({
  chatProvider: chatProviderKindSchema.optional(),
  chatModel: z.string().min(1).max(200).nullable().optional(),
});

export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;

// ── Usage query schema ───────────────────────────────────────────

/**
 * Schema for GET /api/llm/usage query params.
 */
export const llmUsageQuerySchema = z.object({
  window: usageWindowSchema.optional().default("day"),
});

export type LlmUsageQuery = z.infer<typeof llmUsageQuerySchema>;
