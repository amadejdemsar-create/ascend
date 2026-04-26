/**
 * Node registry for @ascend/editor.
 *
 * ALL_NODES is the complete list of node classes to register on a Lexical
 * editor instance (via the `nodes` config). It includes both built-in
 * @lexical/* nodes and Ascend custom nodes.
 *
 * The web binding passes this to LexicalComposer's initialConfig.
 * Headless usage (Markdown round-trip, text extraction) also requires it.
 */

import { type Klass, type LexicalNode } from "lexical";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";

import { WikiLinkNode } from "./wikilink-node";
import { MentionNode } from "./mention-node";
import { AIBlockNode } from "./ai-block-node";
import { EmbedNode } from "./embed-node";
import { CalloutNode } from "./callout-node";
import { ToggleNode } from "./toggle-node";
import { FileNode } from "./file-node";
import { ImageNode } from "./image-node";

/**
 * Complete node set for an Ascend Lexical editor instance.
 * Pass this as the `nodes` array in createEditor / LexicalComposer config.
 */
export const ALL_NODES: Array<Klass<LexicalNode>> = [
  // Built-in @lexical/* nodes
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  // Ascend custom nodes
  WikiLinkNode,
  MentionNode,
  AIBlockNode,
  EmbedNode,
  CalloutNode,
  ToggleNode,
  FileNode,
  ImageNode,
];

// Re-export all custom nodes with their helpers and types
export {
  WikiLinkNode,
  $createWikiLinkNode,
  $isWikiLinkNode,
  type SerializedWikiLinkNode,
  type WikiLinkPayload,
} from "./wikilink-node";

export {
  MentionNode,
  $createMentionNode,
  $isMentionNode,
  type MentionKind,
  type SerializedMentionNode,
  type MentionPayload,
} from "./mention-node";

export {
  AIBlockNode,
  $createAIBlockNode,
  $isAIBlockNode,
  type AIBlockState,
  type SerializedAIBlockNode,
  type AIBlockPayload,
} from "./ai-block-node";

export {
  EmbedNode,
  $createEmbedNode,
  $isEmbedNode,
  type SerializedEmbedNode,
  type EmbedPayload,
} from "./embed-node";

export {
  CalloutNode,
  $createCalloutNode,
  $isCalloutNode,
  VARIANT_TO_TAG,
  TAG_TO_VARIANT,
  type CalloutVariant,
  type SerializedCalloutNode,
  type CalloutPayload,
} from "./callout-node";

export {
  ToggleNode,
  $createToggleNode,
  $isToggleNode,
  type SerializedToggleNode,
  type TogglePayload,
} from "./toggle-node";

export {
  FileNode,
  $createFileNode,
  $isFileNode,
  type SerializedFileNode,
  type FilePayload,
} from "./file-node";

export {
  ImageNode,
  $createImageNode,
  $isImageNode,
  type SerializedImageNode,
  type ImagePayload,
} from "./image-node";

// Re-export built-in nodes for convenience
export { HeadingNode, QuoteNode } from "@lexical/rich-text";
export { CodeNode, CodeHighlightNode } from "@lexical/code";
export { ListNode, ListItemNode } from "@lexical/list";
export { LinkNode, AutoLinkNode } from "@lexical/link";
