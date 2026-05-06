/**
 * Database Query Service.
 *
 * The read engine for database rows. Handles filtering, sorting, pagination,
 * and formula evaluation. Supports pushdown of filters/sorts to PostgreSQL
 * JSONB operators where possible, with in-memory fallback for FORMULA fields.
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client";
import type { DatabaseFieldType } from "@/lib/validations";
import type {
  FilterSchema,
  FilterFieldClause,
  SortSchema,
  DatabaseQueryInput,
} from "@/lib/validations";
import {
  parseFormula,
  evaluateFormula,
  createEvalContext,
} from "@/lib/formula";
import type { FormulaValue, EvalContext } from "@/lib/formula";

// ── Types ─────────────────────────────────────────────────────────────

interface FieldMeta {
  id: string;
  name: string;
  type: DatabaseFieldType;
  config: Record<string, unknown>;
}

interface QueryResult {
  rows: Array<{
    id: string;
    position: number;
    properties: Record<string, unknown>;
    contextEntryId: string;
    createdAt: Date;
    updatedAt: Date;
    formulaValues?: Record<string, FormulaValue>;
  }>;
  total: number;
  page: number;
  perPage: number;
}

// ── Service ───────────────────────────────────────────────────────────

export const databaseQueryService = {
  /**
   * Query rows from a database with optional view-based or override filters/sorts.
   *
   * Pipeline:
   * 1. Fetch fields, resolve view config if viewId provided.
   * 2. Build SQL WHERE clause from filter (JSONB operators for pushdown-able types).
   * 3. Build ORDER BY from sort (JSONB extraction for atomic types).
   * 4. Execute paginated query + count in parallel.
   * 5. Evaluate FORMULA fields per row.
   * 6. Post-filter/post-sort for FORMULA-targeted clauses if needed.
   * 7. Return { rows, total, page, perPage }.
   */
  async query(
    userId: string,
    workspaceId: string,
    databaseId: string,
    input: DatabaseQueryInput,
  ): Promise<QueryResult> {
    // Verify ownership
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
      include: {
        fields: { orderBy: { position: "asc" } },
      },
    });
    if (!database) throw new Error("Database not found");

    const fields: FieldMeta[] = database.fields.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type as DatabaseFieldType,
      config: f.config as Record<string, unknown>,
    }));

    // Resolve filter and sort from view or overrides
    let filter: FilterSchema | undefined = input.filter;
    let sort: SortSchema | undefined = input.sort;

    if (input.viewId) {
      const view = await prisma.databaseView.findFirst({
        where: { id: input.viewId, databaseId, userId, workspaceId },
      });
      if (view) {
        const viewConfig = view.config as Record<string, unknown>;
        if (!filter && viewConfig.filter) {
          filter = viewConfig.filter as FilterSchema;
        }
        if (!sort && viewConfig.sort) {
          sort = viewConfig.sort as SortSchema;
        }
      }
    }

    const page = input.page ?? 1;
    const perPage = Math.min(input.perPage ?? 200, 500);

    // Build the field type lookup
    const fieldTypeMap = new Map<string, DatabaseFieldType>();
    const formulaFieldIds = new Set<string>();
    for (const f of fields) {
      fieldTypeMap.set(f.id, f.type);
      if (f.type === "FORMULA") formulaFieldIds.add(f.id);
    }

    // Check if filter or sort references FORMULA fields (in-memory processing needed)
    let hasFormulaFilter = false;
    let hasFormulaSort = false;
    const formulaFilterClauses: FilterFieldClause[] = [];

    if (filter) {
      collectFormulaClauses(filter.clauses, formulaFieldIds, formulaFilterClauses);
      hasFormulaFilter = formulaFilterClauses.length > 0;
    }

    if (sort) {
      hasFormulaSort = sort.some((s) => formulaFieldIds.has(s.fieldId));
    }

    // Build WHERE clause (excluding formula-targeted filters)
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`"databaseId" = ${databaseId}`,
      Prisma.sql`"userId" = ${userId}`,
      Prisma.sql`"workspaceId" = ${workspaceId}`,
    ];

    if (filter && !hasFormulaFilter) {
      // All filters can be pushed down
      const sqlFilter = buildFilterSql(filter.clauses, filter.combinator, fieldTypeMap);
      if (sqlFilter) {
        whereConditions.push(sqlFilter);
      }
    } else if (filter && hasFormulaFilter) {
      // Push down non-formula filters only
      const nonFormulaFilter = removeFormulaClauses(filter, formulaFieldIds);
      if (nonFormulaFilter) {
        const sqlFilter = buildFilterSql(
          nonFormulaFilter.clauses,
          nonFormulaFilter.combinator,
          fieldTypeMap,
        );
        if (sqlFilter) {
          whereConditions.push(sqlFilter);
        }
      }
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(whereConditions, " AND ")}`;

    // Build ORDER BY clause (excluding formula sorts)
    let orderClause: Prisma.Sql;
    if (sort && sort.length > 0 && !hasFormulaSort) {
      const sortParts = sort
        .filter((s) => !formulaFieldIds.has(s.fieldId))
        .map((s) => {
          const dir = s.direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
          return Prisma.sql`"properties"->>${s.fieldId} ${dir}`;
        });
      orderClause =
        sortParts.length > 0
          ? Prisma.sql`ORDER BY ${Prisma.join(sortParts, ", ")}`
          : Prisma.sql`ORDER BY "position" ASC`;
    } else {
      orderClause = Prisma.sql`ORDER BY "position" ASC`;
    }

    // If we need in-memory processing for formulas, fetch all matching rows
    // (up to a reasonable cap) then post-process
    if (hasFormulaFilter || hasFormulaSort) {
      // Fetch all rows matching the pushdown-able filter
      const allRows = await prisma.$queryRaw<
        Array<{
          id: string;
          position: number;
          properties: Record<string, unknown>;
          contextEntryId: string;
          createdAt: Date;
          updatedAt: Date;
        }>
      >`
        SELECT "id", "position", "properties", "contextEntryId", "createdAt", "updatedAt"
        FROM "DatabaseRow"
        ${whereClause}
        ${orderClause}
        LIMIT 10000
      `;

      // Evaluate formulas for each row
      const rowsWithFormulas = allRows.map((row) => ({
        ...row,
        formulaValues: evaluateFormulasForRow(row.properties, fields),
      }));

      // Post-filter by formula values
      let filteredRows = rowsWithFormulas;
      if (hasFormulaFilter && formulaFilterClauses.length > 0) {
        filteredRows = filteredRows.filter((row) =>
          formulaFilterClauses.every((clause) =>
            matchesFormulaFilter(clause, row.formulaValues),
          ),
        );
      }

      // Post-sort by formula values
      if (hasFormulaSort && sort) {
        const formulaSorts = sort.filter((s) => formulaFieldIds.has(s.fieldId));
        filteredRows.sort((a, b) => {
          for (const s of formulaSorts) {
            const aVal = a.formulaValues[s.fieldId];
            const bVal = b.formulaValues[s.fieldId];
            const cmp = compareFormulaValues(aVal, bVal);
            if (cmp !== 0) return s.direction === "desc" ? -cmp : cmp;
          }
          return 0;
        });
      }

      const total = filteredRows.length;
      const skip = (page - 1) * perPage;
      const paginatedRows = filteredRows.slice(skip, skip + perPage);

      return { rows: paginatedRows, total, page, perPage };
    }

    // Standard path: no formula filter/sort; use SQL pagination
    const skip = (page - 1) * perPage;

    const [rows, countResult] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: string;
          position: number;
          properties: Record<string, unknown>;
          contextEntryId: string;
          createdAt: Date;
          updatedAt: Date;
        }>
      >`
        SELECT "id", "position", "properties", "contextEntryId", "createdAt", "updatedAt"
        FROM "DatabaseRow"
        ${whereClause}
        ${orderClause}
        LIMIT ${perPage}
        OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM "DatabaseRow"
        ${whereClause}
      `,
    ]);

    const total = Number(countResult[0].count);

    // Evaluate FORMULA fields per row
    const rowsWithFormulas = rows.map((row) => ({
      ...row,
      formulaValues: evaluateFormulasForRow(row.properties, fields),
    }));

    return { rows: rowsWithFormulas, total, page, perPage };
  },

  /**
   * Count rows matching a filter (without fetching them).
   */
  async count(
    userId: string,
    workspaceId: string,
    databaseId: string,
    filter?: FilterSchema,
  ): Promise<number> {
    // Verify ownership
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
      include: { fields: true },
    });
    if (!database) throw new Error("Database not found");

    const fieldTypeMap = new Map<string, DatabaseFieldType>();
    for (const f of database.fields) {
      fieldTypeMap.set(f.id, f.type as DatabaseFieldType);
    }

    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`"databaseId" = ${databaseId}`,
      Prisma.sql`"userId" = ${userId}`,
      Prisma.sql`"workspaceId" = ${workspaceId}`,
    ];

    if (filter) {
      const sqlFilter = buildFilterSql(filter.clauses, filter.combinator, fieldTypeMap);
      if (sqlFilter) {
        whereConditions.push(sqlFilter);
      }
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(whereConditions, " AND ")}`;

    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "DatabaseRow"
      ${whereClause}
    `;

    return Number(result[0].count);
  },
};

// ── Private: filter SQL builder ───────────────────────────────────────

type FilterClause =
  | FilterFieldClause
  | { type: "group"; combinator: string; clauses: FilterClause[] };

function buildFilterSql(
  clauses: FilterClause[],
  combinator: string,
  fieldTypeMap: Map<string, DatabaseFieldType>,
): Prisma.Sql | null {
  const parts: Prisma.Sql[] = [];

  for (const clause of clauses) {
    if (clause.type === "group") {
      const nested = buildFilterSql(
        clause.clauses as FilterClause[],
        clause.combinator,
        fieldTypeMap,
      );
      if (nested) parts.push(Prisma.sql`(${nested})`);
    } else {
      const fieldType = fieldTypeMap.get(clause.fieldId);
      if (!fieldType) continue;
      // Skip FORMULA fields (handled in memory)
      if (fieldType === "FORMULA") continue;

      const sql = buildFieldClauseSql(clause, fieldType);
      if (sql) parts.push(sql);
    }
  }

  if (parts.length === 0) return null;

  const joiner = combinator === "OR" ? " OR " : " AND ";
  return Prisma.join(parts, joiner);
}

function buildFieldClauseSql(
  clause: FilterFieldClause,
  fieldType: DatabaseFieldType,
): Prisma.Sql | null {
  const { fieldId, op, value } = clause;

  // Text extraction for most types
  const jsonbText = Prisma.sql`"properties"->>${fieldId}`;

  switch (op) {
    // Universal ops
    case "is_empty":
      return Prisma.sql`("properties"->>${fieldId} IS NULL OR "properties"->>${fieldId} = '')`;
    case "is_not_empty":
      return Prisma.sql`("properties"->>${fieldId} IS NOT NULL AND "properties"->>${fieldId} != '')`;
    case "equals":
      return Prisma.sql`${jsonbText} = ${String(value)}`;
    case "not_equals":
      return Prisma.sql`(${jsonbText} IS NULL OR ${jsonbText} != ${String(value)})`;

    // Text ops
    case "contains":
      return Prisma.sql`${jsonbText} ILIKE ${"%" + String(value) + "%"}`;
    case "not_contains":
      return Prisma.sql`(${jsonbText} IS NULL OR ${jsonbText} NOT ILIKE ${"%" + String(value) + "%"})`;
    case "starts_with":
      return Prisma.sql`${jsonbText} ILIKE ${String(value) + "%"}`;
    case "ends_with":
      return Prisma.sql`${jsonbText} ILIKE ${"%" + String(value)}`;

    // Number ops
    case "gt":
      return Prisma.sql`("properties"->>${fieldId})::numeric > ${Number(value)}`;
    case "lt":
      return Prisma.sql`("properties"->>${fieldId})::numeric < ${Number(value)}`;
    case "gte":
      return Prisma.sql`("properties"->>${fieldId})::numeric >= ${Number(value)}`;
    case "lte":
      return Prisma.sql`("properties"->>${fieldId})::numeric <= ${Number(value)}`;
    case "between": {
      const range = value as [number, number];
      return Prisma.sql`("properties"->>${fieldId})::numeric BETWEEN ${range[0]} AND ${range[1]}`;
    }

    // Date ops
    case "before":
      return Prisma.sql`("properties"->>${fieldId})::timestamp < ${String(value)}::timestamp`;
    case "after":
      return Prisma.sql`("properties"->>${fieldId})::timestamp > ${String(value)}::timestamp`;
    case "on_or_before":
      return Prisma.sql`("properties"->>${fieldId})::timestamp <= ${String(value)}::timestamp`;
    case "on_or_after":
      return Prisma.sql`("properties"->>${fieldId})::timestamp >= ${String(value)}::timestamp`;
    case "today":
      return Prisma.sql`("properties"->>${fieldId})::date = CURRENT_DATE`;
    case "this_week":
      return Prisma.sql`("properties"->>${fieldId})::date >= date_trunc('week', CURRENT_DATE) AND ("properties"->>${fieldId})::date < date_trunc('week', CURRENT_DATE) + interval '7 days'`;
    case "this_month":
      return Prisma.sql`("properties"->>${fieldId})::date >= date_trunc('month', CURRENT_DATE) AND ("properties"->>${fieldId})::date < date_trunc('month', CURRENT_DATE) + interval '1 month'`;

    // MULTI_SELECT, RELATION ops (JSONB array contains)
    case "contains_any": {
      const arr = value as string[];
      // JSONB ?| operator: does the array contain any of these values?
      return Prisma.sql`"properties"->${fieldId} ?| ${arr}::text[]`;
    }
    case "contains_all": {
      const arr = value as string[];
      // JSONB ?& operator: does the array contain all of these values?
      return Prisma.sql`"properties"->${fieldId} ?& ${arr}::text[]`;
    }

    // RELATION-specific
    case "relation_contains": {
      const targetId = String(value);
      return Prisma.sql`"properties"->${fieldId} ? ${targetId}`;
    }
    case "relation_not_contains": {
      const targetId = String(value);
      return Prisma.sql`NOT ("properties"->${fieldId} ? ${targetId})`;
    }

    default:
      return null;
  }
}

// ── Private: formula evaluation ───────────────────────────────────────

/**
 * Evaluate all FORMULA fields for a single row.
 */
function evaluateFormulasForRow(
  properties: Record<string, unknown>,
  fields: FieldMeta[],
): Record<string, FormulaValue> {
  const results: Record<string, FormulaValue> = {};

  const formulaFields = fields.filter((f) => f.type === "FORMULA");
  if (formulaFields.length === 0) return results;

  // Build the eval context once and reuse per formula
  const fieldMeta = fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
  }));
  const ctx = createEvalContext(properties, fieldMeta);

  for (const field of formulaFields) {
    const config = field.config as { expression?: string };
    if (!config.expression) {
      results[field.id] = { type: "null", value: null };
      continue;
    }

    const parseResult = parseFormula(config.expression);
    if (!parseResult.ok) {
      results[field.id] = { type: "error", message: parseResult.error.message };
      continue;
    }

    // Reset op counter and start time for each formula
    const formulaCtx: EvalContext = {
      ...ctx,
      opCounter: { count: 0 },
      startedAt: Date.now(),
      recursionDepth: 0,
    };
    results[field.id] = evaluateFormula(parseResult.ast, formulaCtx);
  }

  return results;
}

// ── Private: formula filter matching ──────────────────────────────────

function collectFormulaClauses(
  clauses: FilterClause[],
  formulaFieldIds: Set<string>,
  out: FilterFieldClause[],
): void {
  for (const clause of clauses) {
    if (clause.type === "field" && formulaFieldIds.has(clause.fieldId)) {
      out.push(clause);
    } else if (clause.type === "group") {
      collectFormulaClauses(clause.clauses as FilterClause[], formulaFieldIds, out);
    }
  }
}

function removeFormulaClauses(
  filter: FilterSchema,
  formulaFieldIds: Set<string>,
): FilterSchema | null {
  const filtered = filter.clauses.filter((c) => {
    if (c.type === "field") return !formulaFieldIds.has(c.fieldId);
    return true; // keep groups (they may have non-formula clauses inside)
  });
  if (filtered.length === 0) return null;
  return { combinator: filter.combinator, clauses: filtered };
}

function matchesFormulaFilter(
  clause: FilterFieldClause,
  formulaValues: Record<string, FormulaValue>,
): boolean {
  const value = formulaValues[clause.fieldId];
  if (!value || value.type === "error") return false;

  const { op } = clause;
  const filterValue = clause.value;

  switch (op) {
    case "is_empty":
      return value.type === "null";
    case "is_not_empty":
      return value.type !== "null";
    case "equals": {
      const str = formatValueForComparison(value);
      return str === String(filterValue);
    }
    case "not_equals": {
      const str = formatValueForComparison(value);
      return str !== String(filterValue);
    }
    case "gt":
      return value.type === "number" && value.value > Number(filterValue);
    case "lt":
      return value.type === "number" && value.value < Number(filterValue);
    case "gte":
      return value.type === "number" && value.value >= Number(filterValue);
    case "lte":
      return value.type === "number" && value.value <= Number(filterValue);
    case "contains": {
      const str = formatValueForComparison(value);
      return str.toLowerCase().includes(String(filterValue).toLowerCase());
    }
    default:
      return true; // Unknown op on formula; don't filter out
  }
}

function formatValueForComparison(val: FormulaValue): string {
  switch (val.type) {
    case "number":
      return String(val.value);
    case "string":
      return val.value;
    case "boolean":
      return String(val.value);
    case "date":
      return val.value.toISOString();
    case "null":
      return "";
    case "array":
      return val.value.map((v) => formatValueForComparison(v)).join(",");
    case "error":
      return "";
  }
}

function compareFormulaValues(
  a: FormulaValue | undefined,
  b: FormulaValue | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.type === "error" && b.type === "error") return 0;
  if (a.type === "error") return 1;
  if (b.type === "error") return -1;
  if (a.type === "null" && b.type === "null") return 0;
  if (a.type === "null") return -1;
  if (b.type === "null") return 1;

  if (a.type === "number" && b.type === "number") {
    return a.value - b.value;
  }
  if (a.type === "string" && b.type === "string") {
    return a.value.localeCompare(b.value);
  }
  if (a.type === "date" && b.type === "date") {
    return a.value.getTime() - b.value.getTime();
  }
  if (a.type === "boolean" && b.type === "boolean") {
    return Number(a.value) - Number(b.value);
  }

  // Mixed types: compare string representations
  return formatValueForComparison(a).localeCompare(
    formatValueForComparison(b),
  );
}
