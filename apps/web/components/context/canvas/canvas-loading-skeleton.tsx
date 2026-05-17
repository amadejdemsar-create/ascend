import { Loader2 } from "lucide-react";

/**
 * Wave 9: Loading state for the canvas view while the Excalidraw
 * bundle dynamic-imports and the layout fetch resolves.
 *
 * The faint dot-grid background mimics Excalidraw's empty-canvas grid
 * so the transition into the mounted canvas has no visual "pop." The
 * loading pill is intentionally small and bottom-corner anchored rather
 * than dead-center so it doesn't dominate the viewport while loading.
 */
export function CanvasLoadingSkeleton() {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-muted/20"
      role="status"
      aria-label="Loading canvas"
    >
      {/* Dot-grid placeholder matching Excalidraw's faint grid. The
          radial-gradient draws a 1px dot every 24px; the gradient
          color tracks the foreground via currentColor so it adapts
          to light + dark themes without an inline style override. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 text-muted-foreground/15"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        <span>Loading canvas...</span>
      </div>
    </div>
  );
}
