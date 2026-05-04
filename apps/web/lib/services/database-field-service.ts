/**
 * Database Field Service.
 *
 * CRUD for DatabaseField entities. Handles field positioning, FORMULA
 * cycle detection (DZ-14), type-safe config validation, and cascade
 * cleanup of RELATION-typed links on deletion (DZ-16).
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import type { DatabaseFieldType } from "@/lib/validations";
import {
  databaseFieldConfigSchema,
  getValueSchemaForType,
} from "@/lib/validations";
import { parseFormula, extractDependencies } from "@/lib/formula";

// ── Types ─────────────────────────────────────────────────────────────

interface AddFieldInput {
  name: string;
  type: DatabaseFieldType;
  config?: Record<string, unknown>;
}

interface UpdateFieldInput {
  name?: string;
  config?: Record<string, unknown>;
  position?: number;
}

interface ChangeTypeInput {
  newType: DatabaseFieldType;
  force?: boolean;
}

interface CycleCheckResult {
  hasCycle: boolean;
  cycle?: string[];
}

// ── Service ───────────────────────────────────────────────────────────

export const databaseFieldService = {
  /**
   * Add a new field to a database. Validates config against the type-specific
   * Zod schema. For FORMULA type, parses the expression and runs cycle detection.
   * Auto-positions to the end.
   */
  async add(userId: string, databaseId: string, input: AddFieldInput) {
    // Verify database ownership
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId },
    });
    if (!database) throw new Error("Database not found");

    // Build config with type discriminator
    const rawConfig = input.config
      ? { ...input.config, type: input.type }
      : { type: input.type };

    // Validate config against the discriminated union
    const config = databaseFieldConfigSchema.parse(rawConfig);

    // FORMULA-specific: parse and cycle-check
    if (input.type === "FORMULA") {
      const formulaConfig = config as { type: "FORMULA"; expression: string };
      const parseResult = parseFormula(formulaConfig.expression);
      if (!parseResult.ok) {
        throw new Error(`Invalid formula: ${parseResult.error.message}`);
      }

      const deps = extractDependencies(parseResult.ast);
      if (deps.length > 0) {
        const cycleResult = await cycleCheck(
          userId,
          databaseId,
          input.name,
          deps,
          undefined,
        );
        if (cycleResult.hasCycle) {
          throw new Error(
            `Formula creates a circular dependency: ${cycleResult.cycle?.join(" → ")}`,
          );
        }
      }
    }

    // Determine position (max + 1)
    const maxField = await prisma.databaseField.findFirst({
      where: { databaseId, userId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (maxField?.position ?? -1) + 1;

    return prisma.databaseField.create({
      data: {
        userId,
        databaseId,
        name: input.name,
        type: input.type,
        position,
        config: config as unknown as Prisma.InputJsonValue,
        isPrimary: false,
      },
    });
  },

  /**
   * Update field metadata (name, config, position). Never rewrites row
   * property values. If config/formula expression changed, re-cycle-checks.
   */
  async update(userId: string, fieldId: string, input: UpdateFieldInput) {
    // Verify ownership via the field's database
    const existing = await prisma.databaseField.findFirst({
      where: { id: fieldId, userId },
      include: { database: { select: { id: true, userId: true } } },
    });
    if (!existing) throw new Error("Field not found");
    if (existing.database.userId !== userId) throw new Error("Field not found");

    const updateData: Prisma.DatabaseFieldUpdateInput = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.config !== undefined) {
      // Build config with the field's type as discriminator
      const rawConfig = { ...input.config, type: existing.type };
      const config = databaseFieldConfigSchema.parse(rawConfig);

      // If FORMULA, re-validate and cycle-check
      if (existing.type === "FORMULA") {
        const formulaConfig = config as { type: "FORMULA"; expression: string };
        const parseResult = parseFormula(formulaConfig.expression);
        if (!parseResult.ok) {
          throw new Error(`Invalid formula: ${parseResult.error.message}`);
        }

        const deps = extractDependencies(parseResult.ast);
        if (deps.length > 0) {
          const fieldName = input.name ?? existing.name;
          const cycleResult = await cycleCheck(
            userId,
            existing.databaseId,
            fieldName,
            deps,
            fieldId,
          );
          if (cycleResult.hasCycle) {
            throw new Error(
              `Formula creates a circular dependency: ${cycleResult.cycle?.join(" → ")}`,
            );
          }
        }
      }

      updateData.config = config as unknown as Prisma.InputJsonValue;
    }

    if (input.position !== undefined) {
      updateData.position = input.position;
    }

    return prisma.databaseField.update({
      where: { id: fieldId },
      data: updateData,
    });
  },

  /**
   * Delete a field. Refuses if isPrimary. In a transaction:
   * 1. If RELATION, raw SQL bulk-delete ContextLink rows (DZ-16).
   * 2. Remove the field key from every row's properties JSONB.
   * 3. Delete the field row.
   */
  async delete(userId: string, fieldId: string): Promise<{ id: string }> {
    const existing = await prisma.databaseField.findFirst({
      where: { id: fieldId, userId },
    });
    if (!existing) throw new Error("Field not found");

    if (existing.isPrimary) {
      throw new Error(
        "Cannot delete the primary field. Rename it instead, or assign a different field as primary first.",
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. DZ-16: If RELATION, bulk-delete ContextLink rows
      if (existing.type === "RELATION") {
        await tx.$queryRaw`
          DELETE FROM "ContextLink"
          WHERE "databaseFieldId" = ${fieldId}
            AND "userId" = ${userId}
        `;
      }

      // 2. Remove field from every row's properties in batches
      const batchSize = 500;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const rows = await tx.databaseRow.findMany({
          where: { databaseId: existing.databaseId, userId },
          select: { id: true, properties: true },
          skip: offset,
          take: batchSize,
        });

        if (rows.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of rows) {
          const props = row.properties as Record<string, unknown>;
          if (fieldId in props) {
            const { [fieldId]: _, ...remaining } = props;
            await tx.databaseRow.update({
              where: { id: row.id },
              data: { properties: remaining as Prisma.InputJsonValue },
            });
          }
        }

        if (rows.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }

      // 3. Delete the field
      await tx.databaseField.delete({ where: { id: fieldId } });
    });

    return { id: fieldId };
  },

  /**
   * Reorder fields within a database. Validates all field IDs belong to the
   * database. Uses a transaction to update positions atomically.
   */
  async reorder(
    userId: string,
    databaseId: string,
    orderedFieldIds: string[],
  ) {
    // Verify ownership
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId },
    });
    if (!database) throw new Error("Database not found");

    // Validate all field IDs belong to this database
    const fields = await prisma.databaseField.findMany({
      where: { databaseId, userId },
      select: { id: true },
    });
    const fieldIdSet = new Set(fields.map((f) => f.id));
    for (const id of orderedFieldIds) {
      if (!fieldIdSet.has(id)) {
        throw new Error(`Field ${id} does not belong to this database`);
      }
    }

    // Update positions in a transaction. Because of the @@unique([databaseId, position])
    // constraint, we first shift all positions to a high offset to avoid conflicts,
    // then set the final positions.
    await prisma.$transaction(async (tx) => {
      // Phase 1: shift all to a temporary high offset
      for (let i = 0; i < orderedFieldIds.length; i++) {
        await tx.databaseField.update({
          where: { id: orderedFieldIds[i] },
          data: { position: 100000 + i },
        });
      }
      // Phase 2: set final positions
      for (let i = 0; i < orderedFieldIds.length; i++) {
        await tx.databaseField.update({
          where: { id: orderedFieldIds[i] },
          data: { position: i },
        });
      }
    });

    // Return fresh field list
    return prisma.databaseField.findMany({
      where: { databaseId, userId },
      orderBy: { position: "asc" },
    });
  },

  /**
   * Change a field's type. Only allows safe coercions:
   * - TEXT → URL/EMAIL/PHONE: only if all existing values pass the new schema
   * - NUMBER → TEXT: always safe
   * - SELECT → MULTI_SELECT: always safe (wraps single value in array)
   *
   * If force=true, sets non-coercible values to null instead of refusing.
   * Returns the updated field or { ok: false, offendingRowIds } if validation fails.
   */
  async changeType(
    userId: string,
    fieldId: string,
    input: ChangeTypeInput,
  ): Promise<
    | { ok: true; field: Awaited<ReturnType<typeof prisma.databaseField.findFirst>> }
    | { ok: false; offendingRowIds: string[] }
  > {
    const existing = await prisma.databaseField.findFirst({
      where: { id: fieldId, userId },
    });
    if (!existing) throw new Error("Field not found");

    const oldType = existing.type;
    const { newType, force = false } = input;

    if (oldType === newType) {
      return { ok: true, field: existing };
    }

    // Determine if the coercion is allowed
    const allowedCoercions: Record<string, string[]> = {
      TEXT: ["URL", "EMAIL", "PHONE"],
      NUMBER: ["TEXT"],
      SELECT: ["MULTI_SELECT"],
      DATE: ["TEXT"],
      MULTI_SELECT: ["TEXT"],
    };

    const allowed = allowedCoercions[oldType];
    if (!allowed || !allowed.includes(newType)) {
      throw new Error(
        `Unsupported type change from ${oldType} to ${newType}. Delete and recreate the field instead.`,
      );
    }

    // For TEXT → URL/EMAIL/PHONE: validate existing values
    if (oldType === "TEXT" && ["URL", "EMAIL", "PHONE"].includes(newType)) {
      const rows = await prisma.databaseRow.findMany({
        where: { databaseId: existing.databaseId, userId },
        select: { id: true, properties: true },
      });

      const valueSchema = getValueSchemaForType(newType as DatabaseFieldType);
      const offendingRowIds: string[] = [];

      for (const row of rows) {
        const props = row.properties as Record<string, unknown>;
        const value = props[fieldId];
        if (value === null || value === undefined) continue;

        const result = valueSchema.safeParse(value);
        if (!result.success) {
          offendingRowIds.push(row.id);
        }
      }

      if (offendingRowIds.length > 0 && !force) {
        return { ok: false, offendingRowIds };
      }

      // If force, set invalid values to null via interactive transaction
      if (offendingRowIds.length > 0 && force) {
        await prisma.$transaction(async (tx) => {
          for (const rowId of offendingRowIds) {
            const row = await tx.databaseRow.findFirst({
              where: { id: rowId, userId },
              select: { properties: true },
            });
            if (!row) continue;
            const props = row.properties as Record<string, unknown>;
            props[fieldId] = null;
            await tx.databaseRow.update({
              where: { id: rowId },
              data: { properties: props as Prisma.InputJsonValue },
            });
          }
        });
      }
    }

    // For SELECT → MULTI_SELECT: wrap existing single values in arrays
    if (oldType === "SELECT" && newType === "MULTI_SELECT") {
      const rows = await prisma.databaseRow.findMany({
        where: { databaseId: existing.databaseId, userId },
        select: { id: true, properties: true },
      });

      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const props = row.properties as Record<string, unknown>;
          const value = props[fieldId];
          if (value === null || value === undefined) continue;
          if (typeof value === "string") {
            props[fieldId] = [value];
            await tx.databaseRow.update({
              where: { id: row.id },
              data: { properties: props as Prisma.InputJsonValue },
            });
          }
        }
      });
    }

    // For DATE → TEXT: no row-level transformation needed. DATE field values
    // are stored as ISO strings in JSONB, which are already valid TEXT values.
    // The type change on the field itself (below) is sufficient.

    // For MULTI_SELECT → TEXT: join option labels into comma-separated string
    if (oldType === "MULTI_SELECT" && newType === "TEXT") {
      const rows = await prisma.databaseRow.findMany({
        where: { databaseId: existing.databaseId, userId },
        select: { id: true, properties: true },
      });

      // Build an option ID → label lookup from the field's config
      const fieldConfig = existing.config as { options?: Array<{ id: string; label: string }> };
      const optionMap = new Map<string, string>();
      if (fieldConfig.options) {
        for (const opt of fieldConfig.options) {
          optionMap.set(opt.id, opt.label);
        }
      }

      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const props = row.properties as Record<string, unknown>;
          const value = props[fieldId];
          if (value === null || value === undefined) continue;
          if (Array.isArray(value)) {
            // Map option IDs to labels, falling back to the ID itself
            const labels = value.map((optId: unknown) => {
              const id = String(optId);
              return optionMap.get(id) ?? id;
            });
            props[fieldId] = labels.join(", ");
            await tx.databaseRow.update({
              where: { id: row.id },
              data: { properties: props as Prisma.InputJsonValue },
            });
          }
        }
      });
    }

    // If the new type is FORMULA, validate the expression and cycle-check
    // (this shouldn't happen from the allowed coercions above, but defensive)

    // Build the new config
    const newConfig = { type: newType };

    // Update the field type and config
    const updated = await prisma.databaseField.update({
      where: { id: fieldId },
      data: {
        type: newType,
        config: newConfig as unknown as Prisma.InputJsonValue,
      },
    });

    return { ok: true, field: updated };
  },
};

