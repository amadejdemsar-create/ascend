/**
 * Formula engine dependency extractor.
 *
 * Walks the AST and collects all property references (PropRef nodes).
 * Returns lowercase property names for case-insensitive cycle detection.
 *
 * Used by databaseFieldService.add and .update to detect circular
 * dependencies between FORMULA fields before persisting.
 */

import type { AstNode } from "./ast";

export function extractDependencies(ast: AstNode): string[] {
  const deps = new Set<string>();
  walk(ast, deps);
  return Array.from(deps);
}

function walk(node: AstNode, deps: Set<string>): void {
  switch (node.type) {
    case "NumberLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
      return;

    case "PropRef":
      deps.add(node.name.toLowerCase());
      return;

    case "Unary":
      walk(node.operand, deps);
      return;

    case "Binary":
      walk(node.left, deps);
      walk(node.right, deps);
      return;

    case "Call":
      for (const arg of node.args) {
        walk(arg, deps);
      }
      return;

    case "Conditional":
      walk(node.cond, deps);
      walk(node.thenBranch, deps);
      walk(node.elseBranch, deps);
      return;
  }
}
