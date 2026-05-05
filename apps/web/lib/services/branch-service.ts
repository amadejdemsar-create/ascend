/**
 * Branch Service — fork a node at a specific version.
 *
 * Creates a new entity from a historical version's payload and links it
 * back to the source via a DERIVED_FROM typed edge. Only CONTEXT_ENTRY
 * (of branchable types) and DATABASE_ROW nodes can be branched.
 *
 * Safety features:
 * - Cycle detection: walks DERIVED_FROM edges backward (max 100 hops)
 * - Soft-cap warning at >5 derivatives
 * - Hard-cap throw at >50 derivatives
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import { contextService } from "./context-service";
import { databaseRowService } from "./database-row-service";
import { contextLinkService } from "./context-link-service";
import { versioningService } from "./versioning-service";
import type { NodeType } from "@/lib/validations";
import type { ContextEntryType } from "../../generated/prisma/client";

// ── Constants ─────────────────────────────��──────────────────────────

const BRANCHABLE_CONTEXT_ENTRY_TYPES = new Set<string>([
  "NOTE",
  "SOURCE",
  "PROJECT",
  "PERSON",
  "DECISION",
  "QUESTION",
  "AREA",
]);

const SOFT_DERIVATIVE_WARNING = 5;
const HARD_DERIVATIVE_LIMIT = 50;
const CYCLE_DETECTION_MAX_HOPS = 100;

// ── Types ─────────────────────────────────────────────────────���──────

export type BranchResult = {
  newNodeId: string;
  newVersionId: string | null;
  derivedFromLinkId: string;
  warning?: string;
};

// ── Service ──────────────────────────────────────────────────────────

export const branchService = {
  /**
   * Branch (fork) a node from a specific version.
   *
   * Creates a new entity populated from the version's payload, then
   * creates a DERIVED_FROM link from the new node to the original source.
   *
   * @param title - Title for the new branched entity
   */
  async branch(
    userId: string,
    versionId: string,
    title: string,
  ): Promise<BranchResult> {
    const target = await versioningService.getVersion(userId, versionId);
    if (!target) throw new Error("Version not found");

    const nodeType = target.nodeType as NodeType;
    const nodeId = target.nodeId;
    const payload = target.payload as Record<string, unknown>;

    // Validate branch-eligibility
    if (nodeType === "CONTEXT_ENTRY") {
      const entryType = String(payload.type ?? "NOTE");
      if (!BRANCHABLE_CONTEXT_ENTRY_TYPES.has(entryType)) {
        throw new Error(`Cannot branch ContextEntry of type ${entryType}`);
      }
    } else if (nodeType !== "DATABASE_ROW") {
      throw new Error(
        `Cannot branch nodeType ${nodeType}. Only CONTEXT_ENTRY and DATABASE_ROW are branchable.`,
      );
    }

    // Determine the source entry ID for DERIVED_FROM link target.
    // For CONTEXT_ENTRY: nodeId IS the entry ID.
    // For DATABASE_ROW: nodeId is the row ID; link target is the row's contextEntryId.
    let sourceEntryId: string;
    if (nodeType === "CONTEXT_ENTRY") {
      sourceEntryId = nodeId;
    } else {
      // DATABASE_ROW: the contextEntryId is in the payload
      const ctxId = payload.contextEntryId as string | undefined;
      if (!ctxId) {
        throw new Error(
          "Cannot branch DATABASE_ROW: missing contextEntryId in payload",
        );
      }
      sourceEntryId = ctxId;
    }

    // Cycle detection: walk DERIVED_FROM ancestors backward from source
    await this._cycleCheck(userId, sourceEntryId);

    // Derivative cap: count existing DERIVED_FROM links pointing TO the source
    const derivativeCount = await prisma.contextLink.count({
      where: {
        userId,
        type: "DERIVED_FROM",
        toEntryId: sourceEntryId,
      },
    });
    if (derivativeCount >= HARD_DERIVATIVE_LIMIT) {
      throw new Error(
        `Cannot branch: source already has ${HARD_DERIVATIVE_LIMIT} derivatives`,
      );
    }
    const warning =
      derivativeCount >= SOFT_DERIVATIVE_WARNING
        ? `Source already has ${derivativeCount} derivatives.`
        : undefined;

    // Create new entity
    let newEntryId: string;

    if (nodeType === "CONTEXT_ENTRY") {
      const content = typeof payload.content === "string" ? payload.content : "";
      const categoryId =
        typeof payload.categoryId === "string" ? payload.categoryId : undefined;
      const tags = Array.isArray(payload.tags)
        ? (payload.tags as string[])
        : undefined;

      const created = await contextService.create(userId, {
        title,
        content: content || " ", // content is required min(1) in schema
        categoryId,
        tags,
      });
      newEntryId = created.id;

      // Set the type if it differs from the default NOTE
      const entryType = String(payload.type ?? "NOTE");
      if (entryType !== "NOTE") {
        await contextService.updateType(
          userId,
          newEntryId,
          entryType as ContextEntryType,
        );
      }
    } else {
      // DATABASE_ROW
      const databaseId = payload.databaseId as string | undefined;
      if (!databaseId) {
        throw new Error(
          "Cannot branch DATABASE_ROW: missing databaseId in payload",
        );
      }
      const properties =
        (payload.properties as Record<string, unknown>) ?? {};
      const created = await databaseRowService.create(
        userId,
        databaseId,
        properties,
      );
      newEntryId = created.contextEntryId;
    }

    // Create DERIVED_FROM link: new node → original source
    const link = await contextLinkService.create(userId, {
      fromEntryId: newEntryId,
      toEntryId: sourceEntryId,
      type: "DERIVED_FROM",
      source: "MANUAL",
    });

    // BRANCH-triggered snapshot on the new node. For DATABASE_ROW the
    // versionable unit is the row id (not the entry id); fetch it since
    // databaseRowService.create returns the row object without exposing
    // its id directly in our type contract.
    let snapshotNodeId = newEntryId;
    if (nodeType === "DATABASE_ROW") {
      const newRow = await prisma.databaseRow.findFirst({
        where: { contextEntryId: newEntryId, userId },
        select: { id: true },
      });
      if (newRow) snapshotNodeId = newRow.id;
    }

    const newVersion = await versioningService.createSnapshot(
      userId,
      nodeType,
      snapshotNodeId,
      "BRANCH",
      versionId,
    );

    return {
      newNodeId: newEntryId,
      newVersionId: newVersion?.id ?? null,
      derivedFromLinkId: link.id,
      warning,
    };
  },

  /**
   * Walk DERIVED_FROM edges backward from a source entry to detect cycles.
   * Refuses branching if:
   * - A cycle is detected (walking backward reaches the source again)
   * - The chain exceeds 100 hops (likely a cycle or pathological depth)
   */
  async _cycleCheck(userId: string, sourceEntryId: string): Promise<void> {
    let current = sourceEntryId;
    const visited = new Set<string>();
    visited.add(current);

    for (let i = 0; i < CYCLE_DETECTION_MAX_HOPS; i++) {
      // Find the DERIVED_FROM link FROM this entry (this entry was derived from something)
      const parentLink = await prisma.contextLink.findFirst({
        where: { userId, type: "DERIVED_FROM", fromEntryId: current },
        select: { toEntryId: true },
      });
      if (!parentLink || !parentLink.toEntryId) return; // reached a root; no cycle
      if (visited.has(parentLink.toEntryId)) {
        throw new Error("Cycle detected in DERIVED_FROM chain");
      }
      visited.add(parentLink.toEntryId);
      current = parentLink.toEntryId;
    }
    // Hit the hop cap; treat as suspect and refuse
    throw new Error(
      `DERIVED_FROM chain exceeds ${CYCLE_DETECTION_MAX_HOPS} hops; cannot branch`,
    );
  },
};
