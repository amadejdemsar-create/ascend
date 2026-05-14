/**
 * Next.js instrumentation hook (runs once on server startup).
 *
 * Wave 8b: verify that the three JWT/secret env vars are distinct and
 * sufficiently long. This catches operator errors where the same value
 * was pasted into multiple env slots. Logs warnings and errors but does
 * NOT crash the process; an operator can fix env and redeploy without a
 * hard outage.
 */

export async function register() {
  const secrets: Record<string, string | undefined> = {
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
    CRDT_JWT_SECRET: process.env.CRDT_JWT_SECRET,
    CRDT_PERSIST_SECRET: process.env.CRDT_PERSIST_SECRET,
  };

  for (const [name, value] of Object.entries(secrets)) {
    if (!value) {
      console.warn(`[startup] ${name} is not set`);
      continue;
    }
    if (value.length < 32) {
      console.error(
        `[startup] ${name} is shorter than 32 characters (${value.length} chars)`,
      );
    }
  }

  // Check that all present secrets are distinct
  const present = Object.entries(secrets).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
  );
  const values = present.map(([, v]) => v);
  if (new Set(values).size !== values.length) {
    // Identify which secrets share values
    const seen = new Map<string, string[]>();
    for (const [name, value] of present) {
      const existing = seen.get(value);
      if (existing) {
        existing.push(name);
      } else {
        seen.set(value, [name]);
      }
    }
    const duplicates = [...seen.values()]
      .filter((names) => names.length > 1)
      .map((names) => names.join(" and "));
    console.error(
      `[startup] DUPLICATE secrets detected: ${duplicates.join("; ")}. AUTH_JWT_SECRET, CRDT_JWT_SECRET, and CRDT_PERSIST_SECRET must all be distinct strings.`,
    );
  }
}
