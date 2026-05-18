/**
 * Resolve a user-supplied id-or-prefix to a full entity id.
 *
 * Ascend uses cuid-style ids (~25 chars) which are awkward to type in
 * full. Most CLI commands let users pass any leading substring of an
 * id; this helper finds the unique match in a candidate list.
 *
 * Rules:
 *   - Exact match wins immediately.
 *   - Otherwise, prefix-match against the `idField` of every candidate.
 *   - If exactly one match, return its id.
 *   - If zero matches, throw "no match" via the caller's `notFound` factory.
 *   - If multiple matches, throw "ambiguous" via the caller's `ambiguous`
 *     factory with the matched ids so the user can disambiguate.
 *
 * The caller controls the error factories so we can produce
 * domain-specific messages without coupling this helper to a specific
 * error class.
 */

import { CliUsageError } from "../errors.js";

export function resolveIdPrefix<T extends { id: string }>(args: {
  query: string;
  candidates: T[];
  idField?: keyof T;
  /** Human-readable label for error messages (e.g., "todo", "goal"). */
  label: string;
}): T {
  const idField = (args.idField ?? "id") as keyof T;
  const query = args.query.trim();
  if (!query) {
    throw new CliUsageError(`${args.label} id cannot be empty`);
  }

  // Exact match wins.
  const exact = args.candidates.find((c) => c[idField] === query);
  if (exact) return exact;

  // Prefix match. Cuids start with "c" so a single-char query is
  // useless; we still allow it for testing but it almost certainly
  // matches everything.
  const prefixed = args.candidates.filter((c) => {
    const id = c[idField];
    return typeof id === "string" && id.startsWith(query);
  });

  if (prefixed.length === 0) {
    throw new CliUsageError(
      `No ${args.label} found matching "${query}". Run \`ascend ${args.label} list\` to see options.`,
    );
  }

  if (prefixed.length > 1) {
    const matches = prefixed
      .slice(0, 5)
      .map((c) => String(c[idField]))
      .join(", ");
    throw new CliUsageError(
      `Ambiguous ${args.label} id "${query}". Matches: ${matches}. Pass a longer prefix or the full id.`,
    );
  }

  return prefixed[0]!;
}
