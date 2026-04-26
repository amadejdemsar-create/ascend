/**
 * CalloutNode: block-level element for admonition / callout blocks.
 *
 * Supports four variants: "info", "warning", "success", "danger".
 * Markdown serialization uses GitHub-style admonition syntax:
 *   > [!NOTE]
 *   > Content here
 *
 * Children allowed: the callout body is composed of child nodes.
 *
 * RUNTIME RENDERING: see apps/web/components/editor/callout-block.tsx (Phase 6).
 */

import {
  ElementNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

// ── Types ─────────────────────────────────────────────────────────

export type CalloutVariant = "info" | "warning" | "success" | "danger";

export type SerializedCalloutNode = Spread<
  {
    variant: CalloutVariant;
  },
  SerializedElementNode
>;

export interface CalloutPayload {
  variant?: CalloutVariant;
  key?: NodeKey;
}

// ── Markdown admonition tag mapping ───────────────────────────────

const VARIANT_TO_TAG: Record<CalloutVariant, string> = {
  info: "NOTE",
  warning: "WARNING",
  success: "TIP",
  danger: "CAUTION",
};

const TAG_TO_VARIANT: Record<string, CalloutVariant> = {
  NOTE: "info",
  INFO: "info",
  WARNING: "warning",
  WARN: "warning",
  TIP: "success",
  SUCCESS: "success",
  CAUTION: "danger",
  DANGER: "danger",
  IMPORTANT: "warning",
};

export { VARIANT_TO_TAG, TAG_TO_VARIANT };

// ── Node class ────────────────────────────────────────────────────

export class CalloutNode extends ElementNode {
  __variant: CalloutVariant;

  static getType(): string {
    return "callout";
  }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__variant, node.__key);
  }

  constructor(variant: CalloutVariant, key?: NodeKey) {
    super(key);
    this.__variant = variant;
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__variant = prevNode.__variant;
  }

  // ── Getters / Setters ─────────────────────────────────────────

  getVariant(): CalloutVariant {
    return this.getLatest().__variant;
  }

  setVariant(variant: CalloutVariant): this {
    const writable = this.getWritable();
    writable.__variant = variant;
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
    const div = document.createElement("div");
    const theme = config.theme;
    const className = theme.callout;
    if (typeof className === "string") {
      div.className = className;
    }
    div.dataset.variant = this.__variant;
    return div;
  }

  updateDOM(prevNode: CalloutNode, dom: HTMLElement): boolean {
    if (prevNode.__variant !== this.__variant) {
      dom.dataset.variant = this.__variant;
    }
    return false;
  }

  // ── JSON serialization ────────────────────────────────────────

  exportJSON(): SerializedCalloutNode {
    return {
      ...super.exportJSON(),
      type: "callout",
      version: 1,
      variant: this.__variant,
    };
  }

  static importJSON(serializedNode: SerializedCalloutNode): CalloutNode {
    return $createCalloutNode({ variant: serializedNode.variant });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedCalloutNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createCalloutNode(
  payload: CalloutPayload = {},
): CalloutNode {
  return new CalloutNode(payload.variant ?? "info", payload.key);
}

export function $isCalloutNode(
  node: unknown,
): node is CalloutNode {
  return node instanceof CalloutNode;
}
