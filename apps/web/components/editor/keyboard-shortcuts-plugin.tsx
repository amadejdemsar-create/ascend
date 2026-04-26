"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  COMMAND_PRIORITY_NORMAL,
  KEY_DOWN_COMMAND,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode } from "@lexical/rich-text";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";

/**
 * KeyboardShortcutsPlugin: registers Notion-equivalent keyboard shortcuts.
 *
 * - Cmd+B / Cmd+I / Cmd+U: bold / italic / underline (handled by Lexical core)
 * - Cmd+E: inline code
 * - Cmd+Shift+1 / 2 / 3: H1 / H2 / H3
 * - Cmd+Shift+8 / 9: bullet / numbered list
 * - Cmd+K: insert link
 *
 * Undo/redo (Cmd+Z, Cmd+Shift+Z) are handled by HistoryPlugin natively.
 */

export function KeyboardShortcutsPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeKeyDown = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const isMeta = event.metaKey || event.ctrlKey;
        if (!isMeta) return false;

        // Cmd+E: inline code
        if (event.key === "e" && !event.shiftKey) {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
          return true;
        }

        // Cmd+K: insert link
        if (event.key === "k" && !event.shiftKey) {
          event.preventDefault();
          const url = window.prompt("Enter URL:");
          if (url) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
          }
          return true;
        }

        // Cmd+Shift+1/2/3: Heading 1/2/3
        if (event.shiftKey && ["1", "2", "3"].includes(event.key)) {
          event.preventDefault();
          const level = event.key as "1" | "2" | "3";
          const tag = `h${level}` as "h1" | "h2" | "h3";
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode(tag));
            }
          });
          return true;
        }

        // Cmd+Shift+8: bullet list
        if (event.shiftKey && event.key === "8") {
          event.preventDefault();
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          return true;
        }

        // Cmd+Shift+9: numbered list
        if (event.shiftKey && event.key === "9") {
          event.preventDefault();
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );

    return removeKeyDown;
  }, [editor]);

  return null;
}
