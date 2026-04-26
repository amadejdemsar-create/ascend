"use client";

import { useCallback } from "react";
import { LinkIcon } from "lucide-react";

/**
 * WikiLinkPill: inline decorator renderer for WikiLinkNode.
 *
 * Renders as a clickable pill with the relation icon and target title.
 * Clicking dispatches a custom DOM event that the parent
 * ContextEntryDetail component catches to navigate to the target entry.
 */

interface Props {
  nodeKey: string;
  relation: string;
  targetTitle: string;
  targetEntryId: string | null;
}

export function WikiLinkPill({
  nodeKey,
  relation,
  targetTitle,
  targetEntryId,
}: Props) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (targetEntryId) {
        // Dispatch a custom event that the parent detail panel listens for
        window.dispatchEvent(
          new CustomEvent("ascend:navigate-entry", {
            detail: { entryId: targetEntryId },
          }),
        );
      }
    },
    [targetEntryId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (targetEntryId) {
          window.dispatchEvent(
            new CustomEvent("ascend:navigate-entry", {
              detail: { entryId: targetEntryId },
            }),
          );
        }
      }
    },
    [targetEntryId],
  );

  const displayRelation =
    relation !== "REFERENCES" ? `${relation.toLowerCase()}: ` : "";

  return (
    <span
      className="editor-wikilink"
      role="link"
      tabIndex={0}
      title={`${relation}: ${targetTitle}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-wikilink-entry-id={targetEntryId ?? undefined}
    >
      <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
      <span>
        {displayRelation}
        {targetTitle}
      </span>
    </span>
  );
}
