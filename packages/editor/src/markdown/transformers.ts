/**
 * Extended Markdown transformers for Ascend custom nodes.
 *
 * Builds on @lexical/markdown's TRANSFORMERS array with custom
 * transformers for WikiLink, Mention, Callout, Toggle, Embed,
 * Image, File, and AIBlock nodes.
 *
 * Wikilink parsing leverages parseWikilinks from @ascend/core for
 * the relation-type resolution logic.
 */

import {
  TRANSFORMERS as BASE_TRANSFORMERS,
  type ElementTransformer,
  type MultilineElementTransformer,
  type TextMatchTransformer,
  type Transformer,
} from "@lexical/markdown";
import {
  $createTextNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from "lexical";
import type { ContextLinkType } from "@ascend/core";

import {
  WikiLinkNode,
  $createWikiLinkNode,
  $isWikiLinkNode,
} from "../nodes/wikilink-node";
import {
  MentionNode,
  $createMentionNode,
  $isMentionNode,
  type MentionKind,
} from "../nodes/mention-node";
import {
  CalloutNode,
  $createCalloutNode,
  $isCalloutNode,
  VARIANT_TO_TAG,
  TAG_TO_VARIANT,
} from "../nodes/callout-node";
import {
  ToggleNode,
  $createToggleNode,
  $isToggleNode,
} from "../nodes/toggle-node";
import {
  EmbedNode,
  $createEmbedNode,
  $isEmbedNode,
} from "../nodes/embed-node";
import {
  ImageNode,
  $createImageNode,
  $isImageNode,
} from "../nodes/image-node";
import {
  FileNode,
  $createFileNode,
  $isFileNode,
} from "../nodes/file-node";
import {
  AIBlockNode,
  $createAIBlockNode,
  $isAIBlockNode,
} from "../nodes/ai-block-node";

// ── Relation token lookup ─────────────────────────────────────────

const VALID_RELATIONS = new Set<string>([
  "REFERENCES",
  "EXTENDS",
  "CONTRADICTS",
  "SUPPORTS",
  "EXAMPLE_OF",
  "DERIVED_FROM",
  "SUPERSEDES",
  "APPLIES_TO",
  "PART_OF",
]);

function resolveRelation(token: string | undefined): ContextLinkType {
  if (!token) return "REFERENCES";
  const upper = token.toUpperCase();
  if (VALID_RELATIONS.has(upper)) return upper as ContextLinkType;
  return "REFERENCES";
}

// ── WikiLink transformer (text-match, inline) ─────────────────────

const WIKILINK_TRANSFORMER: TextMatchTransformer = {
  dependencies: [WikiLinkNode],
  type: "text-match",
  trigger: "[",
  // Matches [[Title]] and [[relation:Title]]
  importRegExp: /\[\[(?:([a-z_]+):)?([^\]]+)\]\]/i,
  regExp: /\[\[(?:([a-z_]+):)?([^\]]+)\]\]$/i,
  replace: (textNode: TextNode, match: RegExpMatchArray): void => {
    const [, relationToken, title] = match;
    const relation = resolveRelation(relationToken);
    const node = $createWikiLinkNode({
      relation,
      targetTitle: (title ?? "").trim(),
      targetEntryId: null,
    });
    textNode.replace(node);
  },
  export: (
    node: LexicalNode,
  ): string | null => {
    if (!$isWikiLinkNode(node)) return null;
    const rel = node.getRelation();
    const title = node.getTargetTitle();
    if (rel === "REFERENCES") return `[[${title}]]`;
    return `[[${rel.toLowerCase()}:${title}]]`;
  },
};

// ── Mention transformer (text-match, inline) ──────────────────────

const VALID_MENTION_KINDS = new Set<string>(["user", "goal", "todo"]);

const MENTION_TRANSFORMER: TextMatchTransformer = {
  dependencies: [MentionNode],
  type: "text-match",
  trigger: "@",
  // Matches @kind:label (e.g. @user:John, @goal:Ship v1)
  importRegExp: /@(user|goal|todo):([^\s@[\]]+(?:\s[^\s@[\]]+)*)/i,
  regExp: /@(user|goal|todo):([^\s@[\]]+(?:\s[^\s@[\]]+)*)$/i,
  replace: (textNode: TextNode, match: RegExpMatchArray): void => {
    const [, kindStr, label] = match;
    const kind = VALID_MENTION_KINDS.has(kindStr?.toLowerCase() ?? "")
      ? (kindStr!.toLowerCase() as MentionKind)
      : "user";
    const node = $createMentionNode({
      kind,
      targetId: "",
      label: (label ?? "").trim(),
    });
    textNode.replace(node);
  },
  export: (
    node: LexicalNode,
  ): string | null => {
    if (!$isMentionNode(node)) return null;
    return `@${node.getKind()}:${node.getLabel()}`;
  },
};

