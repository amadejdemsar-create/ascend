/**
 * Formula engine lexer.
 *
 * Tokenizes a formula expression string into a Token array.
 * Handles numbers (integers, decimals, scientific notation),
 * strings (single/double quoted with escape sequences),
 * identifiers, keywords (and, or, not), operators, and punctuation.
 */

import { FormulaError } from "./errors";

// ── Token types ────────────────────────────────────────────────────────

export type Token =
  | { type: "NUMBER"; value: number; pos: number }
  | { type: "STRING"; value: string; pos: number }
  | { type: "IDENT"; value: string; pos: number }
  | {
      type: "OPERATOR";
      value:
        | "+"
        | "-"
        | "*"
        | "/"
        | "%"
        | "=="
        | "!="
        | "<"
        | "<="
        | ">"
        | ">=";
      pos: number;
    }
  | { type: "KEYWORD"; value: "and" | "or" | "not"; pos: number }
  | { type: "LPAREN"; pos: number }
  | { type: "RPAREN"; pos: number }
  | { type: "COMMA"; pos: number }
  | { type: "EOF"; pos: number };

const KEYWORDS = new Set(["and", "or", "not"]);

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentChar(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

// ── Lexer ──────────────────────────────────────────────────────────────

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];

    // Skip whitespace
    if (isWhitespace(ch)) {
      i++;
      continue;
    }

    // Numbers
    if (isDigit(ch) || (ch === "." && i + 1 < len && isDigit(source[i + 1]))) {
      const start = i;
      // Integer part
      while (i < len && isDigit(source[i])) i++;
      // Decimal part
      if (i < len && source[i] === "." && i + 1 < len && isDigit(source[i + 1])) {
        i++; // consume the dot
        while (i < len && isDigit(source[i])) i++;
      } else if (i < len && source[i] === "." && (i + 1 >= len || !isDigit(source[i + 1]))) {
        // Trailing dot with no digits after; still a valid number like "3."
        i++;
      }
      // Scientific notation
      if (i < len && (source[i] === "e" || source[i] === "E")) {
        i++;
        if (i < len && (source[i] === "+" || source[i] === "-")) i++;
        if (i >= len || !isDigit(source[i])) {
          throw new FormulaError(
            `Invalid number: incomplete scientific notation at position ${start}`,
            start,
          );
        }
        while (i < len && isDigit(source[i])) i++;
      }
      const numStr = source.slice(start, i);
      const value = parseFloat(numStr);
      if (!isFinite(value)) {
        throw new FormulaError(`Invalid number: ${numStr} at position ${start}`, start);
      }
      tokens.push({ type: "NUMBER", value, pos: start });
      continue;
    }

    // Strings (single or double quoted)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++; // skip opening quote
      let str = "";
      while (i < len && source[i] !== quote) {
        if (source[i] === "\\") {
          i++;
          if (i >= len) {
            throw new FormulaError(
              `Unterminated string: unexpected end after backslash at position ${start}`,
              start,
            );
          }
          const escaped = source[i];
          switch (escaped) {
            case "n":
              str += "\n";
              break;
            case "t":
              str += "\t";
              break;
            case "\\":
              str += "\\";
              break;
            case "'":
              str += "'";
              break;
            case '"':
              str += '"';
              break;
            default:
              str += escaped;
              break;
          }
        } else {
          str += source[i];
        }
        i++;
      }
      if (i >= len) {
        throw new FormulaError(
          `Unterminated string starting at position ${start}`,
          start,
        );
      }
      i++; // skip closing quote
      tokens.push({ type: "STRING", value: str, pos: start });
      continue;
    }

    // Identifiers and keywords
    if (isIdentStart(ch)) {
      const start = i;
      while (i < len && isIdentChar(source[i])) i++;
      const word = source.slice(start, i);
      if (KEYWORDS.has(word)) {
        tokens.push({
          type: "KEYWORD",
          value: word as "and" | "or" | "not",
          pos: start,
        });
      } else {
        tokens.push({ type: "IDENT", value: word, pos: start });
      }
      continue;
    }

    // Multi-char operators
    if (ch === "=" && i + 1 < len && source[i + 1] === "=") {
      tokens.push({ type: "OPERATOR", value: "==", pos: i });
      i += 2;
      continue;
    }
    if (ch === "!" && i + 1 < len && source[i + 1] === "=") {
      tokens.push({ type: "OPERATOR", value: "!=", pos: i });
      i += 2;
      continue;
    }
    if (ch === "<" && i + 1 < len && source[i + 1] === "=") {
      tokens.push({ type: "OPERATOR", value: "<=", pos: i });
      i += 2;
      continue;
    }
    if (ch === ">" && i + 1 < len && source[i + 1] === "=") {
      tokens.push({ type: "OPERATOR", value: ">=", pos: i });
      i += 2;
      continue;
    }

    // Single-char operators
    if (ch === "+") {
      tokens.push({ type: "OPERATOR", value: "+", pos: i });
      i++;
      continue;
    }
    if (ch === "-") {
      tokens.push({ type: "OPERATOR", value: "-", pos: i });
      i++;
      continue;
    }
    if (ch === "*") {
      tokens.push({ type: "OPERATOR", value: "*", pos: i });
      i++;
      continue;
    }
    if (ch === "/") {
      tokens.push({ type: "OPERATOR", value: "/", pos: i });
      i++;
      continue;
    }
    if (ch === "%") {
      tokens.push({ type: "OPERATOR", value: "%", pos: i });
      i++;
      continue;
    }
    if (ch === "<") {
      tokens.push({ type: "OPERATOR", value: "<", pos: i });
      i++;
      continue;
    }
    if (ch === ">") {
      tokens.push({ type: "OPERATOR", value: ">", pos: i });
      i++;
      continue;
    }

    // Punctuation
    if (ch === "(") {
      tokens.push({ type: "LPAREN", pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", pos: i });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "COMMA", pos: i });
      i++;
      continue;
    }

    // Unknown character
    throw new FormulaError(
      `Unexpected character '${ch}' at position ${i}`,
      i,
    );
  }

  tokens.push({ type: "EOF", pos: i });
  return tokens;
}
