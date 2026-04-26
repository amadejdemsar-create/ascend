/**
 * Context Map synthesis prompt builder.
 *
 * Builds the system + user messages for the LLM call that produces a
 * Context Map from the user's full context graph. Handles content
 * truncation (500 chars per entry) and compact serialization to stay
 * within context window limits.
 *
 * The output JSON Schema is provided inline so providers that support
 * structured output (all three do) can constrain generation.
 */

// ── Graph node/edge shapes (from contextService.getGraph) ────────
//
// Uses plain string types for type and linkType rather than importing
// generated Prisma enums. The prompt builder only serializes these
// values to JSON; it does not need the enum's type narrowing.

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  isPinned: boolean;
  outgoingCount: number;
  incomingCount: number;
  content?: string;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
}

// ── Content excerpt limit ────────────────────────────────────────

const CONTENT_EXCERPT_LENGTH = 500;

// ── Output JSON Schema (matches contextMapContentSchema) ─────────

/**
 * Raw JSON Schema for the Context Map output format. Provided to the
 * LLM via ChatInput.jsonSchema so providers use structured output.
 *
 * Matches the Zod contextMapContentSchema from @ascend/core exactly.
 */
export const CONTEXT_MAP_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "A 2-3 sentence overview of the user's knowledge base and primary focus areas.",
    },
    themes: {
      type: "array",
      description:
        "Recurring themes or topic clusters that appear across multiple entries.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          entryIds: {
            type: "array",
            items: { type: "string" },
            description: "IDs of source entries that contribute to this theme.",
          },
        },
        required: ["title", "entryIds"],
      },
    },
    principles: {
      type: "array",
      description:
        "Guiding principles, values, or mental models the user repeatedly references.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          entryIds: { type: "array", items: { type: "string" } },
        },
        required: ["title", "entryIds"],
      },
    },
    projects: {
      type: "array",
      description:
        "Active projects, initiatives, or ongoing efforts visible in the graph.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          entryIds: { type: "array", items: { type: "string" } },
        },
        required: ["title", "entryIds"],
      },
    },
    tensions: {
      type: "array",
      description:
        "Unresolved tensions, contradictions, or open questions across entries.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          entryIds: { type: "array", items: { type: "string" } },
        },
        required: ["title", "entryIds"],
      },
    },
    orphans: {
      type: "array",
      description:
        "Entries with no connections (degree 0) that might benefit from linking.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          entryIds: { type: "array", items: { type: "string" } },
        },
        required: ["title", "entryIds"],
      },
    },
  },
  required: ["themes", "principles", "projects", "tensions", "orphans"],
} as const;

// ── System prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a thoughtful synthesizer reading a user's personal context graph. The graph consists of entries (nodes) and typed edges (links) that together form the user's knowledge base.

Your task is to extract:
1. **Themes**: Recurring topics or clusters that appear across multiple entries.
2. **Principles**: Guiding principles, values, or mental models the user repeatedly references.
3. **Projects**: Active projects, initiatives, or ongoing efforts visible in the graph.
4. **Tensions**: Unresolved tensions, contradictions, or open questions across entries.
5. **Orphans**: Entries with zero connections that might benefit from being linked to other entries.

Also provide a brief summary (2-3 sentences) of the user's knowledge base overall.

Rules:
- Every item MUST reference source entry IDs from the input. Use the exact IDs provided.
- Be specific and grounded. Do not invent themes that are not evidenced by the entries.
- Prefer fewer, higher-quality items over many shallow ones.
- For orphans, only include entries that genuinely have degree 0 (no edges at all).
- Return STRICT JSON matching the provided schema. No markdown, no commentary outside the JSON.`;

// ── Chunked synthesis system prompts ─────────────────────────────

const CHUNK_PASS1_SYSTEM = `You are analyzing a subset of a user's personal context graph (the first batch of entries). Extract themes, principles, and a brief summary from this batch. Return STRICT JSON matching the provided schema. Be specific and reference entry IDs.`;

const CHUNK_PASS2_SYSTEM = `You are analyzing the full set of edges and remaining entries in a user's context graph. You have prior context from a first-pass analysis (provided below). Now identify projects, tensions, and any additional themes or principles missed in the first pass. Return STRICT JSON matching the provided schema. Reference entry IDs.`;

// ── Serialization helpers ────────────────────────────────────────

interface CompactEntry {
  id: string;
  title: string;
  type: string;
  content: string;
}

interface CompactEdge {
  from: string;
  to: string;
  type: string;
}

function truncateContent(content: string | undefined | null): string {
  if (!content) return "";
  if (content.length <= CONTENT_EXCERPT_LENGTH) return content;
  return content.slice(0, CONTENT_EXCERPT_LENGTH) + "...";
}

function serializeEntries(nodes: GraphNode[]): CompactEntry[] {
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    type: n.type,
    content: truncateContent(n.content),
  }));
}

function serializeEdges(edges: GraphEdge[]): CompactEdge[] {
  return edges.map((e) => ({
    from: e.fromId,
    to: e.toId,
    type: e.type,
  }));
}

// ── Single-pass prompt builder ───────────────────────────────────

/**
 * Build the messages for a single-pass Context Map synthesis.
 * Used when the graph has 200 or fewer nodes.
 */
export function buildSinglePassMessages(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { system: string; userMessage: string } {
  const graphData = {
    entries: serializeEntries(nodes),
    edges: serializeEdges(edges),
  };

  return {
    system: SYSTEM_PROMPT,
    userMessage: `Here is my context graph:\n\n${JSON.stringify(graphData)}`,
  };
}

// ── Chunked prompt builders ──────────────────────────────────────

/**
 * Build Pass 1 messages: themes + principles from the first ~100 nodes.
 */
export function buildChunkPass1Messages(
  firstBatchNodes: GraphNode[],
  firstBatchEdges: GraphEdge[],
): { system: string; userMessage: string } {
  const graphData = {
    entries: serializeEntries(firstBatchNodes),
    edges: serializeEdges(firstBatchEdges),
  };

  return {
    system: CHUNK_PASS1_SYSTEM,
    userMessage: `Here is the first batch of my context graph (${firstBatchNodes.length} entries):\n\n${JSON.stringify(graphData)}`,
  };
}

/**
 * Build Pass 2 messages: projects + tensions from all entries,
 * with the Pass 1 output as additional context.
 */
export function buildChunkPass2Messages(
  allNodes: GraphNode[],
  allEdges: GraphEdge[],
  pass1Output: string,
): { system: string; userMessage: string } {
  const graphData = {
    entries: serializeEntries(allNodes),
    edges: serializeEdges(allEdges),
  };

  return {
    system: CHUNK_PASS2_SYSTEM,
    userMessage: `Previous analysis from the first batch:\n${pass1Output}\n\nHere is the full context graph (${allNodes.length} entries):\n\n${JSON.stringify(graphData)}`,
  };
}

/**
 * Identify orphan nodes (degree 0) from the graph.
 * Returns compact entries for orphan nodes.
 */
export function identifyOrphans(nodes: GraphNode[]): CompactEntry[] {
  return nodes
    .filter((n) => n.outgoingCount === 0 && n.incomingCount === 0)
    .map((n) => ({
      id: n.id,
      title: n.title,
      type: n.type,
      content: truncateContent(n.content),
    }));
}
