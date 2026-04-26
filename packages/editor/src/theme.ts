/**
 * Lexical editor theme: class-name map for all node types.
 *
 * Class names are CSS hooks consumed by:
 *   - apps/web/styles/editor.css (Phase 6), which maps them to
 *     @ascend/ui-tokens CSS variables.
 *   - Mobile (Wave 6) will provide a different theme map for
 *     native rendering.
 *
 * NO inline styles, NO hex literals, NO color values.
 * The theme is pure class-name mapping.
 */

import type { EditorThemeClasses } from "lexical";

export const EDITOR_THEME: EditorThemeClasses = {
  // ── Block elements ──────────────────────────────────────────
  paragraph: "editor-paragraph",
  heading: {
    h1: "editor-heading-h1",
    h2: "editor-heading-h2",
    h3: "editor-heading-h3",
    h4: "editor-heading-h4",
    h5: "editor-heading-h5",
    h6: "editor-heading-h6",
  },
  quote: "editor-quote",

  // ── Lists ───────────────────────────────────────────────────
  list: {
    ul: "editor-list-ul",
    ol: "editor-list-ol",
    listitem: "editor-list-item",
    nested: { listitem: "editor-list-item-nested" },
    listitemChecked: "editor-list-item-checked",
    listitemUnchecked: "editor-list-item-unchecked",
  },

  // ── Inline text formatting ──────────────────────────────────
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    code: "editor-text-code",
    highlight: "editor-text-highlight",
    subscript: "editor-text-subscript",
    superscript: "editor-text-superscript",
  },

  // ── Code blocks ─────────────────────────────────────────────
  code: "editor-code",
  codeHighlight: {
    keyword: "editor-token-keyword",
    string: "editor-token-string",
    number: "editor-token-number",
    comment: "editor-token-comment",
    function: "editor-token-function",
    operator: "editor-token-operator",
    punctuation: "editor-token-punctuation",
    variable: "editor-token-variable",
    atrule: "editor-token-atrule",
    attr: "editor-token-attr",
    boolean: "editor-token-boolean",
    builtin: "editor-token-builtin",
    cdata: "editor-token-cdata",
    char: "editor-token-char",
    class: "editor-token-class",
    "class-name": "editor-token-class-name",
    constant: "editor-token-constant",
    deleted: "editor-token-deleted",
    doctype: "editor-token-doctype",
    entity: "editor-token-entity",
    important: "editor-token-important",
    inserted: "editor-token-inserted",
    namespace: "editor-token-namespace",
    prolog: "editor-token-prolog",
    property: "editor-token-property",
    regex: "editor-token-regex",
    selector: "editor-token-selector",
    symbol: "editor-token-symbol",
    tag: "editor-token-tag",
    url: "editor-token-url",
  },

  // ── Links ───────────────────────────────────────────────────
  link: "editor-link",

  // ── Custom nodes (Ascend-specific) ──────────────────────────
  // EditorThemeClasses allows extra keys via index signature.
  wikilink: "editor-wikilink",
  mention: "editor-mention",
  aiBlock: "editor-ai-block",
  embed: "editor-embed",
  callout: "editor-callout",
  toggle: "editor-toggle",
  image: "editor-image",
  file: "editor-file",
};
