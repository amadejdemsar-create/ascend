/**
 * Smoke-test script for Markdown round-trip.
 *
 * Run via: pnpm --filter @ascend/editor exec tsx src/__test__/round-trip.ts
 *
 * Tests that markdownToBlocks -> blocksToMarkdown produces equivalent
 * Markdown for a set of fixture inputs. Whitespace normalization is
 * applied before comparison.
 */

import { markdownToBlocks } from "../markdown/markdown-to-blocks";
import { blocksToMarkdown } from "../markdown/blocks-to-markdown";
import { extractText } from "../extract";
import type { SerializedEditorState } from "lexical";

// ── Fixtures ────────────────────────────────────────────────────────

interface Fixture {
  name: string;
  input: string;
  /** If true, expect the round-trip to NOT match perfectly (known limitation). */
  expectLossy?: boolean;
}

const fixtures: Fixture[] = [
  {
    name: "Simple paragraph",
    input: "Hello, this is a simple paragraph.",
  },
  {
    name: "Headings h1-h3",
    input: "# Heading 1\n\n## Heading 2\n\n### Heading 3",
  },
  {
    name: "Bullet list",
    input: "- Item one\n- Item two\n- Item three",
  },
  {
    name: "Numbered list",
    input: "1. First\n2. Second\n3. Third",
  },
  {
    name: "Code block with language",
    input: "```typescript\nconst x = 42;\nconsole.log(x);\n```",
  },
  {
    name: "Plain wikilink",
    input: "See [[My Note]] for details.",
  },
  {
    name: "Typed wikilink",
    input: "Based on [[supports:Research Paper]] evidence.",
  },
  {
    name: "Bold and italic",
    input: "This is **bold** and *italic* text.",
  },
  {
    name: "Inline code",
    input: "Use the `markdownToBlocks` function.",
  },
  {
    name: "Blockquote",
    input: "> This is a quote\n> spanning two lines",
  },
  {
    name: "Image",
    input: '![A screenshot](https://example.com/img.png "Caption here")',
  },
  {
    name: "Mixed content",
    input: [
      "# My Document",
      "",
      "A paragraph with **bold** and *italic*.",
      "",
      "- Bullet one",
      "- Bullet two",
      "",
      "See [[Related Note]] for more.",
    ].join("\n"),
  },
];

// ── Normalization ───────────────────────────────────────────────────

function normalize(md: string): string {
  return md
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Runner ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let knownLossy = 0;

console.log("=== @ascend/editor Markdown Round-Trip Tests ===\n");

for (const fixture of fixtures) {
  const { name, input, expectLossy } = fixture;

  try {
    // Step 1: Markdown -> Blocks
    const blocks = markdownToBlocks(input);

    // Step 2: Blocks -> Markdown
    const output = blocksToMarkdown(blocks as SerializedEditorState);

    // Step 3: Compare
    const normalizedInput = normalize(input);
    const normalizedOutput = normalize(output);

    if (normalizedInput === normalizedOutput) {
      console.log(`  PASS  ${name}`);
      passed++;
    } else if (expectLossy) {
      console.log(`  KNOWN ${name} (expected lossy)`);
      console.log(`    Input:  ${JSON.stringify(normalizedInput).slice(0, 80)}`);
      console.log(`    Output: ${JSON.stringify(normalizedOutput).slice(0, 80)}`);
      knownLossy++;
    } else {
      console.log(`  FAIL  ${name}`);
      console.log(`    Input:  ${JSON.stringify(normalizedInput).slice(0, 120)}`);
      console.log(`    Output: ${JSON.stringify(normalizedOutput).slice(0, 120)}`);
      failed++;
    }

    // Step 4: Verify extractText produces non-empty output
    const text = extractText(blocks);
    if (!text || text.trim().length === 0) {
      console.log(`  WARN  ${name}: extractText returned empty string`);
    }
  } catch (err) {
    console.log(`  ERROR ${name}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${knownLossy} known lossy ===`);

if (failed > 0) {
  process.exit(1);
}
