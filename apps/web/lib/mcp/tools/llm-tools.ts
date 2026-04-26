import { contextMapService } from "@/lib/services/context-map-service";
import { contextService } from "@/lib/services/context-service";
import { contextLinkService } from "@/lib/services/context-link-service";
import { embeddingService } from "@/lib/services/embedding-service";
import { llmService } from "@/lib/services/llm-service";
import { z, ZodError } from "zod";
import { CONTEXT_LINK_TYPE_VALUES } from "@ascend/core";

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

/**
 * Handle LLM/AI-native MCP tool calls.
 *
 * Five tools: get_context_map, refresh_context_map, suggest_connections,
 * detect_contradictions, summarize_subgraph.
 *
 * Every LLM call path goes through llmService.chat which enforces the
 * DZ-9 cost cap. get_context_map is read-only (no LLM call).
 */
export async function handleLlmTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      // ── Read-only: current map ──────────────────────────────────
      case "get_context_map": {
        const map = await contextMapService.getCurrent(userId);
        return ok(map);
      }

      // ── Refresh map (respects cooldown + cost cap) ──────────────
      case "refresh_context_map": {
        const cooldown = await contextMapService.canRefresh(userId);
        if (!cooldown.ok) {
          return fail(
            cooldown.reason ??
              `Cooldown active. Retry after ${cooldown.retryAfterSec ?? 0} seconds.`,
          );
        }
        const map = await contextMapService.refresh(userId);
        return ok(map);
      }

      // ── Suggest typed-link connections ───────────────────────────
      case "suggest_connections": {
        const { entryId } = z
          .object({ entryId: z.string().min(1) })
          .parse(args);

        return ok(await suggestConnections(userId, entryId));
      }

      // ── Detect contradictions / tensions ────────────────────────
      case "detect_contradictions": {
        const { entryId } = z
          .object({ entryId: z.string().min(1).optional() })
          .parse(args);

        return ok(await detectContradictions(userId, entryId));
      }

      // ── Summarize subgraph ──────────────────────────────────────
      case "summarize_subgraph": {
        const { rootEntryId, depth } = z
          .object({
            rootEntryId: z.string().min(1),
            depth: z.number().int().min(1).max(2).optional().default(2),
          })
          .parse(args);

        return ok(await summarizeSubgraph(userId, rootEntryId, depth));
      }

      default:
        return fail(`Unknown LLM tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(`Validation error: ${JSON.stringify(error.issues)}`);
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

// ── Internal: suggest_connections ──────────────────────────────────

interface ConnectionSuggestion {
  toEntryId: string;
  toEntryTitle: string;
  type: string;
  reasoning: string;
  score: number;
}

async function suggestConnections(
  userId: string,
  entryId: string,
): Promise<ConnectionSuggestion[]> {
  // 1. Get the source entry
  const entry = await contextService.getById(userId, entryId);
  if (!entry) throw new Error("Context entry not found");

  // 2. Get existing links so we can filter them out
  const existingLinks = await contextLinkService.listForEntry(userId, entryId);
  const linkedIds = new Set<string>();
  for (const link of existingLinks.outgoing) {
    linkedIds.add(link.toEntryId);
  }
  for (const link of existingLinks.incoming) {
    linkedIds.add(link.fromEntryId);
  }
  linkedIds.add(entryId); // exclude self

  // 3. Semantic search for related entries
  const textToSearch = `${entry.title}\n\n${entry.content ?? ""}`.trim();
  if (textToSearch.length === 0) return [];

  const semanticResults = await embeddingService.searchSemantic(
    userId,
    textToSearch,
    20,
  );

  // 4. Filter out already-linked entries
  const candidates = semanticResults.filter((r) => !linkedIds.has(r.id));
  if (candidates.length === 0) return [];

  // 5. Build LLM prompt for reranking and type suggestion
  const candidateList = candidates
    .slice(0, 10) // limit context window
    .map(
      (c, i) =>
        `[${i}] id="${c.id}" title="${c.title}" similarity=${c.similarity.toFixed(3)}\ncontent: ${(c.content ?? "").slice(0, 300)}`,
    )
    .join("\n\n");

  const linkTypes = CONTEXT_LINK_TYPE_VALUES.join(", ");

  const prompt = `You are a knowledge graph assistant. Given a source entry and a list of candidate entries, pick the top 5 that would benefit most from a typed directed link FROM the source. For each pick, specify the link type and explain why.

Source entry:
title: "${entry.title}"
content: ${(entry.content ?? "").slice(0, 500)}

Candidates:
${candidateList}

Available link types: ${linkTypes}

Return a JSON array of up to 5 objects, each with:
- "index": number (candidate index from [N])
- "type": one of the link types above
- "reasoning": one sentence explaining why this connection is valuable
- "score": confidence 0.0 to 1.0

Return ONLY the JSON array, no other text.`;

  const chatResult = await llmService.chat(
    userId,
    {
      system:
        "You are a precise knowledge graph assistant. Return only valid JSON arrays.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1024,
      temperature: 0.2,
    },
    { purpose: "suggest_connections", tier: "cheap" },
  );

  // 6. Parse LLM response
  let suggestions: Array<{
    index: number;
    type: string;
    reasoning: string;
    score: number;
  }>;
  try {
    const parsed = JSON.parse(chatResult.content);
    suggestions = Array.isArray(parsed) ? parsed : [];
  } catch {
    // LLM returned non-JSON; return empty
    return [];
  }

  // 7. Map back to entry IDs
  const limitedCandidates = candidates.slice(0, 10);
  return suggestions
    .filter(
      (s) =>
        typeof s.index === "number" &&
        s.index >= 0 &&
        s.index < limitedCandidates.length,
    )
    .slice(0, 5)
    .map((s) => ({
      toEntryId: limitedCandidates[s.index].id,
      toEntryTitle: limitedCandidates[s.index].title,
      type: CONTEXT_LINK_TYPE_VALUES.includes(s.type as (typeof CONTEXT_LINK_TYPE_VALUES)[number])
        ? s.type
        : "REFERENCES",
      reasoning: s.reasoning ?? "",
      score: typeof s.score === "number" ? s.score : 0.5,
    }));
}

// ── Internal: detect_contradictions ───────────────────────────────

interface Contradiction {
  aId: string;
  aTitle: string;
  bId: string;
  bTitle: string;
  summary: string;
  severity: "minor" | "moderate" | "strong";
}

async function detectContradictions(
  userId: string,
  entryId?: string,
): Promise<Contradiction[]> {
  let entries: Array<{
    id: string;
    title: string;
    content: string | null;
    type: string;
  }>;

  if (entryId) {
    // Scoped: get neighbors of the entry
    const neighbors = await contextService.getNeighbors(userId, entryId, 2);
    const nodeIds = neighbors.nodes.map((n) => n.id);
    // Fetch content for these nodes
    const detailed = await Promise.all(
      nodeIds.map((id) => contextService.getById(userId, id)),
    );
    entries = detailed
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => ({
        id: e.id,
        title: e.title,
        content: e.content,
        type: e.type ?? "NOTE",
      }));
  } else {
    // Full graph scan: get all entries (cap at 200 for LLM context)
    const allEntries = await contextService.list(userId);
    entries = allEntries.slice(0, 200).map((e) => ({
      id: e.id,
      title: e.title,
      content: (e as { content?: string | null }).content ?? null,
      type: (e as { type?: string }).type ?? "NOTE",
    }));
  }

  if (entries.length < 2) return [];

  // Build compact representation for the LLM
  const entryList = entries
    .map(
      (e) =>
        `[${e.id}] "${e.title}" (${e.type}): ${(e.content ?? "").slice(0, 200)}`,
    )
    .join("\n");

  const prompt = `You are a knowledge graph analyst. Examine these context entries and identify content tensions or contradictions between pairs. A tension is when two entries contain conflicting information, incompatible approaches, outdated vs current advice, or contradicting principles.

Entries:
${entryList}

Return a JSON array of up to 10 tension objects, each with:
- "aId": id of first entry
- "bId": id of second entry
- "summary": one sentence describing the tension
- "severity": "minor", "moderate", or "strong"

If no tensions exist, return an empty array [].
Return ONLY the JSON array, no other text.`;

  const chatResult = await llmService.chat(
    userId,
    {
      system:
        "You are a precise knowledge graph analyst. Return only valid JSON arrays.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
      temperature: 0.3,
    },
    { purpose: "detect_contradictions", tier: "cheap" },
  );

  // Parse the response
  let tensions: Array<{
    aId: string;
    bId: string;
    summary: string;
    severity: string;
  }>;
  try {
    const parsed = JSON.parse(chatResult.content);
    tensions = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

  // Build a map of entry IDs to titles for the response
  const entryMap = new Map(entries.map((e) => [e.id, e.title]));

  return tensions
    .filter(
      (t) =>
        typeof t.aId === "string" &&
        typeof t.bId === "string" &&
        entryMap.has(t.aId) &&
        entryMap.has(t.bId),
    )
    .slice(0, 10)
    .map((t) => ({
      aId: t.aId,
      aTitle: entryMap.get(t.aId) ?? "",
      bId: t.bId,
      bTitle: entryMap.get(t.bId) ?? "",
      summary: t.summary ?? "",
      severity: (["minor", "moderate", "strong"].includes(t.severity)
        ? t.severity
        : "minor") as "minor" | "moderate" | "strong",
    }));
}

// ── Internal: summarize_subgraph ──────────────────────────────────

interface SubgraphSummary {
  summary: string;
  includedEntryIds: string[];
  wordCount: number;
}

async function summarizeSubgraph(
  userId: string,
  rootEntryId: string,
  depth: number,
): Promise<SubgraphSummary> {
  // 1. Get the neighborhood
  const neighborhood = await contextService.getNeighbors(
    userId,
    rootEntryId,
    depth,
  );

  // 2. Fetch content for each node
  const nodeDetails = await Promise.all(
    neighborhood.nodes.map((n) => contextService.getById(userId, n.id)),
  );

  const entries = nodeDetails.filter(
    (e): e is NonNullable<typeof e> => e !== null,
  );

  // 3. Format as compact JSON for the LLM
  const entryDescriptions = entries
    .map(
      (e) =>
        `- "${e.title}" (${e.type ?? "NOTE"}): ${(e.content ?? "").slice(0, 300)}`,
    )
    .join("\n");

  const edgeDescriptions = neighborhood.edges
    .map((e) => {
      const from = neighborhood.nodes.find((n) => n.id === e.fromId);
      const to = neighborhood.nodes.find((n) => n.id === e.toId);
      return `  ${from?.title ?? e.fromId} --[${e.type}]--> ${to?.title ?? e.toId}`;
    })
    .join("\n");

  const rootEntry = entries.find((e) => e.id === rootEntryId);
  const rootTitle = rootEntry?.title ?? rootEntryId;

  const prompt = `Summarize the following knowledge subgraph centered on "${rootTitle}" in a coherent narrative paragraph. The summary should help someone quickly understand what topics, decisions, and connections exist around this entry. Keep the summary under 200 words.

Entries:
${entryDescriptions}

Connections:
${edgeDescriptions || "(no connections)"}

Write a clear, concise summary paragraph.`;

  const chatResult = await llmService.chat(
    userId,
    {
      system:
        "You are a concise knowledge summarizer. Write clear, factual summaries. No preamble or meta-commentary.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 512,
      temperature: 0.3,
    },
    { purpose: "summarize_subgraph", tier: "cheap" },
  );

  const summary = chatResult.content.trim();
  const wordCount = summary.split(/\s+/).length;

  return {
    summary,
    includedEntryIds: entries.map((e) => e.id),
    wordCount,
  };
}
