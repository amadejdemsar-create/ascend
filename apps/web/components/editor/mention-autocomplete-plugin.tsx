"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  TextNode,
} from "lexical";
import { createPortal } from "react-dom";
import { useContextEntries } from "@/lib/hooks/use-context";
import { $createMentionNode } from "@ascend/editor";
import { AtSignIcon } from "lucide-react";

/**
 * MentionAutocompletePlugin: triggered by `@`.
 *
 * Wave 3 scope: mentions context entries only. Goal/todo/user mentions
 * are deferred to Wave 8 collaboration.
 *
 * On selection, inserts a MentionNode with kind="user" (using the entry
 * as a reference target). Wave 8 will differentiate mention kinds.
 */

interface MentionOption {
  id: string;
  title: string;
  type: string;
}

export function MentionAutocompletePlugin() {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: entriesRaw } = useContextEntries();

  const entries: MentionOption[] = useMemo(() => {
    if (!entriesRaw) return [];
    return (entriesRaw as Array<{ id: string; title: string; type: string }>).map(
      (e) => ({ id: e.id, title: e.title, type: e.type ?? "NOTE" }),
    );
  }, [entriesRaw]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    setPosition(null);
  }, []);

  const filteredEntries = useMemo(() => {
    if (!query) return entries.slice(0, 15);
    const lower = query.toLowerCase();
    return entries
      .filter((e) => e.title.toLowerCase().includes(lower))
      .slice(0, 15);
  }, [entries, query]);

  // Detect `@` trigger
  useEffect(() => {
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      if (isOpen) return;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

        const anchor = selection.anchor;
        if (anchor.type !== "text") return;

        const node = anchor.getNode();
        const text = node.getTextContent();
        const offset = anchor.offset;

        if (offset < 1) return;
        if (text[offset - 1] !== "@") return;

        // Must be at start or preceded by whitespace
        const beforeAt = offset > 1 ? text[offset - 2] : "";
        if (beforeAt !== "" && beforeAt !== " " && beforeAt !== "\n") return;

        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) return;

        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
        setIsOpen(true);
        setQuery("");
        setSelectedIndex(0);
      });
    });

    return removeListener;
  }, [editor, isOpen]);

  // Track typing after `@`
  useEffect(() => {
    if (!isOpen) return;

    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          closeMenu();
          return;
        }

        const anchor = selection.anchor;
        if (anchor.type !== "text") {
          closeMenu();
          return;
        }

        const text = anchor.getNode().getTextContent();
        const atIdx = text.lastIndexOf("@");
        if (atIdx === -1) {
          closeMenu();
          return;
        }

        if (anchor.offset <= atIdx) {
          closeMenu();
          return;
        }

        const afterAt = text.substring(atIdx + 1, anchor.offset);
        // Close if there's a space (mention text shouldn't have spaces in the query)
        if (afterAt.includes(" ")) {
          closeMenu();
          return;
        }

        setQuery(afterAt);
        setSelectedIndex(0);
      });
    });

    return removeListener;
  }, [editor, isOpen, closeMenu]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const removeDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredEntries.length - 1));
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (e: KeyboardEvent | null) => {
        if (!isOpen) return false;
        e?.preventDefault();
        const entry = filteredEntries[selectedIndex];
        if (entry) {
          insertMention(entry);
        }
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        closeMenu();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      removeDown();
      removeUp();
      removeEnter();
      removeEscape();
    };
  }, [editor, isOpen, filteredEntries, selectedIndex, closeMenu]);

  const insertMention = useCallback(
    (entry: MentionOption) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!(node instanceof TextNode)) return;

        const text = node.getTextContent();
        const atIdx = text.lastIndexOf("@");
        if (atIdx === -1) return;

        const before = text.substring(0, atIdx);
        const after = text.substring(anchor.offset);

        const mentionNode = $createMentionNode({
          kind: "user", // Wave 3: entries treated as "user" mentions
          targetId: entry.id,
          label: entry.title,
        });

        node.setTextContent(before);
        node.insertAfter(mentionNode);

        if (after) {
          const afterNode = new TextNode(after);
          mentionNode.insertAfter(afterNode);
        }

        mentionNode.selectNext();
      });

      closeMenu();
    },
    [editor, closeMenu],
  );

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, closeMenu]);

  if (!isOpen || !position || filteredEntries.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-64 max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Mention autocomplete"
    >
      {filteredEntries.map((entry, index) => (
        <button
          key={entry.id}
          role="option"
          aria-selected={index === selectedIndex}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
            index === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "text-popover-foreground hover:bg-accent/50"
          }`}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => insertMention(entry)}
        >
          <AtSignIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{entry.title}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
