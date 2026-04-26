"use client";

import { Component, type ReactNode } from "react";
import { marked } from "marked";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * DZ-7 mitigation: error boundary that wraps the Lexical block editor.
 *
 * If the editor throws during render (corrupt Yjs state, Lexical bug,
 * etc.), this boundary catches the error and falls back to a read-only
 * markdown render of the entry's `content` field. The user can then
 * reload or contact support without losing their data.
 *
 * The fallback also provides a "Reload editor" button that clears the
 * error state and attempts to re-mount the editor.
 *
 * NOTE: A "/blocks/reset" admin route is deferred. For now, a broken
 * block document requires manual DB intervention.
 */

interface Props {
  entryId: string;
  fallbackContent?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ContextBlockEditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      "[ContextBlockEditor] Error boundary caught:",
      error,
      errorInfo,
    );
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const html = this.props.fallbackContent
        ? (marked.parse(this.props.fallbackContent, { async: false }) as string)
        : "";

      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-medium text-destructive">
                The block editor encountered an error.
              </p>
              <p className="mt-1 text-muted-foreground">
                Showing the original markdown content as a read-only fallback.
                {this.state.error?.message && (
                  <span className="block mt-1 font-mono text-xs">
                    {this.state.error.message}
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReload}
              aria-label="Reload block editor"
            >
              Reload editor
            </Button>
          </div>
          {html ? (
            <div
              className="context-prose rounded-md border p-4"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No content available for fallback display.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
