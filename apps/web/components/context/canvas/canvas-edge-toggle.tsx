"use client";

import { Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  showEdges: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * Wave 9 Phase 6: toolbar pill that flips viewport.showEdges. When
 * off, the canvas view sets opacity=0 + locked=true on every
 * customData.kind="edge" arrow so connections are visually hidden
 * but the underlying ContextLinks are preserved.
 */
export function CanvasEdgeToggle({ showEdges, onToggle, disabled }: Props) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={showEdges}
      title={showEdges ? "Hide connections" : "Show connections"}
      className="gap-1.5"
    >
      {showEdges ? (
        <Link2 className="size-3.5" aria-hidden="true" />
      ) : (
        <Link2Off className="size-3.5" aria-hidden="true" />
      )}
      <span className="text-xs">{showEdges ? "Edges on" : "Edges off"}</span>
    </Button>
  );
}
