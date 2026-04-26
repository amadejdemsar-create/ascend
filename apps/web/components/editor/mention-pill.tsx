"use client";

import { useCallback } from "react";
import { AtSignIcon } from "lucide-react";

/**
 * MentionPill: inline decorator renderer for MentionNode.
 *
 * Renders as a clickable pill with @ icon and the mention label.
 * For Wave 3, all mentions are context entry references. Wave 8
 * will differentiate between user/goal/todo mentions.
 */

interface Props {
  nodeKey: string;
  kind: string;
  targetId: string;
  label: string;
}

export function MentionPill({ nodeKey, kind, targetId, label }: Props) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (targetId) {
        window.dispatchEvent(
          new CustomEvent("ascend:navigate-entry", {
            detail: { entryId: targetId },
          }),
        );
      }
    },
    [targetId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (targetId) {
          window.dispatchEvent(
            new CustomEvent("ascend:navigate-entry", {
              detail: { entryId: targetId },
            }),
          );
        }
      }
    },
    [targetId],
  );

  return (
    <span
      className="editor-mention"
      role="link"
      tabIndex={0}
      title={`@${label}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-mention-id={targetId}
    >
      <AtSignIcon className="size-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
