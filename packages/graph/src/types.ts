/**
 * Platform-agnostic graph types for the Ascend knowledge graph.
 *
 * These types are consumed by the layout engine (d3-force) and by
 * renderers (ReactFlow on web, react-native-skia on mobile). They
 * intentionally carry no renderer-specific fields.
 */

import type { ContextEntryType, ContextLinkType } from "@ascend/core";

export interface GraphNode {
  id: string;
  title: string;
  type: ContextEntryType;
  isPinned?: boolean;
  outgoingCount?: number;
  incomingCount?: number;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  type: ContextLinkType;
}

export interface LayoutOptions {
  /** Approximate width of the canvas, used to set the force center. Default 800. */
  width?: number;
  /** Approximate height of the canvas. Default 600. */
  height?: number;
  /** Target link distance in pixels. Default 100. */
  linkDistance?: number;
  /** Charge strength (node repulsion). More negative = more spread. Default -200. */
  chargeStrength?: number;
  /** Number of simulation ticks to run before returning final positions. Default 300. */
  iterations?: number;
  /** Optional deterministic seed via setting initial positions. If omitted, d3-force uses random initial positions. */
  initialPositions?: Record<string, { x: number; y: number }>;
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
}
