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
 * @param md - Raw Markdown content.
 * @returns The serialized Lexical editor state (JSON-serializable object).
 */
export function markdownToBlocks(md: string): SerializedEditorState {
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
