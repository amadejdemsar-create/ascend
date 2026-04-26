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
import { $createWikiLinkNode } from "@ascend/editor";
import { FileTextIcon } from "lucide-react";

/**
 * WikiLinkAutocompletePlugin: triggered by `[[`.
 *
 * Shows a dropdown of context entry titles for wikilink insertion.
 * Supports relation prefix: `[[contradicts:...` etc.
 * On selection, inserts a WikiLinkNode with the selected entry's title
 * and ID.
 */

interface EntryOption {
  id: string;
  title: string;
  type: string;
}

export function WikiLinkAutocompletePlugin() {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: entriesRaw } = useContextEntries();

  const entries: EntryOption[] = useMemo(() => {
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

  // Parse query for optional relation prefix
  const { relation, titleQuery } = useMemo(() => {
    const colonIdx = query.indexOf(":");
    if (colonIdx > 0) {
      return {
        relation: query.substring(0, colonIdx).toUpperCase(),
        titleQuery: query.substring(colonIdx + 1),
      };
    }
    return { relation: "REFERENCES", titleQuery: query };
  }, [query]);

  const filteredEntries = useMemo(() => {
    if (!titleQuery) return entries.slice(0, 20);
    const lower = titleQuery.toLowerCase();
    return entries
      .filter((e) => e.title.toLowerCase().includes(lower))
      .slice(0, 20);
  }, [entries, titleQuery]);

  // Detect `[[` trigger
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

        // Look for `[[` just before the cursor
        if (offset < 2) return;
        if (text[offset - 1] !== "[" || text[offset - 2] !== "[") return;

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

  // Track typing after `[[` to build the query
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
        // Find the `[[` trigger
        const triggerIdx = text.lastIndexOf("[[");
        if (triggerIdx === -1 || anchor.offset <= triggerIdx + 2) {
          // If user deleted back past `[[`, close
          if (triggerIdx === -1) {
            closeMenu();
          }
          return;
        }

        const afterTrigger = text.substring(triggerIdx + 2, anchor.offset);
        // Close if user typed `]]` already
        if (afterTrigger.includes("]]")) {
          closeMenu();
          return;
        }

        setQuery(afterTrigger);
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
          insertWikiLink(entry);
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

  const insertWikiLink = useCallback(
    (entry: EntryOption) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!(node instanceof TextNode)) return;

        const text = node.getTextContent();
        const triggerIdx = text.lastIndexOf("[[");
        if (triggerIdx === -1) return;

        // Split the text node: text before `[[` stays, `[[...` is replaced with WikiLinkNode
        const before = text.substring(0, triggerIdx);
        const after = text.substring(anchor.offset);

        // Use a valid ContextLinkType for the relation. Default to REFERENCES.
        const validRelations = [
          "REFERENCES", "SUPPORTS", "CONTRADICTS", "EXTENDS",
          "IMPLEMENTS", "DEPENDS_ON", "CAUSED_BY", "RELATED_TO", "CHILD_OF",
        ];
        const resolvedRelation = validRelations.includes(relation)
          ? relation as import("@ascend/core").ContextLinkType
          : "REFERENCES" as import("@ascend/core").ContextLinkType;

        const wikiLinkNode = $createWikiLinkNode({
          relation: resolvedRelation,
          targetTitle: entry.title,
          targetEntryId: entry.id,
        });

        // Replace the current node's content
        node.setTextContent(before);

        // Insert the wikilink after the text
        node.insertAfter(wikiLinkNode);

        // If there's text after the cursor position, create a new text node
        if (after) {
          const afterNode = new TextNode(after);
          wikiLinkNode.insertAfter(afterNode);
        }

        // Move selection after the wikilink
        wikiLinkNode.selectNext();
      });

      closeMenu();
    },
    [editor, relation, closeMenu],
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
      className="fixed z-50 w-72 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="WikiLink autocomplete"
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
          onClick={() => insertWikiLink(entry)}
        >
          <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{entry.title}</span>
          <span className="ml-auto text-xs text-muted-foreground shrink-0">{entry.type}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
