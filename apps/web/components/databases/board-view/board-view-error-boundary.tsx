"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * DZ-7 mitigation: error boundary that wraps the database board view.
 *
 * If the board throws during render (stale data shape, drag crash, etc.),
 * this boundary catches the error and shows a reload fallback instead of
 * crashing the entire page.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class BoardViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[BoardView] Error boundary caught:", error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm max-w-md">
            <AlertTriangleIcon
              className="size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="font-medium text-destructive">
                Something went wrong rendering the board.
              </p>
              {this.state.error?.message && (
                <p className="mt-1 text-muted-foreground font-mono text-xs">
                  {this.state.error.message}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReload}
            className="gap-2"
          >
            <RefreshCwIcon className="size-4" aria-hidden="true" />
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