// ── Callout transformer (multiline-element) ───────────────────────
// GitHub-style admonition: > [!NOTE]\n> Content

const CALLOUT_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [CalloutNode],
  type: "multiline-element",
  regExpStart: /^>\s*\[!(NOTE|INFO|WARNING|WARN|TIP|SUCCESS|CAUTION|DANGER|IMPORTANT)\]\s*$/i,
  regExpEnd: {
    regExp: /^(?!>\s)/, // Ends when a line doesn't start with >
    optional: true,
  },
  replace: (
    rootNode: ElementNode,
    _children: Array<LexicalNode> | null,
    startMatch: Array<string>,
    _endMatch: Array<string> | null,
    linesInBetween: Array<string> | null,
  ): void => {
    const tagStr = startMatch[1]?.toUpperCase() ?? "NOTE";
    const variant = TAG_TO_VARIANT[tagStr] ?? "info";
    const callout = $createCalloutNode({ variant });

    // Parse the body lines (strip the leading > prefix)
    if (linesInBetween && linesInBetween.length > 0) {
      const bodyText = linesInBetween
        .map((line) => line.replace(/^>\s?/, ""))
        .join("\n")
        .trim();
      if (bodyText) {
        const textNode = $createTextNode(bodyText);
        callout.append(textNode);
      }
    }

    rootNode.replace(callout);
  },
  export: (
    node: LexicalNode,
    traverseChildren: (node: ElementNode) => string,
  ): string | null => {
    if (!$isCalloutNode(node)) return null;
    const tag = VARIANT_TO_TAG[node.getVariant()];
    const content = traverseChildren(node);
    const lines = content.split("\n");
    const quotedBody = lines.map((line) => `> ${line}`).join("\n");
    return `> [!${tag}]\n${quotedBody}`;
  },
};

// ── Toggle transformer (multiline-element) ────────────────────────
// HTML <details>: <details>\n<summary>Title</summary>\nContent\n</details>

const TOGGLE_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [ToggleNode],
  type: "multiline-element",
  regExpStart: /^<details>\s*$/i,
  regExpEnd: /^<\/details>\s*$/i,
  replace: (
    rootNode: ElementNode,
    _children: Array<LexicalNode> | null,
    _startMatch: Array<string>,
    _endMatch: Array<string> | null,
    linesInBetween: Array<string> | null,
  ): void => {
    let summary = "Details";
    const bodyLines: string[] = [];

    if (linesInBetween) {
      for (const line of linesInBetween) {
        const summaryMatch = line.match(
          /^<summary>(.*?)<\/summary>\s*$/i,
        );
        if (summaryMatch) {
          summary = summaryMatch[1] ?? "Details";
        } else {
          bodyLines.push(line);
        }
      }
    }

    const toggle = $createToggleNode({ summary });
    const bodyText = bodyLines.join("\n").trim();
    if (bodyText) {
      const textNode = $createTextNode(bodyText);
      toggle.append(textNode);
    }

    rootNode.replace(toggle);
  },
  export: (
    node: LexicalNode,
    traverseChildren: (node: ElementNode) => string,
  ): string | null => {
    if (!$isToggleNode(node)) return null;
    const summary = node.getSummary();
    const content = traverseChildren(node);
    return `<details>\n<summary>${summary}</summary>\n${content}\n</details>`;
  },
};

// ���─ Embed transformer (element) ───────────��───────────────────────
// Markdown: [title](url) on its own line, prefixed with !embed

const EMBED_TRANSFORMER: ElementTransformer = {
  dependencies: [EmbedNode],
  type: "element",
  regExp: /^!embed\s+\[([^\]]*)\]\(([^)]+)\)\s*$/,
  replace: (
    parentNode: ElementNode,
    _children: Array<LexicalNode>,
    match: Array<string>,
  ): void => {
    const title = match[1] ?? null;
    const url = match[2] ?? "";
    const embed = $createEmbedNode({ url, title });
    parentNode.replace(embed);
  },
  export: (node: LexicalNode): string | null => {
    if (!$isEmbedNode(node)) return null;
    const title = node.getTitle() ?? node.getUrl();
    return `!embed [${title}](${node.getUrl()})`;
  },
};

