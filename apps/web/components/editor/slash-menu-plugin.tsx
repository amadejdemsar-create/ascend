"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode } from "@lexical/rich-text";
import {
  $createListNode,
  $createListItemNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from "@lexical/list";
import { $createCodeNode } from "@lexical/code";
import { $createQuoteNode } from "@lexical/rich-text";
import { createPortal } from "react-dom";
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  CheckSquareIcon,
  CodeIcon,
  QuoteIcon,
  InfoIcon,
  AlertTriangleIcon,
  AlertOctagonIcon,
  ChevronRightIcon,
  MinusIcon,
  ImageIcon,
  SparklesIcon,
} from "lucide-react";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createCalloutNode,
  $createToggleNode,
  $createAIBlockNode,
} from "@ascend/editor";

/**
 * SlashMenuPlugin: triggered by `/` at the start of a paragraph or after
 * whitespace. Shows a floating command palette for block insertion.
 */

interface SlashMenuItem {
  id: string;
  label: string;
  keywords: string[];
  icon: React.ReactNode;
  onSelect: () => void;
}

export function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    setPosition(null);
  }, []);

  const items: SlashMenuItem[] = useMemo(() => [
    {
      id: "heading1",
      label: "Heading 1",
      keywords: ["h1", "heading", "title"],
      icon: <Heading1Icon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createHeadingNode("h1"));
          }
        });
      },
    },
    {
      id: "heading2",
      label: "Heading 2",
      keywords: ["h2", "heading", "subtitle"],
      icon: <Heading2Icon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createHeadingNode("h2"));
          }
        });
      },
    },
    {
      id: "heading3",
      label: "Heading 3",
      keywords: ["h3", "heading"],
      icon: <Heading3Icon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createHeadingNode("h3"));
          }
        });
      },
    },
    {
      id: "bullet-list",
      label: "Bulleted List",
      keywords: ["bullet", "list", "ul", "unordered"],
      icon: <ListIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      },
    },
    {
      id: "numbered-list",
      label: "Numbered List",
      keywords: ["number", "list", "ol", "ordered"],
      icon: <ListOrderedIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      },
    },
    {
      id: "todo-list",
      label: "To-do List",
      keywords: ["todo", "check", "checkbox", "task"],
      icon: <CheckSquareIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      },
    },
    {
      id: "code",
      label: "Code Block",
      keywords: ["code", "snippet", "pre"],
      icon: <CodeIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createCodeNode());
          }
        });
      },
    },
    {
      id: "quote",
      label: "Quote",
      keywords: ["quote", "blockquote"],
      icon: <QuoteIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createQuoteNode());
          }
        });
      },
    },
    {
      id: "callout-info",
      label: "Callout (Info)",
      keywords: ["callout", "info", "note", "admonition"],
      icon: <InfoIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const callout = $createCalloutNode({ variant: "info" });
            const paragraph = $createParagraphNode();
            callout.append(paragraph);
            selection.insertNodes([callout]);
          }
        });
      },
    },
    {
      id: "callout-warning",
      label: "Callout (Warning)",
      keywords: ["callout", "warning", "caution"],
      icon: <AlertTriangleIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const callout = $createCalloutNode({ variant: "warning" });
            const paragraph = $createParagraphNode();
            callout.append(paragraph);
            selection.insertNodes([callout]);
          }
        });
      },
    },
    {
      id: "callout-danger",
      label: "Callout (Danger)",
      keywords: ["callout", "danger", "error", "alert"],
      icon: <AlertOctagonIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const callout = $createCalloutNode({ variant: "danger" });
            const paragraph = $createParagraphNode();
            callout.append(paragraph);
            selection.insertNodes([callout]);
          }
        });
      },
    },
    {
      id: "toggle",
      label: "Toggle",
      keywords: ["toggle", "collapsible", "details", "expand"],
      icon: <ChevronRightIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const toggle = $createToggleNode({ summary: "Details" });
            const paragraph = $createParagraphNode();
            toggle.append(paragraph);
            selection.insertNodes([toggle]);
          }
        });
      },
    },
    {
      id: "divider",
      label: "Divider",
      keywords: ["divider", "hr", "horizontal", "rule", "separator"],
      icon: <MinusIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
      },
    },
    {
      id: "image",
      label: "Image",
      keywords: ["image", "picture", "photo", "img"],
      icon: <ImageIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        // Placeholder: Wave 4 will add the full image upload flow.
        // For now, insert a paragraph with placeholder text.
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const node = $createParagraphNode();
            node.append($createTextNode("[Image placeholder]"));
            selection.insertNodes([node]);
          }
        });
      },
    },
    {
      id: "ai-block",
      label: "AI Block",
      keywords: ["ai", "generate", "write", "assistant", "magic"],
      icon: <SparklesIcon className="size-4" aria-hidden="true" />,
      onSelect: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const aiBlock = $createAIBlockNode();
            selection.insertNodes([aiBlock]);
          }
        });
      },
    },
  ], [editor]);

  const filteredItems = useMemo(() => {
    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.keywords.some((kw) => kw.includes(lower)),
    );
  }, [items, query]);

  // Listen for `/` typed at start of paragraph or after whitespace
  useEffect(() => {
    const removeListener = editor.registerTextContentListener((text) => {
      // This is a broad listener; the actual slash detection happens
      // in the update listener below.
    });
    return removeListener;
  }, [editor]);

  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(
      ({ editorState, prevEditorState }) => {
        if (isOpen) return; // Don't re-trigger while menu is showing

        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

          const anchor = selection.anchor;
          if (anchor.type !== "text") return;

          const node = anchor.getNode();
          const textContent = node.getTextContent();
          const offset = anchor.offset;

          // Check if the character at cursor-1 is `/` and it's at the start
          // of the text content or preceded by whitespace
          if (offset < 1) return;
          if (textContent[offset - 1] !== "/") return;

          const beforeSlash = offset > 1 ? textContent[offset - 2] : "";
          if (beforeSlash !== "" && beforeSlash !== " " && beforeSlash !== "\n") return;

          // Get caret position for menu placement
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
      },
    );

    return removeUpdateListener;
  }, [editor, isOpen]);

  // Handle keyboard navigation inside the menu
  useEffect(() => {
    if (!isOpen) return;

    const removeDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
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
        const item = filteredItems[selectedIndex];
        if (item) {
          // Remove the `/` + query text before inserting the block
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchor = selection.anchor;
              const node = anchor.getNode();
              if (!$isTextNode(node)) return;
              const text = node.getTextContent();
              // Remove the slash command text (/ + query)
              const slashStart = text.lastIndexOf("/");
              if (slashStart !== -1) {
                const before = text.substring(0, slashStart);
                node.setTextContent(before);
              }
            }
          });
          item.onSelect();
          closeMenu();
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
  }, [editor, isOpen, filteredItems, selectedIndex, closeMenu]);

  // Track typing after `/` to build the query
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
        const slashIdx = text.lastIndexOf("/");
        if (slashIdx === -1) {
          closeMenu();
          return;
        }

        const afterSlash = text.substring(slashIdx + 1, anchor.offset);
        // If user backspaced past the slash, close
        if (anchor.offset <= slashIdx) {
          closeMenu();
          return;
        }

        setQuery(afterSlash);
        setSelectedIndex(0);
      });
    });

    return removeListener;
  }, [editor, isOpen, closeMenu]);

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

  if (!isOpen || !position || filteredItems.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-64 rounded-lg border bg-popover p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Block type menu"
    >
      {filteredItems.map((item, index) => (
        <button
          key={item.id}
          role="option"
          aria-selected={index === selectedIndex}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
            index === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "text-popover-foreground hover:bg-accent/50"
          }`}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const anchor = selection.anchor;
                const node = anchor.getNode();
                if (!$isTextNode(node)) return;
                const text = node.getTextContent();
                const slashStart = text.lastIndexOf("/");
                if (slashStart !== -1) {
                  const before = text.substring(0, slashStart);
                  node.setTextContent(before);
                }
              }
            });
            item.onSelect();
            closeMenu();
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
