"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

/**
 * PdfPreview: sandboxed inline PDF viewer for FileNode blocks.
 *
 * Fetches a presigned download URL on mount and renders the PDF inside
 * a sandboxed iframe. The sandbox attribute is set to "allow-same-origin"
 * only (no scripts, no popups, no forms) to minimize XSS surface.
 *
 * On error or while loading, shows a fallback with a download button.
 */

interface PdfPreviewProps {
  fileId: string;
}

export function PdfPreview({ fileId }: PdfPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchUrl() {
      try {
        const result = await apiFetch<{ url: string; expiresAt: string }>(
          `/api/files/${fileId}`,
        );
        if (!cancelled) {
          setUrl(result.url);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load PDF",
          );
          setIsLoading(false);
        }
      }
    }

    fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const handleDownload = useCallback(async () => {
    try {
      const result = await apiFetch<{ url: string; expiresAt: string }>(
        `/api/files/${fileId}`,
      );
      window.open(result.url, "_blank");
    } catch {
      // Fallback: no-op, error already visible
    }
  }, [fileId]);

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border bg-muted/30">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-2 text-sm text-muted-foreground">Loading PDF...</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6">
        <AlertCircle className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {error ?? "Could not load PDF preview"}
        </p>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1.5 size-3.5" aria-hidden="true" />
          Download PDF
        </Button>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      sandbox="allow-same-origin"
      title="PDF preview"
      className="w-full h-[600px] rounded-lg border"
    />
  );
}
