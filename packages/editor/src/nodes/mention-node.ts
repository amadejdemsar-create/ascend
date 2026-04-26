/**
 * MentionNode: inline decorator for @mentions.
 *
 * Supports three mention kinds: "user", "goal", "todo". Stores the target
 * ID and a display label. Renders as @label in Markdown.
 *
 * RUNTIME RENDERING: see apps/web/components/editor/mention-pill.tsx (Phase 6).
 * This node's decorate() returns null; the web binding overrides.
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

// ── Types ─────────────────────────────────────────────────────────

export type MentionKind = "user" | "goal" | "todo";

export type SerializedMentionNode = Spread<
  {
    kind: MentionKind;
    targetId: string;
    label: string;
  },
  SerializedLexicalNode
>;

export interface MentionPayload {
  kind: MentionKind;
  targetId: string;
  label: string;
  key?: NodeKey;
}

// ── Node class ────────────────────────────────────────────────────

export class MentionNode extends DecoratorNode<null> {
  __kind: MentionKind;
  __targetId: string;
  __label: string;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__kind,
      node.__targetId,
      node.__label,
      node.__key,
    );
  }

  constructor(
    kind: MentionKind,
    targetId: string,
    label: string,
    key?: NodeKey,
  ) {
    super(key);
    this.__kind = kind;
    this.__targetId = targetId;
    this.__label = label;
  }

  // ── Getters ───────────────────────────────────────────────────

  getKind(): MentionKind {
    return this.getLatest().__kind;
  }

  getTargetId(): string {
    return this.getLatest().__targetId;
  }

  getLabel(): string {
    return this.getLatest().__label;
  }

  // ── Inline behavior ───────────────────────────────────────────

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  // ── Text content ──────────────────────────────────────────────

  getTextContent(): string {
    return `@${this.__kind}:${this.__label}`;
  }

  // ── DOM ───────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    const theme = config.theme;
    const className = theme.mention;
    if (typeof className === "string") {
      span.className = className;
    }
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): null {
    return null;
  }

  // ── JSON serialization ────────────────────────────────────────

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      type: "mention",
      version: 1,
      kind: this.__kind,
      targetId: this.__targetId,
      label: this.__label,
    };
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    return $createMentionNode({
      kind: serializedNode.kind,
      targetId: serializedNode.targetId,
      label: serializedNode.label,
    });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedMentionNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createMentionNode(payload: MentionPayload): MentionNode {
  return new MentionNode(
    payload.kind,
    payload.targetId,
    payload.label,
    payload.key,
  );
}

export function $isMentionNode(
  node: unknown,
): node is MentionNode {
  return node instanceof MentionNode;
}
