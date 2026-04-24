/**
 * Color helpers for the Ascend knowledge graph.
 *
 * Maps context entry types and link types to hex color strings that are
 * directly consumable by d3, ReactFlow, and react-native-skia (all accept
 * hex). The palette is chosen for high contrast on a dark canvas (the
 * default graph view background) and harmonizes with the @ascend/ui-tokens
 * primary/secondary/accent palette.
 *
 * If @ascend/ui-tokens gains a graph-specific palette export later,
 * replace these constants with imports from there.
 *
 * Both functions use exhaustive switches so TypeScript errors if a new
 * enum value is added without updating the color map.
 */

import type { ContextEntryType, ContextLinkType } from "@ascend/core";

/**
 * Returns a hex color string for a context entry type.
 * Used for node fills/borders in the graph view.
 */
export function nodeColor(type: ContextEntryType): string {
  switch (type) {
    case "NOTE":
      return "#60a5fa"; // blue-400
    case "SOURCE":
      return "#fbbf24"; // amber-400
    case "PROJECT":
      return "#a78bfa"; // violet-400
    case "PERSON":
      return "#f472b6"; // pink-400
    case "DECISION":
      return "#fb923c"; // orange-400
    case "QUESTION":
      return "#22d3ee"; // cyan-400
    case "AREA":
      return "#4ade80"; // green-400
  }
}

/**
 * Returns a hex color string for a context link type.
 * Used for edge strokes in the graph view.
 */
export function edgeColor(type: ContextLinkType): string {
  switch (type) {
    case "REFERENCES":
      return "#6b7280"; // gray-500, neutral default
    case "EXTENDS":
      return "#3b82f6"; // blue-500
    case "CONTRADICTS":
      return "#ef4444"; // red-500
    case "SUPPORTS":
      return "#22c55e"; // green-500
    case "EXAMPLE_OF":
      return "#8b5cf6"; // violet-500
    case "DERIVED_FROM":
      return "#a855f7"; // purple-500
    case "SUPERSEDES":
      return "#f59e0b"; // amber-500
    case "APPLIES_TO":
      return "#14b8a6"; // teal-500
    case "PART_OF":
      return "#ec4899"; // pink-500
  }
}
