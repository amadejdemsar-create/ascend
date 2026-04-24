/**
 * Context entry and link type constants.
 *
 * These are the platform-agnostic source of truth for context graph types.
 * The Prisma schema defines the same values in the database layer; if a new
 * value is added in schema.prisma, it must also be added here (and vice versa).
 *
 * Follows the same pattern as enums.ts: object form for runtime, tuple form
 * for Zod, array form for MCP JSON Schema.
 */

// ── ContextEntryType ───────────────────────────────────────────────

export const ContextEntryType = {
  NOTE: "NOTE",
  SOURCE: "SOURCE",
  PROJECT: "PROJECT",
  PERSON: "PERSON",
  DECISION: "DECISION",
  QUESTION: "QUESTION",
  AREA: "AREA",
} as const;

export type ContextEntryType =
  (typeof ContextEntryType)[keyof typeof ContextEntryType];

export const CONTEXT_ENTRY_TYPE_VALUES = [
  "NOTE",
  "SOURCE",
  "PROJECT",
  "PERSON",
  "DECISION",
  "QUESTION",
  "AREA",
] as const;

export const CONTEXT_ENTRY_TYPE_ENUM: string[] = [...CONTEXT_ENTRY_TYPE_VALUES];

// ── ContextLinkType ────────────────────────────────────────────────

export const ContextLinkType = {
  REFERENCES: "REFERENCES",
  EXTENDS: "EXTENDS",
  CONTRADICTS: "CONTRADICTS",
  SUPPORTS: "SUPPORTS",
  EXAMPLE_OF: "EXAMPLE_OF",
  DERIVED_FROM: "DERIVED_FROM",
  SUPERSEDES: "SUPERSEDES",
  APPLIES_TO: "APPLIES_TO",
  PART_OF: "PART_OF",
} as const;

export type ContextLinkType =
  (typeof ContextLinkType)[keyof typeof ContextLinkType];

export const CONTEXT_LINK_TYPE_VALUES = [
  "REFERENCES",
  "EXTENDS",
  "CONTRADICTS",
  "SUPPORTS",
  "EXAMPLE_OF",
  "DERIVED_FROM",
  "SUPERSEDES",
  "APPLIES_TO",
  "PART_OF",
] as const;

export const CONTEXT_LINK_TYPE_ENUM: string[] = [...CONTEXT_LINK_TYPE_VALUES];

// ── ContextLinkSource ──────────────────────────────────────────────

export const ContextLinkSource = {
  CONTENT: "CONTENT",
  MANUAL: "MANUAL",
} as const;

export type ContextLinkSource =
  (typeof ContextLinkSource)[keyof typeof ContextLinkSource];

export const CONTEXT_LINK_SOURCE_VALUES = ["CONTENT", "MANUAL"] as const;

export const CONTEXT_LINK_SOURCE_ENUM: string[] = [
  ...CONTEXT_LINK_SOURCE_VALUES,
];
