import { z } from "zod";

// ── DatabaseFieldType enum ────────────────────────────────────────────
// Matches the Prisma enum DatabaseFieldType exactly.

export const DATABASE_FIELD_TYPE_VALUES = [
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "RELATION",
  "FORMULA",
  "USER",
  "CHECKBOX",
  "RATING",
  "URL",
  "EMAIL",
  "PHONE",
  "FILE",
] as const;

export type DatabaseFieldType = (typeof DATABASE_FIELD_TYPE_VALUES)[number];
export const databaseFieldTypeSchema = z.enum(DATABASE_FIELD_TYPE_VALUES);

// ── DatabaseViewType enum ─────────────────────────────────────────────
// Matches the Prisma enum DatabaseViewType exactly.

export const DATABASE_VIEW_TYPE_VALUES = [
  "TABLE",
  "BOARD",
  "CALENDAR",
  "GALLERY",
  "TIMELINE",
] as const;

export type DatabaseViewType = (typeof DATABASE_VIEW_TYPE_VALUES)[number];
export const databaseViewTypeSchema = z.enum(DATABASE_VIEW_TYPE_VALUES);

// ── Select option schema ──────────────────────────────────────────────
// Used in SELECT and MULTI_SELECT field configs.

export const selectOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(120),
  color: z.string().optional(),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

// ── Field config discriminated union ──────────────────────────────────
// Each branch is keyed on the `type` field. This validates the type-specific
// configuration stored in DatabaseField.config.

const textFieldConfigSchema = z.object({
  type: z.literal("TEXT"),
});

const numberFieldConfigSchema = z.object({
  type: z.literal("NUMBER"),
  precision: z.number().int().min(0).max(10).optional(),
});

const dateFieldConfigSchema = z.object({
  type: z.literal("DATE"),
  includeTime: z.boolean().optional(),
});

const selectFieldConfigSchema = z.object({
  type: z.literal("SELECT"),
  options: z.array(selectOptionSchema).max(500).default([]),
});

const multiSelectFieldConfigSchema = z.object({
  type: z.literal("MULTI_SELECT"),
  options: z.array(selectOptionSchema).max(500).default([]),
});

const relationFieldConfigSchema = z.object({
  type: z.literal("RELATION"),
  targetDatabaseId: z.string().nullable().default(null),
});

const formulaFieldConfigSchema = z.object({
  type: z.literal("FORMULA"),
  expression: z.string().min(1).max(2000),
});

const userFieldConfigSchema = z.object({
  type: z.literal("USER"),
});

const checkboxFieldConfigSchema = z.object({
  type: z.literal("CHECKBOX"),
});

const ratingFieldConfigSchema = z.object({
  type: z.literal("RATING"),
  max: z.number().int().min(1).max(10).default(5),
});

const urlFieldConfigSchema = z.object({
  type: z.literal("URL"),
});

const emailFieldConfigSchema = z.object({
  type: z.literal("EMAIL"),
});

const phoneFieldConfigSchema = z.object({
  type: z.literal("PHONE"),
});

const fileFieldConfigSchema = z.object({
  type: z.literal("FILE"),
  maxFiles: z.number().int().min(1).max(20).default(5),
});

export const databaseFieldConfigSchema = z.discriminatedUnion("type", [
  textFieldConfigSchema,
  numberFieldConfigSchema,
  dateFieldConfigSchema,
  selectFieldConfigSchema,
  multiSelectFieldConfigSchema,
  relationFieldConfigSchema,
  formulaFieldConfigSchema,
  userFieldConfigSchema,
  checkboxFieldConfigSchema,
  ratingFieldConfigSchema,
  urlFieldConfigSchema,
  emailFieldConfigSchema,
  phoneFieldConfigSchema,
  fileFieldConfigSchema,
]);
export type DatabaseFieldConfig = z.infer<typeof databaseFieldConfigSchema>;

// ── Database field schema ─────────────────────────────────────────────

export const databaseFieldSchema = z.object({
  name: z.string().min(1).max(80),
  type: databaseFieldTypeSchema,
  config: databaseFieldConfigSchema,
  position: z.number().int().min(0),
  isPrimary: z.boolean().default(false),
});
export type DatabaseField = z.infer<typeof databaseFieldSchema>;

// ── Create / update field schemas ─────────────────────────────────────

export const createDatabaseFieldSchema = z.object({
  name: z.string().min(1).max(80),
  type: databaseFieldTypeSchema,
  config: databaseFieldConfigSchema.optional(),
});
export type CreateDatabaseFieldInput = z.infer<typeof createDatabaseFieldSchema>;

export const updateDatabaseFieldSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: databaseFieldTypeSchema.optional(),
  config: databaseFieldConfigSchema.optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateDatabaseFieldInput = z.infer<typeof updateDatabaseFieldSchema>;

// ── Per-type property value schemas ───────────────────────────────────
// Each field type has a value schema that validates the stored property value.
// null is allowed for all types (to clear the value).

