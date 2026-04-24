"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { computeLayout, edgeColor, nodeColor } from "@ascend/graph";
import {
  CONTEXT_ENTRY_TYPE_VALUES,
  CONTEXT_LINK_TYPE_VALUES,
  type ContextEntryType,
  type ContextLinkType,
} from "@ascend/core";
import { useContextGraph } from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  ContextGraphNode,
  type ContextNodeData,
} from "@/components/context/context-graph-node";
import { cn } from "@/lib/utils";
import {
  Network,
  RefreshCw,
  X,
  FileText,
  BookOpen,
  Briefcase,
  User,
  CheckCircle,
  HelpCircle,
  Target,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  contextNode: ContextGraphNode,
};

/** Human-readable labels for edge types */
const LINK_TYPE_LABELS: Record<ContextLinkType, string> = {
  REFERENCES: "References",
  EXTENDS: "Extends",
  CONTRADICTS: "Contradicts",
  SUPPORTS: "Supports",
  EXAMPLE_OF: "Example of",
  DERIVED_FROM: "Derived from",
  SUPERSEDES: "Supersedes",
  APPLIES_TO: "Applies to",
  PART_OF: "Part of",
};

/** Human-readable labels for entry types */
const ENTRY_TYPE_LABELS: Record<ContextEntryType, string> = {
  NOTE: "Note",
  SOURCE: "Source",
  PROJECT: "Project",
  PERSON: "Person",
  DECISION: "Decision",
  QUESTION: "Question",
  AREA: "Area",
};

/** Icons for entry type filter chips */
const ENTRY_TYPE_ICONS: Record<ContextEntryType, typeof FileText> = {
  NOTE: FileText,
  SOURCE: BookOpen,
  PROJECT: Briefcase,
  PERSON: User,
  DECISION: CheckCircle,
  QUESTION: HelpCircle,
  AREA: Target,
};

// ── Component ──────────────────────────────────────────────────────

