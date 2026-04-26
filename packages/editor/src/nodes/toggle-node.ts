/**
 * ToggleNode: block-level collapsible element.
 *
 * Stores a summary string and open/closed state. Children are the
 * collapsible body content. Markdown serialization uses HTML <details>.
 *
 * RUNTIME RENDERING: see apps/web/components/editor/toggle-block.tsx (Phase 6).
 */

import {
  ElementNode,
  type EditorConfig,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

// ── Serialized shape ──────────────────────────────────────────────

export type SerializedToggleNode = Spread<
  {
    summary: string;
    isOpen: boolean;
  },
  SerializedElementNode
>;

export interface TogglePayload {
  summary?: string;
  isOpen?: boolean;
  key?: NodeKey;
}

// ── Node class ────────────────────────────────────────────────────

export class ToggleNode extends ElementNode {
  __summary: string;
  __isOpen: boolean;

  static getType(): string {
    return "toggle";
  }

  static clone(node: ToggleNode): ToggleNode {
    return new ToggleNode(node.__summary, node.__isOpen, node.__key);
  }

  constructor(summary: string, isOpen: boolean, key?: NodeKey) {
    super(key);
    this.__summary = summary;
    this.__isOpen = isOpen;
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__summary = prevNode.__summary;
    this.__isOpen = prevNode.__isOpen;
  }

  // ── Getters / Setters ─────────────────────────────────────────

  getSummary(): string {
    return this.getLatest().__summary;
  }

  getIsOpen(): boolean {
    return this.getLatest().__isOpen;
  }

  setSummary(summary: string): this {
    const writable = this.getWritable();
    writable.__summary = summary;
    return writable;
  }

  setIsOpen(isOpen: boolean): this {
    const writable = this.getWritable();
    writable.__isOpen = isOpen;
    return writable;
  }

  // ── Block behavior ────────────────────────────────────────────

  isInline(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return true;
  }

  // ── DOM ───────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const details = document.createElement("details");
    const theme = config.theme;
    const className = theme.toggle;
    if (typeof className === "string") {
      details.className = className;
    }
    if (this.__isOpen) {
      details.open = true;
    }
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = this.__summary;
    details.appendChild(summaryEl);
    return details;
  }

  updateDOM(prevNode: ToggleNode, dom: HTMLElement): boolean {
    const details = dom as HTMLDetailsElement;
    if (prevNode.__isOpen !== this.__isOpen) {
      details.open = this.__isOpen;
    }
    if (prevNode.__summary !== this.__summary) {
      const summaryEl = details.querySelector("summary");
      if (summaryEl) {
        summaryEl.textContent = this.__summary;
      }
    }
    return false;
  }

  // ── JSON serialization ────────────────────────────────────────

  exportJSON(): SerializedToggleNode {
    return {
      ...super.exportJSON(),
      type: "toggle",
      version: 1,
      summary: this.__summary,
      isOpen: this.__isOpen,
    };
  }

  static importJSON(serializedNode: SerializedToggleNode): ToggleNode {
    return $createToggleNode({
      summary: serializedNode.summary,
      isOpen: serializedNode.isOpen,
    });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedToggleNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createToggleNode(
  payload: TogglePayload = {},
): ToggleNode {
  return new ToggleNode(
    payload.summary ?? "Details",
    payload.isOpen ?? false,
    payload.key,
  );
}

export function $isToggleNode(
  node: unknown,
): node is ToggleNode {
  return node instanceof ToggleNode;
}
