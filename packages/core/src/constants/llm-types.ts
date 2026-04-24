/**
 * LLM and chat provider type constants.
 *
 * Platform-agnostic source of truth for ChatProviderKind and usage window.
 * The Prisma schema defines the same ChatProviderKind enum values in the
 * database layer; if a value is added there, it must also be added here.
 *
 * Follows the same pattern as enums.ts and context-types.ts: object form
 * for runtime, tuple form for Zod, array form for MCP JSON Schema.
 */

// ── ChatProviderKind ──────────────────────────────────────────────

export const ChatProviderKind = {
  GEMINI: "GEMINI",
  OPENAI: "OPENAI",
  ANTHROPIC: "ANTHROPIC",
} as const;

export type ChatProviderKind =
  (typeof ChatProviderKind)[keyof typeof ChatProviderKind];

export const CHAT_PROVIDER_KIND_VALUES = [
  "GEMINI",
  "OPENAI",
  "ANTHROPIC",
] as const;

export const CHAT_PROVIDER_KIND_ENUM: string[] = [
  ...CHAT_PROVIDER_KIND_VALUES,
];

// ── UsageWindow ───────────────────────────────────────────────────

export const UsageWindow = {
  DAY: "day",
  WEEK: "week",
} as const;

export type UsageWindow = (typeof UsageWindow)[keyof typeof UsageWindow];

export const USAGE_WINDOW_VALUES = ["day", "week"] as const;
