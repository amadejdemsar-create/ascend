/**
 * Context Map Service.
 *
 * Synthesizes a structured "map" of the user's context graph using
 * LLM chat. The map identifies themes, principles, projects, tensions,
 * and orphan entries. Stored as a single row per user in ContextMap
 * (userId @unique, upsert on refresh).
 *
 * All LLM calls go through llmService.chat which enforces cost caps
 * (DZ-9). This service never calls a provider directly.
 *
 * Follows the const-object service pattern (see goal-service.ts).
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import type { ChatProviderKind as PrismaChatProviderKind } from "../../generated/prisma/client";
import { llmService } from "@/lib/services/llm-service";
import { contextMapContentSchema } from "@/lib/validations";
import type { ContextMapContent } from "@/lib/validations";
import { estimateCostCents } from "@ascend/llm";
import {
  buildSinglePassMessages,
  buildChunkPass1Messages,
  buildChunkPass2Messages,
  identifyOrphans,
  CONTEXT_MAP_OUTPUT_SCHEMA,
  type GraphNode,
  type GraphEdge,
} from "@/lib/services/context-map-prompt";

// ── Constants ────────────────────────────────────────────────────

/** Minimum seconds between user-triggered refreshes. */
const COOLDOWN_SECONDS = 30 * 60; // 30 minutes

/** Threshold: graphs above this node count use chunked (multi-pass) synthesis. */
const CHUNK_THRESHOLD = 200;

/** Number of nodes in the first batch for chunked synthesis. */
const FIRST_BATCH_SIZE = 100;

/** Max output tokens for the synthesis call. */
const MAX_OUTPUT_TOKENS = 4096;

// ── Types ────────────────────────────────────────────────────────

export interface ContextMapWithMeta {
  id: string;
  userId: string;
  content: ContextMapContent;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Custom error for malformed LLM JSON output ───────────────────

export class ContextMapParseError extends Error {
  readonly rawOutput: string;

