/**
 * Force-directed graph layout using d3-force.
 *
 * Platform-agnostic: pure TypeScript, no DOM, no React, no browser globals.
 * Runs in Node, browser, and React Native. Consumes GraphNode/GraphEdge
 * and produces PositionedNode[] with final (x, y) coordinates.
 */

import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { GraphNode, GraphEdge, LayoutOptions, PositionedNode } from "./types";

/** Internal node type that d3-force mutates in-place. */
type SimNode = SimulationNodeDatum & { id: string };

/** Internal link type referencing SimNode IDs. */
type SimLink = SimulationLinkDatum<SimNode>;

/**
 * Compute a force-directed layout for a set of nodes and edges.
 *
 * Runs the d3-force simulation synchronously to steady state (default 300
 * iterations) and returns final positions. For interactive use (e.g., user
 * dragging nodes), call this once for the initial layout and then let the
 * renderer handle incremental updates.
 *
 * @param params.nodes - Graph nodes. At least `id` is required; `title` and
 *   `type` are passed through but not used by the layout engine.
 * @param params.edges - Graph edges connecting nodes by `fromId` / `toId`.
 * @param params.options - Layout tuning parameters.
 * @returns Array of `{ id, x, y }` in the same order as the input nodes.
 */
export function computeLayout(params: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  options?: LayoutOptions;
}): PositionedNode[] {
  const { nodes, edges, options = {} } = params;

  if (nodes.length === 0) return [];

  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const linkDistance = options.linkDistance ?? 100;
  const chargeStrength = options.chargeStrength ?? -200;
  const iterations = options.iterations ?? 300;

  // Build a set of valid node IDs for filtering edges that reference
  // missing nodes (defensive against stale data).
  const nodeIdSet = new Set(nodes.map((n) => n.id));

  // Clone nodes for d3-force (it mutates in-place) and seed positions
  // if provided via options.
  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    x: options.initialPositions?.[n.id]?.x,
    y: options.initialPositions?.[n.id]?.y,
  }));

  // d3-force expects link endpoints to reference node IDs. Filter out
  // edges that reference nodes not in the current set.
  const simEdges: SimLink[] = edges
    .filter((e) => nodeIdSet.has(e.fromId) && nodeIdSet.has(e.toId))
    .map((e) => ({
      source: e.fromId,
      target: e.toId,
    }));

  const simulation = forceSimulation(simNodes)
    .force("charge", forceManyBody().strength(chargeStrength))
    .force(
      "link",
      forceLink<SimNode, SimLink>(simEdges)
        .id((d) => d.id)
        .distance(linkDistance),
    )
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide(30))
    .stop();

  // Run simulation to steady state.
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  return simNodes.map((n) => ({
    id: n.id,
    x: n.x ?? width / 2,
    y: n.y ?? height / 2,
  }));
}