export function ContextGraphView() {
  // Filter chip state: which node types and edge types are visible
  const [visibleNodeTypes, setVisibleNodeTypes] = useState<Set<ContextEntryType>>(
    () => new Set(CONTEXT_ENTRY_TYPE_VALUES),
  );
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<ContextLinkType>>(
    () => new Set(CONTEXT_LINK_TYPE_VALUES),
  );

  // Focus mode: double-click a node to highlight its 2-hop neighborhood
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // Store access
  const contextFilters = useUIStore((s) => s.contextFilters);

  // Fetch the full graph
  const {
    data: graphData,
    isPending,
    isError,
    refetch,
  } = useContextGraph(
    contextFilters.tag
      ? { tag: contextFilters.tag, cap: 1000 }
      : undefined,
  );

  // ── Layout computation ─────────────────────────────────────────

  const layoutResult = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return null;

    // Filter nodes by visible types
    const filteredNodes = graphData.nodes.filter((n) =>
      visibleNodeTypes.has(n.type),
    );
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Filter edges: both endpoints visible AND edge type visible
    const filteredEdges = graphData.edges.filter(
      (e) =>
        filteredNodeIds.has(e.fromId) &&
        filteredNodeIds.has(e.toId) &&
        visibleEdgeTypes.has(e.type),
    );

    const positions = computeLayout({
      nodes: filteredNodes,
      edges: filteredEdges,
      options: { width: 1200, height: 800, iterations: 300 },
    });

    const positionMap = new Map(positions.map((p) => [p.id, p]));

    return { filteredNodes, filteredEdges, positionMap };
  }, [graphData, visibleNodeTypes, visibleEdgeTypes]);

  // ── Focus mode: 2-hop neighborhood ─────────────────────────────

  const focusNeighborhood = useMemo(() => {
    if (!focusNodeId || !layoutResult) return null;

    const { filteredEdges } = layoutResult;
    const neighbors = new Set<string>([focusNodeId]);

    // 1-hop
    for (const edge of filteredEdges) {
      if (edge.fromId === focusNodeId) neighbors.add(edge.toId);
      if (edge.toId === focusNodeId) neighbors.add(edge.fromId);
    }

    // 2-hop: expand from 1-hop neighbors
    const oneHop = new Set(neighbors);
    for (const edge of filteredEdges) {
      if (oneHop.has(edge.fromId)) neighbors.add(edge.toId);
      if (oneHop.has(edge.toId)) neighbors.add(edge.fromId);
    }

    return neighbors;
  }, [focusNodeId, layoutResult]);

  // ── Build ReactFlow nodes and edges ────────────────────────────

  const rfNodes: Node<ContextNodeData, "contextNode">[] = useMemo(() => {
    if (!layoutResult) return [];

    return layoutResult.filteredNodes.map((node) => {
      const pos = layoutResult.positionMap.get(node.id);
      const isFaded =
        focusNeighborhood !== null && !focusNeighborhood.has(node.id);

      return {
        id: node.id,
        type: "contextNode" as const,
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
        data: {
          title: node.title,
          type: node.type,
          isPinned: node.isPinned,
          outgoingCount: node.outgoingCount,
          incomingCount: node.incomingCount,
        },
        style: isFaded ? { opacity: 0.15, pointerEvents: "none" as const } : undefined,
      };
    });
  }, [layoutResult, focusNeighborhood]);

  const rfEdges: Edge[] = useMemo(() => {
    if (!layoutResult) return [];

    return layoutResult.filteredEdges.map((edge) => {
      const isFaded =
        focusNeighborhood !== null &&
        (!focusNeighborhood.has(edge.fromId) ||
          !focusNeighborhood.has(edge.toId));

      return {
        id: edge.id,
        source: edge.fromId,
        target: edge.toId,
        style: {
          stroke: edgeColor(edge.type),
          strokeWidth: 2,
          opacity: isFaded ? 0.1 : 0.7,
        },
        animated: edge.type === "CONTRADICTS",
        label: LINK_TYPE_LABELS[edge.type],
        labelStyle: { fontSize: 10, fill: "#888" },
        labelShowBg: false,
      };
    });
  }, [layoutResult, focusNeighborhood]);

  // ── Event handlers ─────────────────────────────────────────────

  const handleNodeClick: NodeMouseHandler<Node<ContextNodeData>> = useCallback(
    (_event, node) => {
      // Open the detail panel for this entry
      // The context page reads selectedEntryId from local state,
      // so we use a custom event approach. But to keep it simple and
      // compatible with the existing page pattern, we'll emit a custom
      // DOM event that the parent page listens for, or better: accept
      // an onNodeSelect callback.
      // For now, let's use window custom event. The parent page will
      // bind to it.
      window.dispatchEvent(
        new CustomEvent("ascend:context-node-select", {
          detail: { id: node.id },
        }),
      );
    },
    [],
  );

  const handleNodeDoubleClick: NodeMouseHandler<Node<ContextNodeData>> = useCallback(
    (_event, node) => {
      setFocusNodeId((prev) => (prev === node.id ? null : node.id));
    },
    [],
  );

  const handlePaneClick = useCallback(() => {
    // Exit focus mode when clicking empty area
    if (focusNodeId) {
      setFocusNodeId(null);
    }
  }, [focusNodeId]);

  // ── Filter chip toggles ────────────────────────────────────────

  function toggleNodeType(type: ContextEntryType) {
    setVisibleNodeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow hiding ALL types
        if (next.size <= 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleEdgeType(type: ContextLinkType) {
    setVisibleEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  // ── Keyboard: Escape exits focus mode ──────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && focusNodeId) {
        e.preventDefault();
        setFocusNodeId(null);
      }
    },
    [focusNodeId],
  );

  // ── Render states ──────────────────────────────────────────────

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-muted-foreground">
          Failed to load the knowledge graph.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No connected context yet"
        description="Link entries with [[Title]] wikilinks or add manual links from the detail panel to build your knowledge graph."
      />
    );
  }

  return (
    <div
      className="flex flex-1 flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Filter chip bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
        {/* Node type chips */}
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Types
        </span>
        {CONTEXT_ENTRY_TYPE_VALUES.map((type) => {
          const Icon = ENTRY_TYPE_ICONS[type];
          const isOn = visibleNodeTypes.has(type);
          return (
            <Badge
              key={type}
              variant={isOn ? "default" : "outline"}
              className={cn(
                "cursor-pointer select-none gap-1 text-[11px] transition-opacity",
                !isOn && "opacity-50",
              )}
              style={
                isOn
                  ? { backgroundColor: nodeColor(type), color: "#fff" }
                  : undefined
              }
              onClick={() => toggleNodeType(type)}
              role="switch"
              aria-checked={isOn}
              aria-label={`Show ${ENTRY_TYPE_LABELS[type]} nodes`}
            >
              <Icon className="size-3" aria-hidden="true" />
              {ENTRY_TYPE_LABELS[type]}
            </Badge>
          );
        })}

        {/* Separator */}
        <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        {/* Edge type chips */}
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Links
        </span>
        {CONTEXT_LINK_TYPE_VALUES.map((type) => {
          const isOn = visibleEdgeTypes.has(type);
          return (
            <Badge
              key={type}
              variant={isOn ? "default" : "outline"}
              className={cn(
                "cursor-pointer select-none text-[11px] transition-opacity",
                !isOn && "opacity-50",
              )}
              style={
                isOn
                  ? { backgroundColor: edgeColor(type), color: "#fff" }
                  : undefined
              }
              onClick={() => toggleEdgeType(type)}
              role="switch"
              aria-checked={isOn}
              aria-label={`Show ${LINK_TYPE_LABELS[type]} edges`}
            >
              {LINK_TYPE_LABELS[type]}
            </Badge>
          );
        })}

        {/* Focus mode indicator */}
        {focusNodeId && (
          <>
            <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 text-[11px]"
              onClick={() => setFocusNodeId(null)}
              aria-label="Exit focus mode"
            >
              Focus mode
              <X className="size-3" aria-hidden="true" />
            </Badge>
          </>
        )}
      </div>

      {/* ReactFlow canvas */}
      <div className="flex-1" style={{ minHeight: 400 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as ContextNodeData | undefined;
              return data?.type ? nodeColor(data.type) : "#6b7280";
            }}
            maskColor="rgba(0,0,0,0.1)"
            pannable
          />
        </ReactFlow>
      </div>
    </div>
  );
}
