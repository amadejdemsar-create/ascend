"use client";

import { useCallback } from "react";
import {
  FileText,
  Image,
  Music,
  Video,
  Sheet,
  File as FileIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFileStatus, useReExtract } from "@/lib/hooks/use-files";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pick a lucide icon based on MIME type prefix.
 */
function mimeIcon(mimeType: string | undefined) {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.startsWith("video/")) return Video;
  if (
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    mimeType === "application/json"
  ) {
    return FileText;
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel")
  ) {
    return Sheet;
  }
  return FileIcon;
}

/**
 * Humanize bytes to a short string (e.g., "2.4 MB", "512 KB").
 */
function humanizeBytes(bytes: number | undefined): string {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${unitIndex === 0 ? value : value.toFixed(1)} ${units[unitIndex]}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FileCardProps {
  fileId: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  className?: string;
}

/**
 * Compact file card showing file metadata and extraction status.
 *
 * Auto-polls extraction status while PENDING or EXTRACTING. Shows a
 * retry button on FAILED with the error message in a tooltip.
 *
 * Clicking the card triggers a file download via a presigned URL.
 */
export function FileCard({
  fileId,
  filename,
  mimeType,
  sizeBytes,
  className,
}: FileCardProps) {
  const { data: status } = useFileStatus(fileId);
  const reExtract = useReExtract();

  const Icon = mimeIcon(mimeType);
  const displayName = filename ?? "Untitled file";

  const handleClick = useCallback(async () => {
    try {
      const result = await apiFetch<{ url: string; expiresAt: string }>(
        `/api/files/${fileId}`,
      );
      window.open(result.url, "_blank");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to get download link",
      );
    }
  }, [fileId]);

  const handleRetry = useCallback(
    (e: React.MouseEvent) => {
      // Prevent the card click from firing
      e.stopPropagation();
      reExtract.mutate(
        { fileId },
        {
          onSuccess: () => toast.success("Re-extraction queued"),
          onError: (err) =>
            toast.error(
              err instanceof Error ? err.message : "Failed to re-extract",
            ),
        },
      );
    },
    [fileId, reExtract],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={`Download ${displayName}`}
    >
      {/* File type icon */}
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />

      {/* Name + metadata */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{displayName}</span>
        <span className="text-xs text-muted-foreground">
          {humanizeBytes(sizeBytes)}
        </span>
      </div>

      {/* Extraction status badge */}
      <ExtractionBadge
        extractionStatus={status?.extractionStatus}
        extractionError={status?.extractionError ?? null}
        onRetry={handleRetry}
        isRetrying={reExtract.isPending}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Extraction badge (internal)
// ---------------------------------------------------------------------------

function ExtractionBadge({
  extractionStatus,
  extractionError,
  onRetry,
  isRetrying,
}: {
  extractionStatus: string | undefined;
  extractionError: string | null;
  onRetry: (e: React.MouseEvent) => void;
  isRetrying: boolean;
}) {
  if (!extractionStatus || extractionStatus === "PENDING" || extractionStatus === "EXTRACTING") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Processing...
      </span>
    );
  }

  if (extractionStatus === "COMPLETE") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Ready
      </span>
    );
  }

  if (extractionStatus === "FAILED") {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="flex items-center gap-1 text-xs text-destructive cursor-default" />
              }
            >
              <AlertCircle className="size-3.5" aria-hidden="true" />
              Failed
            </TooltipTrigger>
            <TooltipContent side="top">
              {extractionError || "Extraction failed"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={onRetry}
          disabled={isRetrying}
          aria-label="Retry extraction"
        >
          {isRetrying ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            "Retry"
          )}
        </Button>
      </span>
    );
  }

  return null;
}
