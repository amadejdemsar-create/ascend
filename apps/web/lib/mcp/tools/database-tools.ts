/**
 * Database MCP Tool Handlers.
 *
 * 10 tools exposing the database system (Wave 5) to AI agents:
 *   create_database, add_field, update_field, delete_field,
 *   create_row, update_row, delete_row,
 *   create_view, update_view, query_database.
 *
 * Each handler validates args via Zod, calls the service layer, and returns
 * McpContent. userId comes from createAscendMcpServer(userId) factory.
 *
 * Follows the Wave 4 file-tools pattern (ok/fail helpers, ZodError catch).
 */

import { ZodError } from "zod";
import { databaseService } from "@/lib/services/database-service";
import { databaseFieldService } from "@/lib/services/database-field-service";
import { databaseRowService } from "@/lib/services/database-row-service";
import { databaseViewService } from "@/lib/services/database-view-service";
import { databaseQueryService } from "@/lib/services/database-query-service";
import {
  createDatabaseSchema,
  createDatabaseFieldSchema,
  updateDatabaseFieldSchema,
  createDatabaseRowSchema,
  updateDatabaseRowSchema,
  createDatabaseViewSchema,
  updateDatabaseViewSchema,
  databaseQuerySchema,
} from "@/lib/validations";
import { z } from "zod";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(result: unknown): McpContent {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function fail(message: string): McpContent {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ── Zod schemas for MCP-specific arg parsing ──────────────────────────

const deleteFieldArgsSchema = z.object({
  fieldId: z.string().min(1),
});

const deleteRowArgsSchema = z.object({
  rowId: z.string().min(1),
});

const queryDatabaseArgsSchema = z.object({
  databaseId: z.string().min(1),
  viewId: z.string().optional(),
  filter: z.unknown().optional(),
  sort: z.unknown().optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(500).optional(),
});

// ── Handler ───────────────────────────────────────────────────────────

export async function handleDatabaseTool(
  userId: string,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "create_database": {
        const data = createDatabaseSchema.parse(args);
        const result = await databaseService.create(userId, workspaceId, data);
        return ok({
          databaseId: result.database?.id,
          contextEntryId: result.contextEntry?.id,
          name: result.contextEntry?.title,
          fields: result.fields?.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            isPrimary: f.isPrimary,
          })),
          views: result.views?.map((v) => ({
            id: v.id,
            name: v.name,
            type: v.type,
          })),
        });
      }

      case "add_field": {
        const { databaseId, ...fieldData } = z
          .object({
            databaseId: z.string().min(1),
            name: z.string().min(1).max(80),
            type: createDatabaseFieldSchema.shape.type,
            config: z.record(z.string(), z.unknown()).optional(),
          })
          .parse(args);
        const result = await databaseFieldService.add(userId, workspaceId, databaseId, {
          name: fieldData.name,
          type: fieldData.type,
          config: fieldData.config,
        });
        return ok({
          fieldId: result.id,
          databaseId: result.databaseId,
          name: result.name,
          type: result.type,
          position: result.position,
          isPrimary: result.isPrimary,
        });
      }

      case "update_field": {
        const { fieldId, ...updateData } = z
          .object({
            fieldId: z.string().min(1),
            name: z.string().min(1).max(80).optional(),
            config: z.record(z.string(), z.unknown()).optional(),
            position: z.number().int().min(0).optional(),
          })
          .parse(args);
        const result = await databaseFieldService.update(
          userId,
          workspaceId,
          fieldId,
          updateData,
        );
        return ok({
          fieldId: result.id,
          databaseId: result.databaseId,
          name: result.name,
          type: result.type,
          position: result.position,
        });
      }

      case "delete_field": {
        const { fieldId } = deleteFieldArgsSchema.parse(args);
        await databaseFieldService.delete(userId, workspaceId, fieldId);
        return ok({ deleted: true, fieldId });
      }

      case "create_row": {
        const { databaseId, properties } = z
          .object({
            databaseId: z.string().min(1),
            properties: z.record(z.string(), z.unknown()).optional(),
          })
          .parse(args);
        const result = await databaseRowService.create(userId, workspaceId, databaseId, properties ?? {});
        return ok({
          rowId: result.id,
          databaseId: result.databaseId,
          contextEntryId: result.contextEntryId,
          position: result.position,
          properties: result.properties,
        });
      }

      case "update_row": {
        const { rowId, propertiesPatch } = z
          .object({
            rowId: z.string().min(1),
            propertiesPatch: z.record(z.string(), z.unknown()),
          })
          .parse(args);
        const result = await databaseRowService.update(userId, workspaceId, rowId, propertiesPatch);
        if (!result) return fail("Row not found after update");
        return ok({
          rowId: result.id,
          databaseId: result.databaseId,
          contextEntryId: result.contextEntryId,
          position: result.position,
          properties: result.properties,
        });
      }

      case "delete_row": {
        const { rowId } = deleteRowArgsSchema.parse(args);
        await databaseRowService.delete(userId, workspaceId, rowId);
        return ok({ deleted: true, rowId });
      }

      case "create_view": {
        const { databaseId, ...viewData } = z
          .object({
            databaseId: z.string().min(1),
            name: z.string().min(1).max(80),
            type: createDatabaseViewSchema.shape.type,
            config: z.record(z.string(), z.unknown()).optional(),
          })
          .parse(args);
        const result = await databaseViewService.create(
          userId,
          workspaceId,
          databaseId,
          // Config is validated inside the service via databaseViewConfigSchema.parse()
          viewData as unknown as { name: string; type: "TABLE" | "BOARD" | "CALENDAR" | "GALLERY" | "TIMELINE"; config?: undefined },
        );
        return ok({
          viewId: result.id,
          databaseId: result.databaseId,
          name: result.name,
          type: result.type,
          position: result.position,
        });
      }

      case "update_view": {
        const { viewId, ...updateData } = z
          .object({
            viewId: z.string().min(1),
            name: z.string().min(1).max(80).optional(),
            config: z.record(z.string(), z.unknown()).optional(),
          })
          .parse(args);
        const result = await databaseViewService.update(
          userId,
          workspaceId,
          viewId,
          // Config is validated inside the service via databaseViewConfigSchema.parse()
          updateData as unknown as { name?: string; config?: undefined },
        );
        return ok({
          viewId: result.id,
          databaseId: result.databaseId,
          name: result.name,
          type: result.type,
          config: result.config,
        });
      }

      case "query_database": {
        const { databaseId, ...queryInput } = queryDatabaseArgsSchema.parse(args);
        // Validate the inner filter/sort via the canonical schema
        const validated = databaseQuerySchema.parse({
          viewId: queryInput.viewId,
          filter: queryInput.filter,
          sort: queryInput.sort,
          page: queryInput.page ?? 1,
          perPage: queryInput.perPage ?? 200,
        });
        const result = await databaseQueryService.query(
          userId,
          workspaceId,
          databaseId,
          validated,
        );
        return ok({
          rows: result.rows.map((r) => ({
            rowId: r.id,
            contextEntryId: r.contextEntryId,
            position: r.position,
            properties: r.properties,
            formulaValues: r.formulaValues ?? null,
          })),
          total: result.total,
          page: result.page,
          perPage: result.perPage,
        });
      }

      default:
        return fail(`Unknown database tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(`Validation error: ${JSON.stringify(error.issues)}`);
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}
