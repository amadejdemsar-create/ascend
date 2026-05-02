/**
 * Formula engine recursive-descent parser.
 *
 * Grammar (precedence from lowest to highest):
 *
 *   Expr      := OrExpr
 *   OrExpr    := AndExpr ('or' AndExpr)*
 *   AndExpr   := NotExpr ('and' NotExpr)*
 *   NotExpr   := 'not' NotExpr | CmpExpr
 *   CmpExpr   := AddExpr (('==' | '!=' | '<' | '<=' | '>' | '>=') AddExpr)?
 *   AddExpr   := MulExpr (('+' | '-') MulExpr)*
 *   MulExpr   := UnaryExpr (('*' | '/' | '%') UnaryExpr)*
 *   UnaryExpr := '-' UnaryExpr | Primary
 *   Primary   := NUMBER | STRING | 'true' | 'false'
 *               | IDENT '(' (Expr (',' Expr)*)? ')'   [function call]
 *               | IDENT                                 [bare ident -> error]
 *               | '(' Expr ')'
 *
 * prop("Name") is parsed as a function call and normalized to a PropRef node.
 */

import type { Token } from "./lexer";
import { tokenize } from "./lexer";
import type { AstNode, BinaryOp, UnaryOp } from "./ast";
import { countNodes } from "./ast";
import { FormulaError } from "./errors";
import { hasFunction, validateFunctionCall } from "./functions";

const MAX_AST_NODES = 1000;

export type ParseResult =
  | { ok: true; ast: AstNode }
  | { ok: false; error: FormulaError };

