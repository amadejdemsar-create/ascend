import { Loader2 } from "lucide-react";

/**
 * Wave 9: Loading state for the canvas view while the Excalidraw
 * bundle dynamic-imports and the layout fetch resolves.
 */
export function CanvasLoadingSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/20">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading canvas...</span>
      </div>
    </div>
  );
}
