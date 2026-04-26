/**
 * Convert a Lexical serialized editor state back to Markdown.
 *
 * Uses @lexical/headless to create a transient editor, loads the
 * serialized state, and runs $convertToMarkdownString with the
 * full Ascend transformer set.
 */

import { createHeadlessEditor } from "@lexical/headless";
import { $getRoot, type SerializedEditorState } from "lexical";
import { $convertToMarkdownString } from "@lexical/markdown";
import { TRANSFORMERS } from "./transformers";
import { ALL_NODES } from "../nodes";

/**
 * Convert a Lexical serialized editor state JSON to Markdown.
 *
 * @param serializedState - The serialized Lexical editor state
 *   (as returned by editorState.toJSON() or markdownToBlocks()).
 * @returns Markdown string.
 */
export function blocksToMarkdown(
  serializedState: SerializedEditorState,
): string {
  const editor = createHeadlessEditor({
    nodes: ALL_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });

  const editorState = editor.parseEditorState(serializedState);

  let markdown = "";
  editorState.read(() => {
    markdown = $convertToMarkdownString(TRANSFORMERS, undefined, true);
  });

  return markdown;
}

/**
 * Convenience: extract plain text from a serialized editor state.
 * Reads all text nodes concatenated with newlines between blocks.
 */
export function blocksToText(
  serializedState: SerializedEditorState,
): string {
  const editor = createHeadlessEditor({
    nodes: ALL_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });

  const editorState = editor.parseEditorState(serializedState);

  let text = "";
  editorState.read(() => {
    text = $getRoot().getTextContent();
  });

  return text;
}
