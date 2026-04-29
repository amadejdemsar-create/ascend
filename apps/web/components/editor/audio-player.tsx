"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { useFileStatus } from "@/lib/hooks/use-files";

/**
 * AudioPlayer: native <audio> element with transcript toggle.
 *
 * Fetches the presigned URL on mount and renders a standard audio player.
 * Below the player, a "Show transcript" toggle expands a panel with the
 * extracted text from the File row (populated by the extraction pipeline).
 *
 * v1 limitation: timestamps are not linked (Whisper timestamps require
 * storing verbose JSON, not just flat text). Plain transcript only.
 */

interface AudioPlayerProps {
  fileId: string;
}

export function AudioPlayer({ fileId }: AudioPlayerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const { data: fileStatus } = useFileStatus(fileId);

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
            err instanceof Error ? err.message : "Failed to load audio",
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

  const toggleTranscript = useCallback(() => {
    setShowTranscript((prev) => !prev);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border bg-muted/30">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-2 text-sm text-muted-foreground">Loading audio...</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4">
        <AlertCircle className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">
          {error ?? "Could not load audio"}
        </span>
      </div>
    );
  }

  const hasTranscript =
    fileStatus?.extractionStatus === "COMPLETE" && fileStatus.extractedText;
  const isExtracting =
    fileStatus?.extractionStatus === "PENDING" ||
    fileStatus?.extractionStatus === "EXTRACTING";

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls preload="metadata" src={url} className="w-full" />

      {(hasTranscript || isExtracting) && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={toggleTranscript}
            aria-expanded={showTranscript}
          >
            {showTranscript ? (
              <ChevronUp className="size-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3" aria-hidden="true" />
            )}
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </Button>

          {showTranscript && (
            <div className="mt-1 max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {isExtracting && !hasTranscript && (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Transcribing...</span>
                </div>
              )}
              {hasTranscript && fileStatus.extractedText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