  constructor(rawOutput: string, cause?: unknown) {
    const truncated =
      rawOutput.length > 500 ? rawOutput.slice(0, 500) + "..." : rawOutput;
    super(
      `Failed to parse Context Map from LLM output. ` +
        `Raw response (truncated): ${truncated}`,
    );
    this.name = "ContextMapParseError";
    this.rawOutput = truncated;
    if (cause) this.cause = cause;
  }
}

// ── Service ──────────────────────────────────────────────────────

export const contextMapService = {
  /**
   * Get the current Context Map for a user.
   * Returns null if no map has been generated yet.
   */
  async getCurrent(userId: string): Promise<ContextMapWithMeta | null> {
    const row = await prisma.contextMap.findFirst({
      where: { userId },
    });

    if (!row) return null;

    // Parse the JSON content through the schema for type safety
    const content = contextMapContentSchema.parse(row.content);

    return {
      id: row.id,
      userId: row.userId,
      content,
      provider: row.provider,
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costCents: row.costCents,
      generatedAt: row.generatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  /**
   * Check whether a user-initiated refresh is allowed (30-minute cooldown).
   * The cron path bypasses this check entirely.
   */
  async canRefresh(
    userId: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    retryAfterSec?: number;
    nextAllowedAt?: Date;
  }> {
    const existing = await prisma.contextMap.findFirst({
      where: { userId },
      select: { generatedAt: true },
    });

    if (!existing) {
      return { ok: true };
    }

    const elapsedMs = Date.now() - existing.generatedAt.getTime();
    const elapsedSec = elapsedMs / 1000;

    if (elapsedSec < COOLDOWN_SECONDS) {
      const retryAfterSec = Math.ceil(COOLDOWN_SECONDS - elapsedSec);
      const nextAllowedAt = new Date(
        existing.generatedAt.getTime() + COOLDOWN_SECONDS * 1000,
      );
      return {
        ok: false,
        reason: `Refresh cooldown active. Try again in ${retryAfterSec} seconds.`,
        retryAfterSec,
        nextAllowedAt,
      };
    }

    return { ok: true };
  },

  /**
   * Generate (or regenerate) the Context Map for a user.
   *
   * Flow:
   *   1. Fetch the user's full graph (entries with content + edges).
   *   2. Decide single-pass vs chunked synthesis based on node count.
   *   3. Call llmService.chat (cost-cap enforced, usage logged).
   *   4. Parse the structured JSON output.
   *   5. Upsert the ContextMap row.
   *   6. Return the result.
   *
   * Throws ContextMapParseError if the LLM output is malformed JSON.
   * Throws BudgetExceededError (from llmService) if cost cap is hit.
   * Throws MissingApiKeyError if the user's provider key is not set.
   */
  async refresh(userId: string): Promise<ContextMapWithMeta> {
    // 1. Fetch the user's full graph with content
    const { nodes, edges } = await fetchGraphWithContent(userId);

    if (nodes.length === 0) {
      throw new Error(
        "Cannot generate a Context Map: no context entries found. " +
          "Add some entries to your context graph first.",
      );
    }

    // 2. Synthesize via single-pass or chunked
    let result: SynthesisResult;
    if (nodes.length <= CHUNK_THRESHOLD) {
      result = await singlePassSynthesize(userId, nodes, edges);
    } else {
      result = await chunkedSynthesize(userId, nodes, edges);
    }

    // 3. Upsert the ContextMap row (userId is @unique, so upsert on conflict)
    // Cast the Zod-validated content to Prisma's InputJsonValue, and the
    // provider string to PrismaChatProviderKind (structurally identical
    // union but TypeScript treats them as different nominal types).
    const contentJson = result.content as unknown as Prisma.InputJsonValue;
    const provider = result.provider as PrismaChatProviderKind;
    const row = await prisma.contextMap.upsert({
      where: { userId },
      update: {
        content: contentJson,
        provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCents: result.costCents,
        generatedAt: new Date(),
      },
      create: {
        userId,
        content: contentJson,
        provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCents: result.costCents,
        generatedAt: new Date(),
      },
    });

    return {
      id: row.id,
      userId: row.userId,
      content: result.content,
      provider: row.provider,
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costCents: row.costCents,
      generatedAt: row.generatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
};

// ── Internal types ───────────────────────────────────────────────

interface SynthesisResult {
  content: ContextMapContent;
  /** The provider kind string (e.g. "GEMINI"). Cast to PrismaChatProviderKind at the Prisma boundary. */
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Fetch the full graph with content for the synthesis prompt.
 * Unlike contextService.getGraph which omits content for visualization
 * performance, this query includes the content field (needed for LLM
 * synthesis). No cap is applied since the prompt builder handles
 * truncation per entry.
 *
 * userId scoped (safety rule 1).
 */
async function fetchGraphWithContent(
  userId: string,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const [entries, links] = await Promise.all([
    prisma.contextEntry.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        isPinned: true,
        _count: {
          select: {
            outgoingLinks: { where: { userId } },
            incomingLinks: { where: { userId } },
          },
        },
      },
    }),
    prisma.contextLink.findMany({
      where: { userId },
      select: {
        id: true,
        fromEntryId: true,
        toEntryId: true,
        type: true,
      },
    }),
  ]);

  const nodes: GraphNode[] = entries.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    isPinned: e.isPinned,
    content: e.content ?? undefined,
    outgoingCount: e._count.outgoingLinks,
    incomingCount: e._count.incomingLinks,
  }));

  const edges: GraphEdge[] = links.map((l) => ({
    id: l.id,
    fromId: l.fromEntryId,
    toId: l.toEntryId,
    type: l.type,
  }));

  return { nodes, edges };
}

/**
 * Parse LLM output as ContextMapContent.
 * Handles both raw JSON strings and objects already parsed by the provider.
 * Throws ContextMapParseError on failure.
 */
function parseMapOutput(raw: string): ContextMapContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ContextMapParseError(raw, e);
  }

  try {
    return contextMapContentSchema.parse(parsed);
  } catch (e) {
    throw new ContextMapParseError(raw, e);
  }
}

/**
 * Single-pass synthesis for graphs with 200 or fewer nodes.
 */
