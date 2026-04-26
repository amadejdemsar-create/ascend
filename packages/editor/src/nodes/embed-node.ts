/**
 * EmbedNode: block-level element for URL unfurls.
 *
 * Stores URL metadata (url, title, description, image). Renders as a
 * link in Markdown export. The web binding renders an unfurled card
 * with an optional sandboxed iframe (DZ-11: URL sanitization required).
 *
 * RUNTIME RENDERING: see apps/web/components/editor/embed-block.tsx (Phase 6).
 * Block-level, no children allowed.
 */

import {
  ElementNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

// ── Serialized shape ──────────────────────────────────────────────

export type SerializedEmbedNode = Spread<
  {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
  },
  SerializedElementNode
>;

export interface EmbedPayload {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  key?: NodeKey;
}

// ── Node class ────────────────────────────────────────────────────

export class EmbedNode extends ElementNode {
  __url: string;
  __title: string | null;
  __description: string | null;
  __image: string | null;

  static getType(): string {
    return "embed";
  }

  static clone(node: EmbedNode): EmbedNode {
    return new EmbedNode(
      node.__url,
      node.__title,
      node.__description,
      node.__image,
      node.__key,
    );
  }

  constructor(
    url: string,
    title: string | null,
    description: string | null,
    image: string | null,
    key?: NodeKey,
  ) {
    super(key);
    this.__url = url;
    this.__title = title;
    this.__description = description;
    this.__image = image;
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__url = prevNode.__url;
    this.__title = prevNode.__title;
    this.__description = prevNode.__description;
    this.__image = prevNode.__image;
  }

  // ── Getters ───────────────────────────────────────────────────

  getUrl(): string {
    return this.getLatest().__url;
  }

  getTitle(): string | null {
    return this.getLatest().__title;
  }

  getDescription(): string | null {
    return this.getLatest().__description;
  }

  getImage(): string | null {
    return this.getLatest().__image;
  }

  // ── Block behavior (no children allowed) ──────────────────────

  isInline(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return true;
  }

  // ── Text content ──────────────────────────────────────────────

  getTextContent(): string {
    const label = this.__title ?? this.__url;
    return label;
  }

  // ── DOM ───────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    const theme = config.theme;
    const className = theme.embed;
    if (typeof className === "string") {
      div.className = className;
    }
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  // ── JSON serialization ────────────────────────────────────────

  exportJSON(): SerializedEmbedNode {
    return {
      ...super.exportJSON(),
      type: "embed",
      version: 1,
      url: this.__url,
      title: this.__title,
      description: this.__description,
      image: this.__image,
    };
  }

  static importJSON(serializedNode: SerializedEmbedNode): EmbedNode {
    return $createEmbedNode({
      url: serializedNode.url,
      title: serializedNode.title,
      description: serializedNode.description,
      image: serializedNode.image,
    });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedEmbedNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }

  // ── Prevent children insertion ────────────────────────────────

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractWithChild(_child: LexicalNode): boolean {
    return false;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createEmbedNode(payload: EmbedPayload): EmbedNode {
  return new EmbedNode(
    payload.url,
    payload.title ?? null,
    payload.description ?? null,
    payload.image ?? null,
    payload.key,
  );
}

export function $isEmbedNode(
  node: unknown,
): node is EmbedNode {
  return node instanceof EmbedNode;
}
