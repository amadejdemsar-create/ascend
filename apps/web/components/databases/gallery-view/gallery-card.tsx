"use client";

import { ImageIcon } from "lucide-react";
import type { DatabaseField } from "@ascend/core";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";
import { PropertyCell } from "@/components/databases/property-editors";
import { useOpenGraphImage } from "@/lib/hooks/use-og";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

export interface GalleryCardProps {
  row: {
    id: string;
    entryId: string;
    properties: Record<string, unknown>;
  };
  primaryFieldId: string;
  primaryFieldName: string;
  coverField: DatabaseFieldResponse | null;
  visibleProperties: Array<{ field: DatabaseFieldResponse; value: unknown }>;
  onOpen: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * A single card in the Gallery view representing one database row.
 *
 * Renders an optional cover area (FILE or URL type) at 4:3 aspect ratio,
 * followed by the primary field as bold title and visible property values
 * rendered via PropertyCell in read-only cell mode.
 */
export function GalleryCard({
  row,
  primaryFieldId,
  primaryFieldName,
  coverField,
  visibleProperties,
  onOpen,
}: GalleryCardProps) {
  const primaryValue = row.properties[primaryFieldId];
  const displayTitle =
    typeof primaryValue === "string" && primaryValue.trim()
      ? primaryValue
      : "Untitled";

  // Resolve cover content.
  const coverContent = resolveCover(row, coverField);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background overflow-hidden",
        "hover:shadow-md transition-shadow cursor-pointer",
      )}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${primaryFieldName}: ${displayTitle}`}
    >
      {/* Cover area: fixed 4:3 aspect ratio */}
      <div className="relative aspect-[4/3] w-full bg-muted border-b border-border/50 flex items-center justify-center">
        {coverContent}
      </div>

      {/* Body */}
      <div className="p-3">
        {/* Primary field as title */}
        <p className="text-sm font-medium text-foreground truncate mb-1.5">
          {displayTitle}
        </p>

        {/* Visible properties (read-only, cell mode) */}
        {visibleProperties.length > 0 && (
          <div className="flex flex-col gap-1">
            {visibleProperties.map(({ field, value }) => (
              <div
                key={field.id}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <span className="shrink-0 truncate max-w-[60px]">
                  {field.name}:
                </span>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <PropertyCell
                    field={field as unknown as DatabaseField}
                    value={value}
                    onChange={() => {}}
                    mode="cell"
                    disabled
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cover resolution helper ───────────────────────────────────────────────

function resolveCover(
  row: { properties: Record<string, unknown> },
  coverField: DatabaseFieldResponse | null,
): React.ReactNode {
  if (!coverField) {
    return <PlaceholderCover />;
  }

  if (coverField.type === "FILE") {
    // FILE value is an array of file IDs. Use the first one.
    const fileIds = row.properties[coverField.id];
    const firstFileId =
      Array.isArray(fileIds) && fileIds.length > 0 ? fileIds[0] : null;

    if (!firstFileId || typeof firstFileId !== "string") {
      return <PlaceholderCover />;
    }

    // Use /api/files/[id] route which returns a presigned URL via 302 redirect.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/${firstFileId}`}
        alt=""
        className="absolute inset-0 w-full h-full object-contain p-2"
        loading="lazy"
      />
    );
  }

  if (coverField.type === "URL") {
    const urlValue = row.properties[coverField.id];
    if (!urlValue || typeof urlValue !== "string") {
      return <PlaceholderCover />;
    }

    return <UrlCover url={urlValue} />;
  }

  // Unsupported cover field type: fall back to placeholder.
  return <PlaceholderCover />;
}

function PlaceholderCover() {
  return (
    <ImageIcon
      className="size-8 text-muted-foreground/30"
      aria-hidden="true"
    />
  );
}

/**
 * URL cover with OpenGraph image fetching.
 *
 * Uses the /api/og endpoint to extract the og:image meta tag from the URL.
 * Falls back to a text display of the URL if no OG image is found or while
 * loading.
 */
function UrlCover({ url }: { url: string }) {
  const { ogImage, isLoading } = useOpenGraphImage(url);

  if (ogImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ogImage}
        alt=""
        className="absolute inset-0 w-full h-full object-contain p-2"
        loading="lazy"
      />
    );
  }

  // Loading or no OG image: show URL as text fallback.
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-3 text-center">
      {isLoading ? (
        <div className="size-6 rounded bg-muted-foreground/10 animate-pulse" />
      ) : (
        <ImageIcon
          className="size-6 text-muted-foreground/40"
          aria-hidden="true"
        />
      )}
      <span className="text-xs text-muted-foreground truncate max-w-full">
        {url}
      </span>
    </div>
  );
}