// ── Parser state ───────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    this.pos++;
    return tok;
  }

  private expect(type: Token["type"], message?: string): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new FormulaError(
        message ?? `Expected ${type}, got ${tok.type} at position ${tok.pos}`,
        tok.pos,
      );
    }
    return this.advance();
  }

  // ── Entry point ─────────────────────────────────────────────────────

  parse(): AstNode {
    const ast = this.parseExpr();
    const remaining = this.peek();
    if (remaining.type !== "EOF") {
      throw new FormulaError(
        `Unexpected token '${this.tokenValue(remaining)}' at position ${remaining.pos}`,
        remaining.pos,
      );
    }
    // Size cap check
    const nodeCount = countNodes(ast);
    if (nodeCount > MAX_AST_NODES) {
      throw new FormulaError(
        `Expression too large (${nodeCount} nodes, max ${MAX_AST_NODES})`,
        0,
      );
    }
    return ast;
  }

  private tokenValue(tok: Token): string {
    if ("value" in tok) return String(tok.value);
    return tok.type;
  }

  // ── Grammar rules ───────────────────────────────────────────────────

  private parseExpr(): AstNode {
    return this.parseOr();
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (
      this.peek().type === "KEYWORD" &&
      (this.peek() as { value: string }).value === "or"
    ) {
      this.advance();
      const right = this.parseAnd();
      left = { type: "Binary", op: "or" as BinaryOp, left, right };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseNot();
    while (
      this.peek().type === "KEYWORD" &&
      (this.peek() as { value: string }).value === "and"
    ) {
      this.advance();
      const right = this.parseNot();
      left = { type: "Binary", op: "and" as BinaryOp, left, right };
    }
    return left;
  }

  private parseNot(): AstNode {
    if (
      this.peek().type === "KEYWORD" &&
      (this.peek() as { value: string }).value === "not"
    ) {
      this.advance();
      const operand = this.parseNot();
      return { type: "Unary", op: "not" as UnaryOp, operand };
    }
    return this.parseComparison();
  }

  private parseComparison(): AstNode {
    const left = this.parseAdd();
    const tok = this.peek();
    if (
      tok.type === "OPERATOR" &&
      (tok.value === "==" ||
        tok.value === "!=" ||
        tok.value === "<" ||
        tok.value === "<=" ||
        tok.value === ">" ||
        tok.value === ">=")
    ) {
      const op = tok.value as BinaryOp;
      this.advance();
      const right = this.parseAdd();
      return { type: "Binary", op, left, right };
    }
    return left;
  }

  private parseAdd(): AstNode {
    let left = this.parseMul();
    while (true) {
      const tok = this.peek();
      if (tok.type === "OPERATOR" && (tok.value === "+" || tok.value === "-")) {
        const op = tok.value as BinaryOp;
        this.advance();
        const right = this.parseMul();
        left = { type: "Binary", op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMul(): AstNode {
    let left = this.parseUnary();
    while (true) {
      const tok = this.peek();
      if (
        tok.type === "OPERATOR" &&
        (tok.value === "*" || tok.value === "/" || tok.value === "%")
      ) {
        const op = tok.value as BinaryOp;
        this.advance();
        const right = this.parseUnary();
        left = { type: "Binary", op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): AstNode {
    const tok = this.peek();
    if (tok.type === "OPERATOR" && tok.value === "-") {
      this.advance();
      const operand = this.parseUnary();
      return { type: "Unary", op: "-" as UnaryOp, operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const tok = this.peek();

    // Number literal
    if (tok.type === "NUMBER") {
      this.advance();
      return { type: "NumberLiteral", value: tok.value };
    }

    // String literal
    if (tok.type === "STRING") {
      this.advance();
      return { type: "StringLiteral", value: tok.value };
    }

    // Parenthesized expression
    if (tok.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpr();
      this.expect("RPAREN", `Expected ')' at position ${this.peek().pos}`);
      return expr;
    }

    // Identifiers: true, false, function calls, or bare idents
    if (tok.type === "IDENT") {
      const name = tok.value;
      this.advance();

      // Boolean literals
      if (name === "true") return { type: "BooleanLiteral", value: true };
      if (name === "false") return { type: "BooleanLiteral", value: false };

      // Function call
      if (this.peek().type === "LPAREN") {
        this.advance(); // consume '('
        const args: AstNode[] = [];
        if (this.peek().type !== "RPAREN") {
          args.push(this.parseExpr());
          while (this.peek().type === "COMMA") {
            this.advance();
            args.push(this.parseExpr());
          }
        }
        this.expect(
          "RPAREN",
          `Expected ')' after function arguments at position ${this.peek().pos}`,
        );

        // Special case: prop("Name") -> PropRef
        if (name === "prop") {
          if (args.length !== 1) {
            throw new FormulaError(
              `prop() expects exactly 1 argument, got ${args.length}`,
              tok.pos,
            );
          }
          if (args[0].type !== "StringLiteral") {
            throw new FormulaError(
              `prop() argument must be a string literal`,
              tok.pos,
            );
          }
          return { type: "PropRef", name: args[0].value };
        }

        // Validate function exists and arity
        if (!hasFunction(name)) {
          throw new FormulaError(`Unknown function: ${name}`, tok.pos);
        }
        const arityErr = validateFunctionCall(name, args.length);
        if (arityErr) {
          throw new FormulaError(arityErr, tok.pos);
        }

        return { type: "Call", name, args };
      }

      // Bare identifier without parens (not a boolean) is an error
      throw new FormulaError(
        `Unexpected identifier '${name}' at position ${tok.pos}. Did you mean ${name}() or prop("${name}")?`,
        tok.pos,
      );
    }

    // Nothing matched
    throw new FormulaError(
      `Unexpected token at position ${tok.pos}`,
      tok.pos,
    );
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export function parseFormula(source: string): ParseResult {
  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return { ok: true, ast };
  } catch (error) {
    if (error instanceof FormulaError) {
      return { ok: false, error };
    }
    // Unexpected errors wrapped
    return {
      ok: false,
      error: new FormulaError(
        error instanceof Error ? error.message : String(error),
        -1,
      ),
    };
  }
}