async function singlePassSynthesize(
  userId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<SynthesisResult> {
  const { system, userMessage } = buildSinglePassMessages(nodes, edges);

  const chatResult = await llmService.chat(
    userId,
    {
      system,
      messages: [{ role: "user", content: userMessage }],
      jsonSchema: CONTEXT_MAP_OUTPUT_SCHEMA,
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
    },
    { purpose: "map_refresh" },
  );

  const content = parseMapOutput(chatResult.content);

  // Resolve provider info for the ContextMap row
  const { model, providerKind } = await llmService.resolveProvider(userId);

  // Compute actual cost from real token counts
  const costCents = estimateCostCents({
    provider: providerKind,
    model,
    promptTokens: chatResult.promptTokens,
    completionTokens: chatResult.completionTokens,
  });

  return {
    content,
    provider: providerKind,
    model: chatResult.rawModel,
    inputTokens: chatResult.promptTokens,
    outputTokens: chatResult.completionTokens,
    costCents,
  };
}

/**
 * Chunked synthesis for graphs with more than 200 nodes.
 *
 * Pass 1: themes + principles from the first ~100 nodes (sorted by degree).
 * Pass 2: projects + tensions from all nodes (with Pass-1 output as context).
 * Pass 3: orphans = nodes with degree 0 (no extra LLM call).
 *
 * Token counts and costs are summed across both LLM calls.
 */
async function chunkedSynthesize(
  userId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): Promise<SynthesisResult> {
  // Sort by degree descending for the first batch
  const sorted = [...nodes].sort((a, b) => {
    const degA = a.outgoingCount + a.incomingCount;
    const degB = b.outgoingCount + b.incomingCount;
    return degB - degA;
  });

  const firstBatch = sorted.slice(0, FIRST_BATCH_SIZE);
  const firstBatchIds = new Set(firstBatch.map((n) => n.id));
  const firstBatchEdges = edges.filter(
    (e) => firstBatchIds.has(e.fromId) && firstBatchIds.has(e.toId),
  );

  // Pass 1: themes + principles from first batch
  const pass1Prompt = buildChunkPass1Messages(firstBatch, firstBatchEdges);
  const pass1Result = await llmService.chat(
    userId,
    {
      system: pass1Prompt.system,
      messages: [{ role: "user", content: pass1Prompt.userMessage }],
      jsonSchema: CONTEXT_MAP_OUTPUT_SCHEMA,
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
    },
    { purpose: "map_refresh" },
  );

  // Pass 2: projects + tensions from all nodes, with Pass-1 context
  const pass2Prompt = buildChunkPass2Messages(
    nodes,
    edges,
    pass1Result.content,
  );
  const pass2Result = await llmService.chat(
    userId,
    {
      system: pass2Prompt.system,
      messages: [{ role: "user", content: pass2Prompt.userMessage }],
      jsonSchema: CONTEXT_MAP_OUTPUT_SCHEMA,
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
    },
    { purpose: "map_refresh" },
  );

  // Parse both outputs
  const pass1Content = parseMapOutput(pass1Result.content);
  const pass2Content = parseMapOutput(pass2Result.content);

  // Pass 3: orphans (no LLM call, just filter degree-0 nodes)
  const orphanEntries = identifyOrphans(nodes);
  const orphanItems = orphanEntries.map((o) => ({
    title: o.title,
    description: `Type: ${o.type}. No connections in the graph.`,
    entryIds: [o.id],
  }));

  // Merge results: themes + principles from pass 1, projects + tensions from pass 2, orphans from pass 3
  const mergedContent: ContextMapContent = {
    summary:
      pass2Content.summary ?? pass1Content.summary ?? undefined,
    themes: [...pass1Content.themes, ...pass2Content.themes],
    principles: [...pass1Content.principles, ...pass2Content.principles],
    projects: pass2Content.projects,
    tensions: pass2Content.tensions,
    orphans: orphanItems,
  };

  // Sum token counts and costs
  const totalInputTokens =
    pass1Result.promptTokens + pass2Result.promptTokens;
  const totalOutputTokens =
    pass1Result.completionTokens + pass2Result.completionTokens;

  const { model, providerKind } = await llmService.resolveProvider(userId);
  const totalCostCents = estimateCostCents({
    provider: providerKind,
    model,
    promptTokens: totalInputTokens,
    completionTokens: totalOutputTokens,
  });

  return {
    content: mergedContent,
    provider: providerKind,
    model: pass2Result.rawModel,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costCents: totalCostCents,
  };
}
