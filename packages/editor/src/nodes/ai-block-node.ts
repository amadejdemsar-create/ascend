/**
 * AIBlockNode: block-level decorator for AI-generated content.
 *
 * Stores a prompt, execution state, and optional result. When triggered,
 * the web binding calls llmService.chat (Wave 2 substrate) and replaces
 * this node with the generated content blocks.
 *
 * RUNTIME RENDERING: see apps/web/components/editor/ai-block.tsx (Phase 6).
 * This node's decorate() returns null; the web binding overrides with an
 * interactive prompt input + loading state.
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

export type AIBlockState = "idle" | "running" | "done";

export type SerializedAIBlockNode = Spread<
  {
    prompt: string;
    state: AIBlockState;
    result: string | null;
  },
  SerializedLexicalNode
>;

export interface AIBlockPayload {
  prompt?: string;
  aiState?: AIBlockState;
  result?: string | null;
  key?: NodeKey;
}

// ── Node class ────────────────────────────────────────────────────

export class AIBlockNode extends DecoratorNode<null> {
  __prompt: string;
  __aiState: AIBlockState;
  __result: string | null;

  static getType(): string {
    return "ai-block";
  }

  static clone(node: AIBlockNode): AIBlockNode {
    return new AIBlockNode(
      node.__prompt,
      node.__aiState,
      node.__result,
      node.__key,
    );
  }

  constructor(
    prompt: string,
    aiState: AIBlockState,
    result: string | null,
    key?: NodeKey,
  ) {
    super(key);
    this.__prompt = prompt;
    this.__aiState = aiState;
    this.__result = result;
  }

  // ── Getters ───────────────────────────────────────────────────

  getPrompt(): string {
    return this.getLatest().__prompt;
  }

  getAIState(): AIBlockState {
    return this.getLatest().__aiState;
  }

  getResult(): string | null {
    return this.getLatest().__result;
  }

  // ── Setters ───────────────────────────────────────────────────

  setPrompt(prompt: string): this {
    const writable = this.getWritable();
    writable.__prompt = prompt;
    return writable;
  }

  setAIState(aiState: AIBlockState): this {
    const writable = this.getWritable();
    writable.__aiState = aiState;
    return writable;
  }

  setResult(result: string | null): this {
    const writable = this.getWritable();
    writable.__result = result;
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
    if (this.__result) {
      return this.__result;
    }
    return this.__prompt ? `[AI: ${this.__prompt}]` : "[AI Block]";
  }

  // ── DOM ───────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    const theme = config.theme;
    const className = theme.aiBlock;
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

  exportJSON(): SerializedAIBlockNode {
    return {
      ...super.exportJSON(),
      type: "ai-block",
      version: 1,
      prompt: this.__prompt,
      state: this.__aiState,
      result: this.__result,
    };
  }

  static importJSON(serializedNode: SerializedAIBlockNode): AIBlockNode {
    return $createAIBlockNode({
      prompt: serializedNode.prompt,
      aiState: serializedNode.state,
      result: serializedNode.result,
    });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedAIBlockNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createAIBlockNode(
  payload: AIBlockPayload = {},
): AIBlockNode {
  return new AIBlockNode(
    payload.prompt ?? "",
    payload.aiState ?? "idle",
    payload.result ?? null,
    payload.key,
  );
}

export function $isAIBlockNode(
  node: unknown,
): node is AIBlockNode {
  return node instanceof AIBlockNode;
}
