/**
 * @ascend/graph
 *
 * Platform-agnostic graph layout and coloring for the Ascend knowledge graph.
 * No React, no DOM, no browser globals. Works in Node, browser, and React Native.
 */

export { computeLayout } from "./layout";
export { nodeColor, edgeColor } from "./colors";
export type {
  GraphNode,
  GraphEdge,
  LayoutOptions,
  PositionedNode,
} from "./types";
