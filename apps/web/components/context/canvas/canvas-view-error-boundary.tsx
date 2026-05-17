"use client";

import { Component, type ReactNode, useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * DZ-7 mitigation: error boundary that wraps the Excalidraw canvas mount.
 *
 * If Excalidraw or any descendant throws during render (React error #185
 * infinite loop, corrupt scene blob, stale element refs, etc.), this
 * boundary catches the error and:
 *
 *   1. Logs the error to console for debugging.
 *   2. Auto-resets `contextActiveView` to "list" so the user is not
 *      locked out of /context on subsequent visits (the persisted
 *      Zustand store would otherwise keep returning them to the broken
 *      canvas view).
 *   3. Shows a fallback card with a "Back to list" button.
 *
 * The auto-reset fires on the first render of the fallback via useEffect
 * inside the functional CanvasViewFallback component. On the next
 * navigation or refresh the user lands on the List view.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CanvasViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      "[CanvasView] Error boundary caught:",
      error,
      errorInfo,
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <CanvasViewFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

/**
 * Functional fallback component so we can call useEffect + useUIStore
 * to auto-reset the persisted view back to "list".
 */
function CanvasViewFallback({ error }: { error: Error | null }) {
  const setContextActiveView = useUIStore((s) => s.setContextActiveView);

  // Auto-reset the persisted view on mount so a page refresh does not
  // return the user to the broken canvas.
  useEffect(() => {
    setContextActiveView("list");
  }, [setContextActiveView]);

  return (
    <div
      className="flex h-full w-full items-center justify-center p-6"
      role="alert"
    >
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangleIcon
            className="size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="font-medium text-destructive">
              The canvas didn&apos;t load.
            </p>
            <p className="mt-1 text-muted-foreground">
              Switching you back to the list view.
            </p>
            {error?.message && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {error.message}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setContextActiveView("list")}
          aria-label="Switch to list view"
        >
          Back to list
        </Button>
      </div>
    </div>
  );
}