export const textValueSchema = z.string().max(100_000).nullable();
export const numberValueSchema = z.number().nullable();
export const dateValueSchema = z.string().datetime().nullable();
export const selectValueSchema = z.string().nullable();
export const multiSelectValueSchema = z.array(z.string()).max(50).nullable();
export const relationValueSchema = z.array(z.string()).max(200).nullable();
// Formula fields are computed; they are never stored directly.
export const formulaValueSchema = z.never();
export const userValueSchema = z.string().nullable();
export const checkboxValueSchema = z.boolean().nullable();
export const ratingValueSchema = z.number().int().min(0).max(10).nullable();
export const urlValueSchema = z.string().max(2000).url().nullable();
export const emailValueSchema = z.string().max(320).email().nullable();
export const phoneValueSchema = z.string().max(30).nullable();
export const fileValueSchema = z.array(z.string()).max(20).nullable();

/**
 * Returns the value schema for a given field type.
 * FORMULA returns z.never() because formula fields are computed at read time.
 */
export function getValueSchemaForType(
  type: DatabaseFieldType,
): z.ZodType<unknown> {
  switch (type) {
    case "TEXT":
      return textValueSchema;
    case "NUMBER":
      return numberValueSchema;
    case "DATE":
      return dateValueSchema;
    case "SELECT":
      return selectValueSchema;
    case "MULTI_SELECT":
      return multiSelectValueSchema;
    case "RELATION":
      return relationValueSchema;
    case "FORMULA":
      // Formula is computed; we allow undefined but never an explicit value.
      return z.undefined() as unknown as z.ZodType<unknown>;
    case "USER":
      return userValueSchema;
    case "CHECKBOX":
      return checkboxValueSchema;
    case "RATING":
      return ratingValueSchema;
    case "URL":
      return urlValueSchema;
    case "EMAIL":
      return emailValueSchema;
    case "PHONE":
      return phoneValueSchema;
    case "FILE":
      return fileValueSchema;
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown field type: ${_exhaustive}`);
    }
  }
}

/**
 * Constructs a Zod object schema for a row's properties payload based on
 * the database's field list. Each key is the field ID; its validator is
 * the per-type value schema. Formula fields are excluded (never stored).
 *
 * The resulting schema accepts partial objects (all fields optional) so
 * it works for both create (empty properties) and patch (subset of fields).
 */
export function databaseRowPropertiesSchema(
  fields: Array<{ id: string; type: DatabaseFieldType }>,
): z.ZodObject<Record<string, z.ZodOptional<z.ZodType<unknown>>>> {
  const shape: Record<string, z.ZodOptional<z.ZodType<unknown>>> = {};
  for (const field of fields) {
    if (field.type === "FORMULA") continue;
    shape[field.id] = getValueSchemaForType(field.type).optional();
  }
  return z.object(shape) as z.ZodObject<
    Record<string, z.ZodOptional<z.ZodType<unknown>>>
  >;
}

// ── Filter schema ─────────────────────────────────────────────────────
// Recursive AND/OR filter structure. A filter is a combinator group; each
// clause is either a nested group or a field comparison.

export const FILTER_OP_VALUES = [
  // Universal
  "equals",
  "not_equals",
  "is_empty",
  "is_not_empty",
  // TEXT, URL, EMAIL, PHONE
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  // NUMBER, RATING
  "gt",
  "lt",
  "gte",
  "lte",
  "between",
  // DATE
  "before",
  "after",
  "on_or_before",
  "on_or_after",
  "today",
  "this_week",
  "this_month",
  // SELECT, MULTI_SELECT
  "contains_any",
  "contains_all",
  // RELATION
  "relation_contains",
  "relation_not_contains",
] as const;

export type FilterOp = (typeof FILTER_OP_VALUES)[number];
export const filterOpSchema = z.enum(FILTER_OP_VALUES);

export const filterCombinatorSchema = z.enum(["AND", "OR"]);
export type FilterCombinator = z.infer<typeof filterCombinatorSchema>;

// Base filter clause (field comparison)
const filterFieldClauseSchema = z.object({
  type: z.literal("field"),
  fieldId: z.string(),
  op: filterOpSchema,
  value: z.unknown(),
});
export type FilterFieldClause = z.infer<typeof filterFieldClauseSchema>;

// Filter clause: either a field comparison or a nested group.
// Uses z.lazy for recursion.
type FilterClause = FilterFieldClause | FilterGroup;

interface FilterGroup {
  type: "group";
  combinator: FilterCombinator;
  clauses: FilterClause[];
}

const filterClauseSchema: z.ZodType<FilterClause> = z.lazy(() =>
  z.union([filterFieldClauseSchema, filterGroupSchema]),
);

const filterGroupSchema: z.ZodType<FilterGroup> = z.object({
  type: z.literal("group"),
  combinator: filterCombinatorSchema,
  clauses: z.array(filterClauseSchema).max(50),
});

/**
 * Top-level filter schema: a combinator group with clauses.
 * Nesting depth is capped at 5 via a refine check.
 */
export const filterSchema = z
  .object({
    combinator: filterCombinatorSchema,
    clauses: z.array(filterClauseSchema).max(50),
  })
  .refine((val) => checkFilterDepth(val, 0), {
    message: "Filter nesting depth exceeds maximum of 5",
  });

export type FilterSchema = z.infer<typeof filterSchema>;

function checkFilterDepth(
  node: { clauses?: FilterClause[] },
  depth: number,
): boolean {
  if (depth > 5) return false;
  if (!node.clauses) return true;
  for (const clause of node.clauses) {
    if (clause.type === "group") {
      if (!checkFilterDepth(clause, depth + 1)) return false;
    }
  }
  return true;
}

// ── Sort schema ───────────────────────────────────────────────────────

export const sortItemSchema = z.object({
  fieldId: z.string(),
  direction: z.enum(["asc", "desc"]),
});
export type SortItem = z.infer<typeof sortItemSchema>;

export const sortSchema = z.array(sortItemSchema).max(10);
export type SortSchema = z.infer<typeof sortSchema>;

// ── Database view config discriminated union ──────────────────────────

const tableViewConfigSchema = z.object({
  type: z.literal("TABLE"),
  columnWidths: z.record(z.string(), z.number()).optional(),
  columnOrder: z.array(z.string()).optional(),
  hiddenFieldIds: z.array(z.string()).optional(),
  frozenPrimary: z.boolean().optional(),
  filter: filterSchema.optional(),
  sort: sortSchema.optional(),
});

const boardViewConfigSchema = z.object({
  type: z.literal("BOARD"),
  groupByFieldId: z.string(),
  visiblePropertyIds: z.array(z.string()).optional(),
  filter: filterSchema.optional(),
  sort: sortSchema.optional(),
});

const calendarViewConfigSchema = z.object({
  type: z.literal("CALENDAR"),
  dateFieldId: z.string(),
  filter: filterSchema.optional(),
  sort: sortSchema.optional(),
});

const galleryViewConfigSchema = z.object({
  type: z.literal("GALLERY"),
  coverFieldId: z.string().optional(),
  visiblePropertyIds: z.array(z.string()).optional(),
  filter: filterSchema.optional(),
  sort: sortSchema.optional(),
});

const timelineViewConfigSchema = z.object({
  type: z.literal("TIMELINE"),
  startFieldId: z.string(),
  endFieldId: z.string(),
  zoom: z.enum(["day", "week", "month"]).optional(),
  filter: filterSchema.optional(),
  sort: sortSchema.optional(),
});

export const databaseViewConfigSchema = z.discriminatedUnion("type", [
  tableViewConfigSchema,
  boardViewConfigSchema,
  calendarViewConfigSchema,
  galleryViewConfigSchema,
  timelineViewConfigSchema,
]);
export type DatabaseViewConfig = z.infer<typeof databaseViewConfigSchema>;

// ── Database CRUD schemas ─────────────────────────────────────────────

export const createDatabaseSchema = z.object({
  name: z.string().min(1).max(200),
  parentEntryId: z.string().optional(),
});
export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;

export const updateDatabaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  defaultViewId: z.string().optional(),
});
export type UpdateDatabaseInput = z.infer<typeof updateDatabaseSchema>;

// ── Database view CRUD schemas ────────────────────────────────────────

export const createDatabaseViewSchema = z.object({
  name: z.string().min(1).max(80),
  type: databaseViewTypeSchema,
  config: databaseViewConfigSchema.optional(),
});
export type CreateDatabaseViewInput = z.infer<typeof createDatabaseViewSchema>;

export const updateDatabaseViewSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  config: databaseViewConfigSchema.optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateDatabaseViewInput = z.infer<typeof updateDatabaseViewSchema>;

// ── Database row CRUD schemas ─────────────────────────────────────────

export const createDatabaseRowSchema = z.object({
  properties: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDatabaseRowInput = z.infer<typeof createDatabaseRowSchema>;

export const updateDatabaseRowSchema = z.object({
  propertiesPatch: z.record(z.string(), z.unknown()),
});
export type UpdateDatabaseRowInput = z.infer<typeof updateDatabaseRowSchema>;

export const reorderDatabaseRowsSchema = z.object({
  orderedRowIds: z.array(z.string()).min(1).max(10000),
});
export type ReorderDatabaseRowsInput = z.infer<
  typeof reorderDatabaseRowsSchema
>;

export const reorderDatabaseFieldsSchema = z.object({
  orderedFieldIds: z.array(z.string()).min(1).max(500),
});
export type ReorderDatabaseFieldsInput = z.infer<
  typeof reorderDatabaseFieldsSchema
>;

// ── Query schemas ─────────────────────────────────────────────────────

export const databaseQuerySchema = z.object({
  viewId: z.string().optional(),
  filter: filterSchema.optional(),
  sort: sortSchema.optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(500).default(200),
});
export type DatabaseQueryInput = z.infer<typeof databaseQuerySchema>;
