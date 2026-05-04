"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
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
  UploadIcon,
  FileTextIcon,
  MusicIcon,
  VideoIcon,
  DatabaseIcon,
} from "lucide-react";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createCalloutNode,
  $createToggleNode,
  $createAIBlockNode,
  $createFileNode,
  $createImageNode,
  $createWikiLinkNode,
} from "@ascend/editor";
import { toast } from "sonner";
import { useUploadFile } from "@/lib/hooks/use-files";
import { useCreateDatabase } from "@/lib/hooks/use-databases";

/**
 * SlashMenuPlugin: triggered by `/` at the start of a paragraph or after
 * whitespace. Shows a floating command palette for block insertion.
 *
 * Wave 4 Phase 5 added 5 file-related items: /upload, /image, /pdf,
 * /audio, /video. Each opens a hidden file picker filtered by MIME type.
 * After upload, the appropriate node is inserted at the cursor position.
 */

interface SlashMenuItem {
  id: string;
  label: string;
  keywords: string[];
  icon: React.ReactNode;
  onSelect: () => void;
}

interface SlashMenuPluginProps {
  entryId: string;
}

export function SlashMenuPlugin({ entryId }: SlashMenuPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // File upload support
  const uploadFile = useUploadFile();
  const createDatabase = useCreateDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileTypeRef = useRef<"upload" | "image" | "pdf" | "audio" | "video" | null>(null);
  const entryIdRef = useRef(entryId);
  entryIdRef.current = entryId;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    setPosition(null);
  }, []);

  // Close the menu when any scrollable ancestor scrolls or the window resizes.
  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => closeMenu();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen, closeMenu]);

  // ── File upload handler ──────────────────────────────────────

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fileType = pendingFileTypeRef.current;
      pendingFileTypeRef.current = null;

      try {
        const result = await uploadFile.mutateAsync({
          file,
          entryId: entryIdRef.current,
        });
        const newFileId = result.file.id;
        const mime = result.file.mimeType;

        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            if (fileType === "image" || mime.startsWith("image/")) {
              const imageNode = $createImageNode({
                src: `/api/files/${newFileId}`,
                alt: file.name,
              });
              selection.insertNodes([imageNode]);
            } else {
              const fileNode = $createFileNode({ fileId: newFileId });
              selection.insertNodes([fileNode]);
            }
          }
        });

        toast.success(`Uploaded "${file.name}"`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Upload failed",
        );
      }

      // Reset input for re-use
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [editor, uploadFile],
  );

  const openFilePicker = useCallback(
    (type: "upload" | "image" | "pdf" | "audio" | "video") => {
      pendingFileTypeRef.current = type;

      const acceptMap: Record<string, string> = {
        upload: "",
        image: "image/*",
        pdf: "application/pdf",
        audio: "audio/*",
        video: "video/*",
      };

      if (fileInputRef.current) {
        fileInputRef.current.accept = acceptMap[type];
        fileInputRef.current.click();
      }
    },
    [],
  );

  // ── Database creation handler ────────────────────────────────

  const handleCreateDatabase = useCallback(async () => {
    try {
      const result = await createDatabase.mutateAsync({
        name: "Untitled Database",
        parentEntryId: entryIdRef.current,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = result as any;
      const dbEntryId = raw.entryId ?? raw.contextEntry?.id ?? raw.database?.contextEntryId ?? null;
      const title = raw.name ?? raw.contextEntry?.title ?? "Untitled Database";
      // Insert a wikilink to the new database
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const wikiNode = $createWikiLinkNode({
            relation: "REFERENCES",
            targetTitle: title,
            targetEntryId: dbEntryId,
          });
          selection.insertNodes([wikiNode]);
        }
      });
      toast.success("Database created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create database");
    }
  }, [editor, createDatabase]);

  // ── Menu items ───────────────────────────────────────────────

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
    // ── File upload items (Wave 4 Phase 5) ──────────────────
    {
      id: "upload",
      label: "Upload File",
      keywords: ["upload", "file", "attach", "attachment"],
      icon: <UploadIcon className="size-4" aria-hidden="true" />,
      onSelect: () => openFilePicker("upload"),
    },
    {
      id: "image",
      label: "Image",
      keywords: ["image", "picture", "photo", "img"],
      icon: <ImageIcon className="size-4" aria-hidden="true" />,
      onSelect: () => openFilePicker("image"),
    },
    {
      id: "pdf",
      label: "PDF Document",
      keywords: ["pdf", "document", "acrobat"],
      icon: <FileTextIcon className="size-4" aria-hidden="true" />,
      onSelect: () => openFilePicker("pdf"),
    },
    {
      id: "audio",
      label: "Audio",
      keywords: ["audio", "music", "sound", "mp3", "recording", "voice"],
      icon: <MusicIcon className="size-4" aria-hidden="true" />,
      onSelect: () => openFilePicker("audio"),
    },
    {
      id: "video",
      label: "Video",
      keywords: ["video", "movie", "clip", "mp4", "recording"],
      icon: <VideoIcon className="size-4" aria-hidden="true" />,
      onSelect: () => openFilePicker("video"),
    },
    // ── Database ────────────────────────────────────────────
    {
      id: "database",
      label: "Database",
      keywords: ["database", "table", "board", "calendar", "gallery", "timeline", "db"],
      icon: <DatabaseIcon className="size-4" aria-hidden="true" />,
      onSelect: () => { handleCreateDatabase(); },
    },
    // ── AI Block ────────────────────────────────────────────
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
  ], [editor, openFilePicker, handleCreateDatabase]);

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
    const removeListener = editor.registerTextContentListener(() => {
      // Broad listener; actual slash detection happens in the update listener.
    });
    return removeListener;
  }, [editor]);

  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(
      ({ editorState }) => {
        if (isOpen) return;

        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

          const anchor = selection.anchor;
          if (anchor.type !== "text") return;

          const node = anchor.getNode();
          const textContent = node.getTextContent();
          const offset = anchor.offset;

          if (offset < 1) return;
          if (textContent[offset - 1] !== "/") return;

          const beforeSlash = offset > 1 ? textContent[offset - 2] : "";
          if (beforeSlash !== "" && beforeSlash !== " " && beforeSlash !== "\n") return;

          const domSelection = window.getSelection();
          if (!domSelection || domSelection.rangeCount === 0) return;

          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          setPosition({
            top: rect.bottom + 4,
            left: rect.left,
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

  return (
    <>
      {/* Hidden file input for upload items */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden="true"
      />

      {isOpen && position && filteredItems.length > 0 &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-64 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
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
        )}
    </>
  );
}
