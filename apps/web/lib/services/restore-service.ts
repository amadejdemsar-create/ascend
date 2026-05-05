/**
 * Restore Service — revert a node to a historical version.
 *
 * Dispatches to the appropriate entity service's update path based on
 * nodeType. Before mutating, creates a "forward snapshot" of the current
 * state (so the pre-restore state is not lost). After mutating, creates a
 * RESTORE-triggered snapshot of the new state.
 *
 * Limitations (documented in warnings):
 * - Edges (ContextLinks) are NOT time-traveled. The current graph
 *   relationships are preserved after restore.
 * - Block document restore uses optimistic concurrency; a concurrent edit
 *   during restore may cause a conflict (warning added, not fatal).
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { contextService } from "./context-service";
import { goalService } from "./goal-service";
import { todoService } from "./todo-service";
import { databaseRowService } from "./database-row-service";
import { databaseFieldService } from "./database-field-service";
import { blockDocumentService } from "./block-document-service";
import { versioningService } from "./versioning-service";
import type { NodeType } from "@/lib/validations";
import type {
  UpdateContextInput,
  UpdateGoalInput,
  UpdateTodoInput,
} from "@/lib/validations";

// ── Types ────────────────────────────────────────────────────────────

export type RestoreResult = {
  restoredVersionId: string;
  newVersionId: string | null; // null if dryRun or snapshot dedup
  warnings: string[];
};

export type RestorePreview = {
  previewPayload: Record<string, unknown>;
  warnings: string[];
};

// ── Service ──────────────────────────────────────────────────────────

export const restoreService = {
  /**
   * Restore a node to a historical version.
   *
   * @param dryRun - If true, returns the payload that would be applied
   *   without actually mutating anything.
   */
  async restore(
    userId: string,
    versionId: string,
    dryRun = false,
  ): Promise<RestoreResult | RestorePreview> {
    const target = await versioningService.getVersion(userId, versionId);
    if (!target) throw new Error("Version not found");

    const nodeType = target.nodeType as NodeType;
    const nodeId = target.nodeId;
    const payload = target.payload as Record<string, unknown>;

    const warnings: string[] = [
      "Edges (ContextLinks) are not time-traveled. Current relationships preserved.",
    ];

    if (dryRun) {
      return { previewPayload: payload, warnings };
    }

    // Forward snapshot of current state before mutating. Uses EDIT_EXPLICIT
    // which bypasses dedup (will still dedup if content is identical).
    await versioningService.createSnapshot(
      userId,
      nodeType,
      nodeId,
      "EDIT_EXPLICIT",
    );

    // Dispatch to appropriate service
    try {
      switch (nodeType) {
        case "CONTEXT_ENTRY":
          await this._restoreContextEntry(userId, nodeId, payload, warnings);
          break;
        case "GOAL":
          await this._restoreGoal(userId, nodeId, payload, warnings);
          break;
        case "TODO":
          await this._restoreTodo(userId, nodeId, payload, warnings);
          break;
        case "DATABASE_ROW":
          await this._restoreDatabaseRow(userId, nodeId, payload, warnings);
          break;
        case "DATABASE_FIELD":
          await this._restoreDatabaseField(userId, nodeId, payload, warnings);
          break;
      }
    } catch (err) {
      throw new Error(
        `Restore failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // RESTORE-triggered snapshot of the new state
    const newVersion = await versioningService.createSnapshot(
      userId,
      nodeType,
      nodeId,
      "RESTORE",
      versionId,
    );

    return {
      restoredVersionId: versionId,
      newVersionId: newVersion?.id ?? null,
      warnings,
    };
  },

  // ── Private restore dispatchers ────────────────────────────────────

  async _restoreContextEntry(
    userId: string,
    id: string,
    payload: Record<string, unknown>,
    warnings: string[],
  ) {
    // Build UpdateContextInput from payload
    const patch: UpdateContextInput = {};
    if ("title" in payload && typeof payload.title === "string") {
      patch.title = payload.title;
    }
    if ("content" in payload && typeof payload.content === "string") {
      patch.content = payload.content;
    }
    if ("categoryId" in payload) {
      patch.categoryId = (payload.categoryId as string | undefined) ?? undefined;
    }
    if ("tags" in payload && Array.isArray(payload.tags)) {
      patch.tags = payload.tags as string[];
    }
    if ("type" in payload && typeof payload.type === "string") {
      patch.type = payload.type as UpdateContextInput["type"];
    }

    // Only call update if there's something to patch
    const hasFields = Object.keys(patch).length > 0;
    if (hasFields) {
      await contextService.update(userId, id, patch);
    }

    // Restore block document snapshot if present
    if (payload.blockDocumentSnapshot) {
      try {
        // Need current version for optimistic concurrency
        const currentDoc = await blockDocumentService.getByEntryId(userId, id);
        if (currentDoc) {
          const result = await blockDocumentService.replaceSnapshot(
            userId,
            id,
            payload.blockDocumentSnapshot,
            currentDoc.version,
          );
          if (result.conflict) {
            warnings.push(
              "Block document restore hit a version conflict (concurrent edit). " +
                "The block content may not have been fully restored.",
            );
          }
        } else {
          warnings.push(
            "Block document not found for this entry; block content was not restored.",
          );
        }
      } catch (err) {
        warnings.push(
          `Block document restore failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  },

  async _restoreGoal(
    userId: string,
    id: string,
    payload: Record<string, unknown>,
    _warnings: string[],
  ) {
    const patch: Partial<UpdateGoalInput> = {};
    const goalFields = [
      "title",
      "description",
      "horizon",
      "status",
      "priority",
      "categoryId",
      "parentId",
      "startDate",
      "deadline",
      "progress",
    ] as const;

    for (const k of goalFields) {
      if (k in payload) {
        (patch as Record<string, unknown>)[k] = payload[k];
      }
    }

    await goalService.update(userId, id, patch as UpdateGoalInput);
  },

  async _restoreTodo(
    userId: string,
    id: string,
    payload: Record<string, unknown>,
    _warnings: string[],
  ) {
    const patch: Partial<UpdateTodoInput> = {};
    const todoFields = [
      "title",
      "description",
      "status",
      "priority",
      "categoryId",
      "goalId",
      "dueDate",
      "scheduledDate",
    ] as const;

    for (const k of todoFields) {
      if (k in payload) {
        (patch as Record<string, unknown>)[k] = payload[k];
      }
    }

    await todoService.update(userId, id, patch as UpdateTodoInput);
  },

  async _restoreDatabaseRow(
    userId: string,
    rowId: string,
    payload: Record<string, unknown>,
    warnings: string[],
  ) {
    // Restore properties via merge patch
    if (payload.properties && typeof payload.properties === "object") {
      await databaseRowService.update(
        userId,
        rowId,
        payload.properties as Record<string, unknown>,
      );
    }

    // Restore body snapshot if present
    if (payload.bodySnapshot && payload.contextEntryId) {
      try {
        const entryId = payload.contextEntryId as string;
        const currentDoc = await blockDocumentService.getByEntryId(
          userId,
          entryId,
        );
        if (currentDoc) {
          const result = await blockDocumentService.replaceSnapshot(
            userId,
            entryId,
            payload.bodySnapshot,
            currentDoc.version,
          );
          if (result.conflict) {
            warnings.push(
              "Row body restore hit a version conflict. Body may not be fully restored.",
            );
          }
        }
      } catch (err) {
        warnings.push(
          `Row body restore failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  },

  async _restoreDatabaseField(
    userId: string,
    fieldId: string,
    payload: Record<string, unknown>,
    _warnings: string[],
  ) {
    const patch: { name?: string; config?: Record<string, unknown>; position?: number } = {};
    if ("name" in payload && typeof payload.name === "string") {
      patch.name = payload.name;
    }
    if ("config" in payload && typeof payload.config === "object" && payload.config !== null) {
      patch.config = payload.config as Record<string, unknown>;
    }
    if ("position" in payload && typeof payload.position === "number") {
      patch.position = payload.position;
    }

    await databaseFieldService.update(userId, fieldId, patch);
  },
};
