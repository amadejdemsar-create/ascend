"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { createPortal } from "react-dom";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
  LinkIcon,
} from "lucide-react";

/**
 * InlineToolbarPlugin: floating toolbar that appears on text selection.
 *
 * Buttons: Bold, Italic, Underline, Strikethrough, Inline Code, Link.
 * Positioned above the selection using the native Selection API.
 */

interface ToolbarButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  format?: "bold" | "italic" | "underline" | "strikethrough" | "code";
  isLink?: boolean;
}

const BUTTONS: ToolbarButton[] = [
  { id: "bold", label: "Bold", icon: <BoldIcon className="size-3.5" aria-hidden="true" />, format: "bold" },
  { id: "italic", label: "Italic", icon: <ItalicIcon className="size-3.5" aria-hidden="true" />, format: "italic" },
  { id: "underline", label: "Underline", icon: <UnderlineIcon className="size-3.5" aria-hidden="true" />, format: "underline" },
  { id: "strikethrough", label: "Strikethrough", icon: <StrikethroughIcon className="size-3.5" aria-hidden="true" />, format: "strikethrough" },
  { id: "code", label: "Inline Code", icon: <CodeIcon className="size-3.5" aria-hidden="true" />, format: "code" },
  { id: "link", label: "Link", icon: <LinkIcon className="size-3.5" aria-hidden="true" />, isLink: true },
];

export function InlineToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      setIsVisible(false);
      return;
    }

    // Detect active formats
    const formats = new Set<string>();
    if (selection.hasFormat("bold")) formats.add("bold");
    if (selection.hasFormat("italic")) formats.add("italic");
    if (selection.hasFormat("underline")) formats.add("underline");
    if (selection.hasFormat("strikethrough")) formats.add("strikethrough");
    if (selection.hasFormat("code")) formats.add("code");
    setActiveFormats(formats);

    // Position toolbar above the selection
    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setIsVisible(false);
      return;
    }

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0) {
      setIsVisible(false);
      return;
    }

    setPosition({
      top: rect.top + window.scrollY - 44,
      left: rect.left + window.scrollX + rect.width / 2,
    });
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });

    return removeListener;
  }, [editor, updateToolbar]);

  const handleFormat = useCallback(
    (button: ToolbarButton) => {
      if (button.isLink) {
        const url = window.prompt("Enter URL:");
        if (url) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
        }
      } else if (button.format) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, button.format);
      }
    },
    [editor],
  );

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
      }}
      role="toolbar"
      aria-label="Text formatting"
    >
      {BUTTONS.map((button) => (
        <button
          key={button.id}
          type="button"
          className={`rounded-md p-1.5 transition-colors ${
            activeFormats.has(button.format ?? "")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
          title={button.label}
          aria-label={button.label}
          aria-pressed={activeFormats.has(button.format ?? "")}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent selection loss
            handleFormat(button);
          }}
        >
          {button.icon}
        </button>
      ))}
    </div>,
    document.body,
  );
}
