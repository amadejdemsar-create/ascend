/**
 * ImageNode: block-level decorator for images.
 *
 * Stores src URL, optional alt text, and optional caption.
 * Markdown serialization: ![alt](src "caption")
 *
 * RUNTIME RENDERING: see apps/web/components/editor/image-block.tsx (Phase 6).
 * Wave 4 adds rich resize/crop UI. This is a minimal scaffold.
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

// ── Serialized shape ──────────────────────────────────────────────

export type SerializedImageNode = Spread<
  {
    src: string;
    alt: string | null;
    caption: string | null;
  },
  SerializedLexicalNode
>;

export interface ImagePayload {
  src: string;
  alt?: string | null;
  caption?: string | null;
  key?: NodeKey;
}

// ── Node class ────────────────────────────────────────────────────

export class ImageNode extends DecoratorNode<null> {
  __src: string;
  __alt: string | null;
  __caption: string | null;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__alt,
      node.__caption,
      node.__key,
    );
  }

  constructor(
    src: string,
    alt: string | null,
    caption: string | null,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__caption = caption;
  }

  // ── Getters ───────────────────────────────────────────────────

  getSrc(): string {
    return this.getLatest().__src;
  }

  getAlt(): string | null {
    return this.getLatest().__alt;
  }

  getCaption(): string | null {
    return this.getLatest().__caption;
  }

  // ── Setters ───────────────────────────────────────────────────

  setSrc(src: string): this {
    const writable = this.getWritable();
    writable.__src = src;
    return writable;
  }

  setAlt(alt: string | null): this {
    const writable = this.getWritable();
    writable.__alt = alt;
    return writable;
  }

  setCaption(caption: string | null): this {
    const writable = this.getWritable();
    writable.__caption = caption;
    return writable;
  }

  // ── Block behavior ────────────────────────────────────────────

  isInline(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  // ── Text content ──────────────────────────────────────────────

  getTextContent(): string {
    return this.__alt ?? "";
  }

  // ── DOM ───────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    const theme = config.theme;
    const className = theme.image;
    if (typeof className === "string") {
      div.className = className;
    }
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): null {
    return null;
  }

  // ── JSON serialization ────────────────────────────────────────

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: "image",
      version: 1,
      src: this.__src,
      alt: this.__alt,
      caption: this.__caption,
    };
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      alt: serializedNode.alt,
      caption: serializedNode.caption,
    });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedImageNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createImageNode(payload: ImagePayload): ImageNode {
  return new ImageNode(
    payload.src,
    payload.alt ?? null,
    payload.caption ?? null,
    payload.key,
  );
}

export function $isImageNode(
  node: unknown,
): node is ImageNode {
  return node instanceof ImageNode;
}