// ── Private: cycle detection ──────────────────────────────────────────

/**
 * Builds a directed graph from all FORMULA fields' dependencies and checks
 * for a cycle after adding the proposed edges from the new/updated field.
 *
 * Nodes are lowercase field names. Edges: fieldName → each dependency name.
 *
 * Uses DFS with coloring (WHITE/GRAY/BLACK) for cycle detection.
 *
 * @param userId - Owner user ID (defense-in-depth: Safety Rule 1)
 * @param databaseId - The database to load fields from
 * @param proposedFieldName - The name of the field being added or updated
 * @param proposedDeps - The dependency names extracted from the formula
 * @param excludeFieldId - If updating, exclude this field's old deps from the graph
 */
async function cycleCheck(
  userId: string,
  databaseId: string,
  proposedFieldName: string,
  proposedDeps: string[],
  excludeFieldId: string | undefined,
): Promise<CycleCheckResult> {
  // Load all FORMULA fields for this database, scoped to userId (defense-in-depth)
  const formulaFields = await prisma.databaseField.findMany({
    where: { databaseId, userId, type: "FORMULA" },
    select: { id: true, name: true, config: true },
  });

  // Build adjacency list: fieldName → [dependency names]
  const graph = new Map<string, string[]>();

  for (const field of formulaFields) {
    // If updating, skip the old version of this field
    if (excludeFieldId && field.id === excludeFieldId) continue;

    const config = field.config as { expression?: string };
    if (!config.expression) continue;

    const parseResult = parseFormula(config.expression);
    if (!parseResult.ok) continue;

    const deps = extractDependencies(parseResult.ast);
    graph.set(field.name.toLowerCase(), deps);
  }

  // Add the proposed field's edges
  graph.set(proposedFieldName.toLowerCase(), proposedDeps);

  // DFS cycle detection with coloring
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of graph.keys()) {
    color.set(node, WHITE);
  }

  // Also ensure all dependency nodes are in the color map
  for (const deps of graph.values()) {
    for (const dep of deps) {
      if (!color.has(dep)) {
        color.set(dep, WHITE);
      }
    }
  }

  function dfs(node: string, path: string[]): string[] | null {
    color.set(node, GRAY);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (color.get(neighbor) === GRAY) {
        // Found a cycle; extract the cycle path
        const cycleStart = path.indexOf(neighbor);
        return [...path.slice(cycleStart), neighbor];
      }
      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, node);
        const cycle = dfs(neighbor, path);
        if (cycle) return cycle;
      }
    }

    color.set(node, BLACK);
    path.pop();
    return null;
  }

  // Run DFS from each unvisited node
  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      const cycle = dfs(node, []);
      if (cycle) {
        return { hasCycle: true, cycle };
      }
    }
  }

  return { hasCycle: false };
}
