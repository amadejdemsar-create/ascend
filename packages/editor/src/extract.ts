/**
 * Plain-text extractor for Lexical serialized editor state.
 *
 * Walks the serialized JSON tree without instantiating a Lexical editor.
 * Used by the service layer to populate ContextEntry.extractedText
 * for the search_vector tsvector index.
 *
 * Pure function. No editor instance, no DOM, no side effects.
 */

interface SerializedNode {
  type: string;
  text?: string;
  children?: SerializedNode[];
  // Custom node fields for text extraction
  targetTitle?: string;
  label?: string;
  prompt?: string;
  result?: string | null;
  url?: string;
  title?: string | null;
  summary?: string;
  alt?: string | null;
  caption?: string | null;
  src?: string;
  fileId?: string;
}

interface SerializedState {
  root?: SerializedNode;
}

/**
 * Extract plain text from a serialized Lexical editor state.
 *
 * Recursively flattens text nodes, inserts newlines between block
 * elements, and extracts meaningful text from custom nodes (wikilink
 * titles, mention labels, AI block results, embed titles, etc.).
 *
 * @param serializedState - The JSON output of editorState.toJSON().
 * @returns Plain text string suitable for full-text search indexing.
 */
export function extractText(serializedState: unknown): string {
  if (!serializedState || typeof serializedState !== "object") return "";

  const state = serializedState as SerializedState;
  const root = state.root;
  if (!root) return "";

  const parts: string[] = [];
  extractFromNode(root, parts);

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines
    .trim();
}

function extractFromNode(node: SerializedNode, parts: string[]): void {
  // Text node: direct text content
  if (node.type === "text" && typeof node.text === "string") {
    parts.push(node.text);
    return;
  }

  // Linebreak node
  if (node.type === "linebreak") {
    parts.push("\n");
    return;
  }

  // WikiLink: extract the target title
  if (node.type === "wikilink" && node.targetTitle) {
    parts.push(node.targetTitle);
    return;
  }

  // Mention: extract the label
  if (node.type === "mention" && node.label) {
    parts.push(node.label);
    return;
  }

  // AI Block: prefer result, fall back to prompt
  if (node.type === "ai-block") {
    if (node.result) {
      parts.push(node.result);
    } else if (node.prompt) {
      parts.push(node.prompt);
    }
    return;
  }

  // Embed: extract title and URL
  if (node.type === "embed") {
    if (node.title) parts.push(node.title);
    if (node.url) parts.push(` ${node.url}`);
    return;
  }

  // Callout: extract children with variant context
  if (node.type === "callout") {
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        extractFromNode(child, parts);
      }
    }
    parts.push("\n");
    return;
  }

  // Toggle: extract summary and children
  if (node.type === "toggle") {
    if (node.summary) {
      parts.push(node.summary);
      parts.push("\n");
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        extractFromNode(child, parts);
      }
    }
    parts.push("\n");
    return;
  }

  // Image: extract alt and caption
  if (node.type === "image") {
    if (node.alt) parts.push(node.alt);
    if (node.caption) parts.push(` ${node.caption}`);
    return;
  }

  // File: minimal text
  if (node.type === "file") {
    return;
  }

  // Block-level elements: recurse into children, add newline after
  const isBlock = isBlockNode(node.type);

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      extractFromNode(child, parts);
    }
  }

  if (isBlock) {
    parts.push("\n");
  }
}

function isBlockNode(type: string): boolean {
  return [
    "root",
    "paragraph",
    "heading",
    "quote",
    "code",
    "list",
    "listitem",
  ].includes(type);
}
