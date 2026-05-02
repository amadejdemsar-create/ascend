/**
 * Formula engine AST node types.
 *
 * The AST is a discriminated union of all possible expression nodes.
 * Each node carries enough information to evaluate the expression
 * and extract property dependencies.
 */

export type BinaryOp =
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
  | ">="
  | "and"
  | "or";

export type UnaryOp = "-" | "not";

export type AstNode =
  | { type: "NumberLiteral"; value: number }
  | { type: "StringLiteral"; value: string }
  | { type: "BooleanLiteral"; value: boolean }
  | { type: "PropRef"; name: string }
  | { type: "Unary"; op: UnaryOp; operand: AstNode }
  | { type: "Binary"; op: BinaryOp; left: AstNode; right: AstNode }
  | { type: "Call"; name: string; args: AstNode[] }
  | {
      type: "Conditional";
      cond: AstNode;
      thenBranch: AstNode;
      elseBranch: AstNode;
    };

/**
 * Counts the total number of AST nodes in a tree.
 * Used to enforce the 1000-node size cap at parse time.
 */
export function countNodes(node: AstNode): number {
  switch (node.type) {
    case "NumberLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
    case "PropRef":
      return 1;
    case "Unary":
      return 1 + countNodes(node.operand);
    case "Binary":
      return 1 + countNodes(node.left) + countNodes(node.right);
    case "Call":
      return 1 + node.args.reduce((sum, arg) => sum + countNodes(arg), 0);
    case "Conditional":
      return (
        1 +
        countNodes(node.cond) +
        countNodes(node.thenBranch) +
        countNodes(node.elseBranch)
      );
  }
}
