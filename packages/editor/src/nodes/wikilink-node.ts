/**
 * WikiLinkNode: inline decorator for typed wikilinks.
 *
 * Renders as [[Title]] or [[relation:Title]] in Markdown.
 * Stores the relation type (ContextLinkType), target title, and an optional
 * resolved entry ID. The entry ID is null during parsing and resolved by
 * the editor binding or service layer after creation.
 *
 * RUNTIME RENDERING: see apps/web/components/editor/wikilink-pill.tsx (Phase 6).
 * This node's decorate() returns null; the web binding overrides via
 * LexicalComposer's decorator map.
 */

import {
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { ContextLinkType } from "@ascend/core";

// ── Serialized shape ──────────────────────────────────────────────

export type SerializedWikiLinkNode = Spread<
  {
    relation: ContextLinkType;
    targetTitle: string;
    targetEntryId: string | null;
  },
  SerializedLexicalNode
>;

// ── Payload for $create helper ────────────────────────────────────

export interface WikiLinkPayload {
  relation: ContextLinkType;
  targetTitle: string;
  targetEntryId: string | null;
  key?: NodeKey;
}

// ── Node class ────────────────────────────────────────────────────

export class WikiLinkNode extends DecoratorNode<null> {
  __relation: ContextLinkType;
  __targetTitle: string;
  __targetEntryId: string | null;

  static getType(): string {
    return "wikilink";
  }

  static clone(node: WikiLinkNode): WikiLinkNode {
    return new WikiLinkNode(
      node.__relation,
      node.__targetTitle,
      node.__targetEntryId,
      node.__key,
    );
  }

  constructor(
    relation: ContextLinkType,
    targetTitle: string,
    targetEntryId: string | null,
    key?: NodeKey,
  ) {
    super(key);
    this.__relation = relation;
    this.__targetTitle = targetTitle;
    this.__targetEntryId = targetEntryId;
  }

  // ── Getters ───────────────────────────────────────────────────

  getRelation(): ContextLinkType {
    return this.getLatest().__relation;
  }

  getTargetTitle(): string {
    return this.getLatest().__targetTitle;
  }

  getTargetEntryId(): string | null {
    return this.getLatest().__targetEntryId;
  }

  // ── Setters ───────────────────────────────────────────────────

  setTargetEntryId(id: string | null): this {
    const writable = this.getWritable();
    writable.__targetEntryId = id;
    return writable;
  }

  // ── Inline behavior ───────────────────────────────────────────

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  // ── Text content (for search, clipboard, Markdown export) ─────

  getTextContent(): string {
    const rel = this.__relation;
    const title = this.__targetTitle;
    if (rel === "REFERENCES") {
      return `[[${title}]]`;
    }
    return `[[${rel.toLowerCase()}:${title}]]`;
  }

  // ── DOM (never called in headless; the web binding handles this) ─

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    const theme = config.theme;
    const className = theme.wikilink;
    if (typeof className === "string") {
      span.className = className;
    }
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  // ── Decoration (null; web binding overrides) ──────────────────

  decorate(_editor: LexicalEditor, _config: EditorConfig): null {
    return null;
  }

  // ── JSON serialization ────────────────────────────────────────

  exportJSON(): SerializedWikiLinkNode {
    return {
      ...super.exportJSON(),
      type: "wikilink",
      version: 1,
      relation: this.__relation,
      targetTitle: this.__targetTitle,
      targetEntryId: this.__targetEntryId,
    };
  }

  static importJSON(serializedNode: SerializedWikiLinkNode): WikiLinkNode {
    return $createWikiLinkNode({
      relation: serializedNode.relation,
      targetTitle: serializedNode.targetTitle,
      targetEntryId: serializedNode.targetEntryId,
    });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedWikiLinkNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createWikiLinkNode(payload: WikiLinkPayload): WikiLinkNode {
  return new WikiLinkNode(
    payload.relation,
    payload.targetTitle,
    payload.targetEntryId,
    payload.key,
  );
}

export function $isWikiLinkNode(
  node: unknown,
): node is WikiLinkNode {
  return node instanceof WikiLinkNode;
}
