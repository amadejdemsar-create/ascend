/**
 * Base error class for the formula engine.
 * Carries the character position where the error was detected.
 */
export class FormulaError extends Error {
  public readonly pos: number;

  constructor(message: string, pos: number = -1) {
    super(message);
    this.name = "FormulaError";
    this.pos = pos;
  }
}
