/**
 * FileNode: block-level placeholder for file attachments.
 *
 * Stores a fileId referencing the File table (Wave 4 populates this).
 * Markdown serialization: [file:fileId] placeholder.
 *
 * RUNTIME RENDERING: see apps/web/components/editor/file-block.tsx (Wave 4).
 * This is a scaffold; Wave 4 adds the upload UI and file metadata display.
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

export type SerializedFileNode = Spread<
  {
    fileId: string;
  },
  SerializedLexicalNode
>;

export interface FilePayload {
  fileId: string;
  key?: NodeKey;
}

// ── Node class ────────────────────────────────────────────────────

export class FileNode extends DecoratorNode<null> {
  __fileId: string;

  static getType(): string {
    return "file";
  }

  static clone(node: FileNode): FileNode {
    return new FileNode(node.__fileId, node.__key);
  }

  constructor(fileId: string, key?: NodeKey) {
    super(key);
    this.__fileId = fileId;
  }

  // ── Getters ───────────────────────────────────────────────────

  getFileId(): string {
    return this.getLatest().__fileId;
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
    return `[file:${this.__fileId}]`;
  }

  // ── DOM ───────────────────────────────────────────────────────

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    const theme = config.theme;
    const className = theme.file;
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

  exportJSON(): SerializedFileNode {
    return {
      ...super.exportJSON(),
      type: "file",
      version: 1,
      fileId: this.__fileId,
    };
  }

  static importJSON(serializedNode: SerializedFileNode): FileNode {
    return $createFileNode({ fileId: serializedNode.fileId });
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedFileNode>,
  ): this {
    return super.updateFromJSON(serializedNode);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function $createFileNode(payload: FilePayload): FileNode {
  return new FileNode(payload.fileId, payload.key);
}

export function $isFileNode(
  node: unknown,
): node is FileNode {
  return node instanceof FileNode;
}
