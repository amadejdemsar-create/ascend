/**
 * @ascend/editor
 *
 * Platform-agnostic Lexical editor configuration for the Ascend ecosystem.
 * Provides custom node definitions, theme tokens, Markdown round-trip
 * serialization, and plain-text extraction.
 *
 * No React, no Next.js, no Prisma, no DOM runtime dependencies.
 * DOM types are included for Lexical's type surface (createDOM signatures)
 * but never accessed at runtime in headless/server contexts.
 *
 * The web binding (@lexical/react, LexicalComposer, plugins) lives in
 * apps/web/components/context/context-block-editor.tsx (Phase 6).
 * Mobile (Wave 6) will consume only the Markdown serialization layer.
 */

// ── Nodes ─────────────────────────────────────────────────────────

export { ALL_NODES } from "./nodes";

// Custom nodes
export {
  WikiLinkNode,
  $createWikiLinkNode,
  $isWikiLinkNode,
  type SerializedWikiLinkNode,
  type WikiLinkPayload,
} from "./nodes";

export {
  MentionNode,
  $createMentionNode,
  $isMentionNode,
  type MentionKind,
  type SerializedMentionNode,
  type MentionPayload,
} from "./nodes";

export {
  AIBlockNode,
  $createAIBlockNode,
  $isAIBlockNode,
  type AIBlockState,
  type SerializedAIBlockNode,
  type AIBlockPayload,
} from "./nodes";

// Re-export Lexical's SerializedEditorState for consumers
export type { SerializedEditorState } from "lexical";

export {
  EmbedNode,
  $createEmbedNode,
  $isEmbedNode,
  type SerializedEmbedNode,
  type EmbedPayload,
} from "./nodes";

export {
  CalloutNode,
  $createCalloutNode,
  $isCalloutNode,
  VARIANT_TO_TAG,
  TAG_TO_VARIANT,
  type CalloutVariant,
  type SerializedCalloutNode,
  type CalloutPayload,
} from "./nodes";

export {
  ToggleNode,
  $createToggleNode,
  $isToggleNode,
  type SerializedToggleNode,
  type TogglePayload,
} from "./nodes";

export {
  FileNode,
  $createFileNode,
  $isFileNode,
  type SerializedFileNode,
  type FilePayload,
} from "./nodes";

export {
  ImageNode,
  $createImageNode,
  $isImageNode,
  type SerializedImageNode,
  type ImagePayload,
} from "./nodes";

// Re-exported built-in nodes
export {
  HeadingNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
} from "./nodes";

// ── Theme ─────────────────────────────────────────────────────────

export { EDITOR_THEME } from "./theme";

// ── Markdown round-trip ───────────────────────────────────────────

export {
  TRANSFORMERS,
  markdownToBlocks,
  markdownToEditor,
  markdownToText,
  blocksToMarkdown,
  blocksToText,
} from "./markdown";

// ── Plain-text extraction ─────────────────────────────────────────

export { extractText } from "./extract";