// ── Image transformer (text-match) ────────────────────────────────
// Markdown: ![alt](src "caption")

const IMAGE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [ImageNode],
  type: "text-match",
  trigger: "!",
  importRegExp: /!\[([^\]]*)\]\(([^)"]+)(?:\s+"([^"]*)")?\)/,
  regExp: /!\[([^\]]*)\]\(([^)"]+)(?:\s+"([^"]*)")?\)$/,
  replace: (textNode: TextNode, match: RegExpMatchArray): void => {
    const alt = match[1] || null;
    const src = match[2] ?? "";
    const caption = match[3] || null;
    const node = $createImageNode({ src, alt, caption });
    textNode.replace(node);
  },
  export: (node: LexicalNode): string | null => {
    if (!$isImageNode(node)) return null;
    const alt = node.getAlt() ?? "";
    const src = node.getSrc();
    const caption = node.getCaption();
    if (caption) {
      return `![${alt}](${src} "${caption}")`;
    }
    return `![${alt}](${src})`;
  },
};

// ── File transformer (text-match) ─────────��───────────────────────
// Markdown: [file:fileId]

const FILE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [FileNode],
  type: "text-match",
  trigger: "[",
  importRegExp: /\[file:([a-zA-Z0-9_-]+)\]/,
  regExp: /\[file:([a-zA-Z0-9_-]+)\]$/,
  replace: (textNode: TextNode, match: RegExpMatchArray): void => {
    const fileId = match[1] ?? "";
    const node = $createFileNode({ fileId });
    textNode.replace(node);
  },
  export: (node: LexicalNode): string | null => {
    if (!$isFileNode(node)) return null;
    return `[file:${node.getFileId()}]`;
  },
};

// ── AIBlock transformer (multiline-element) ───────────────────────
// Markdown: ```ai\nprompt text\n```

const AI_BLOCK_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [AIBlockNode],
  type: "multiline-element",
  regExpStart: /^```ai\s*$/,
  regExpEnd: /^```\s*$/,
  replace: (
    rootNode: ElementNode,
    _children: Array<LexicalNode> | null,
    _startMatch: Array<string>,
    _endMatch: Array<string> | null,
    linesInBetween: Array<string> | null,
  ): void => {
    const prompt = linesInBetween ? linesInBetween.join("\n").trim() : "";
    const aiBlock = $createAIBlockNode({ prompt });
    rootNode.replace(aiBlock);
  },
  export: (node: LexicalNode): string | null => {
    if (!$isAIBlockNode(node)) return null;
    const prompt = node.getPrompt();
    if (node.getAIState() === "done" && node.getResult()) {
      // If the AI block has produced a result, export the result as plain text
      return node.getResult();
    }
    return `\`\`\`ai\n${prompt}\n\`\`\``;
  },
};

// ── Combined transformer array ────────────────────────────────────

/**
 * Full transformer set for Ascend. Includes all @lexical/markdown
 * built-in transformers plus custom transformers for Ascend nodes.
 *
 * Custom transformers are added BEFORE the base transformers so that
 * Ascend-specific patterns (wikilinks, mentions, images) are matched
 * before generic patterns (links).
 *
 * KNOWN: Image transformer must be checked before the base LINK
 * transformer to avoid ![alt](url) being parsed as a regular link.
 */
export const TRANSFORMERS: Array<Transformer> = [
  // Custom element/multiline transformers (checked first)
  CALLOUT_TRANSFORMER,
  TOGGLE_TRANSFORMER,
  AI_BLOCK_TRANSFORMER,
  EMBED_TRANSFORMER,
  // Custom text-match transformers
  WIKILINK_TRANSFORMER,
  MENTION_TRANSFORMER,
  IMAGE_TRANSFORMER,
  FILE_TRANSFORMER,
  // Base @lexical/markdown transformers (paragraphs, headings, lists, code, etc.)
  ...BASE_TRANSFORMERS,
];

// Named exports for individual transformers (for testing and selective use)
export {
  WIKILINK_TRANSFORMER,
  MENTION_TRANSFORMER,
  CALLOUT_TRANSFORMER,
  TOGGLE_TRANSFORMER,
  EMBED_TRANSFORMER,
  IMAGE_TRANSFORMER,
  FILE_TRANSFORMER,
  AI_BLOCK_TRANSFORMER,
};
