/**
 * Convert a Markdown string to a Lexical serialized editor state.
 *
 * Uses @lexical/headless to create a transient editor, applies the
 * Markdown via $convertFromMarkdownString with the full Ascend
 * transformer set, and returns the JSON representation.
 *
 * This function is synchronous but internally uses Lexical's
 * editor.update which is synchronous in headless mode.
 */

import { createHeadlessEditor } from "@lexical/headless";
import { $getRoot, type SerializedEditorState } from "lexical";
import { $convertFromMarkdownString } from "@lexical/markdown";
import { TRANSFORMERS } from "./transformers";
import { ALL_NODES } from "../nodes";

/**
 * Parse a Markdown string into a Lexical serialized editor state JSON.
 *
 * Tolerant: if strict conversion via @lexical/markdown throws (custom
 * transformer regex panic, unsupported markdown extension, malformed
 * input), falls back to a plain-text-paragraphs snapshot so callers
 * always get a valid editor state. The original markdown is preserved
 * upstream (ContextEntry.content), so no content is lost — only
 * structure on the fallback path.
 *
 * @param md - Raw Markdown content.
 * @returns The serialized Lexical editor state (JSON-serializable object).
 */
export function markdownToBlocks(md: string): SerializedEditorState {
  try {
    const editor = createHeadlessEditor({
      nodes: ALL_NODES,
      onError: (error: Error) => {
        throw error;
      },
    });

    editor.update(
      () => {
        $convertFromMarkdownString(md, TRANSFORMERS, undefined, true);
      },
      { discrete: true },
    );

    return editor.getEditorState().toJSON();
  } catch (error) {
    // Log so callers (server) can diagnose without losing the user's editor.
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[markdownToBlocks] Strict conversion failed, falling back to plain-text paragraphs:",
        error instanceof Error ? error.message : error,
      );
    }
    return buildPlainTextFallback(md);
  }
}

/**
 * Build a minimal, always-valid Lexical state from raw markdown by
 * splitting on blank lines into paragraphs. Loses heading/list/code
 * structure but guarantees the editor mounts with the user's text.
 */
function buildPlainTextFallback(md: string): SerializedEditorState {
  const paragraphs = (md ?? "")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0);

  const children =
    paragraphs.length > 0
      ? paragraphs.map((text) => ({
          type: "paragraph" as const,
          version: 1,
          direction: null,
          format: "",
          indent: 0,
          children: [
            {
              type: "text",
              version: 1,
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text,
            },
          ],
        }))
      : [
          {
            type: "paragraph" as const,
            version: 1,
            direction: null,
            format: "",
            indent: 0,
            children: [],
          },
        ];

  return {
    root: {
      type: "root",
      version: 1,
      direction: null,
      format: "",
      indent: 0,
      children: children as never,
    },
  } as SerializedEditorState;
}

/**
 * Parse Markdown and return an initialized headless editor.
 * Useful when the caller needs to perform further operations
 * on the editor state before serializing.
 *
 * @param md - Raw Markdown content.
 * @returns A headless LexicalEditor with the parsed state.
 */
export function markdownToEditor(md: string) {
  const editor = createHeadlessEditor({
    nodes: ALL_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });

  editor.update(
    () => {
      $convertFromMarkdownString(md, TRANSFORMERS, undefined, true);
    },
    { discrete: true },
  );

  return editor;
}

/**
 * Convenience: get the root node's text content from a Markdown string.
 * Useful for quick plain-text extraction from Markdown.
 */
export function markdownToText(md: string): string {
  const editor = markdownToEditor(md);
  let text = "";
  editor.getEditorState().read(() => {
    text = $getRoot().getTextContent();
  });
  return text;
}
