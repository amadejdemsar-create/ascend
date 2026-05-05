/**
 * Fixture test runner for @ascend/diff.
 *
 * Run via: pnpm --filter @ascend/diff test:fixtures
 *
 * Walks test-fixtures/ directories, loads before/after/expected JSON for
 * each case, runs diffNodeVersions, and asserts output matches expected.
 * Exits with code 1 if any fixture fails.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { diffNodeVersions } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "..", "test-fixtures");

let pass = 0;
let fail = 0;
const failures: string[] = [];

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const kinds = readdirSync(FIXTURES_DIR).filter((name) =>
  statSync(join(FIXTURES_DIR, name)).isDirectory(),
);

for (const kind of kinds) {
  const kindDir = join(FIXTURES_DIR, kind);
  const cases = readdirSync(kindDir).filter((name) =>
    statSync(join(kindDir, name)).isDirectory(),
  );

  for (const c of cases) {
    const caseDir = join(kindDir, c);
    const before = JSON.parse(
      readFileSync(join(caseDir, "before.json"), "utf8"),
    );
    const after = JSON.parse(readFileSync(join(caseDir, "after.json"), "utf8"));

    const expectedPath = join(caseDir, "expected.json");
    let expected: unknown;
    try {
      expected = JSON.parse(readFileSync(expectedPath, "utf8"));
    } catch {
      console.log(`  SKIP  ${kind}/${c} (no expected.json)`);
      continue;
    }

    const result = diffNodeVersions({
      fromPayload: before.payload,
      toPayload: after.payload,
      nodeType: before.nodeType,
      propertyFieldDefs: before.propertyFieldDefs,
    });

    if (deepEqual(result, expected)) {
      pass++;
      console.log(`  PASS  ${kind}/${c}`);
    } else {
      fail++;
      failures.push(`${kind}/${c}`);
      console.log(`  FAIL  ${kind}/${c}`);
      console.log(
        `         expected: ${JSON.stringify(expected, null, 2).slice(0, 400)}`,
      );
      console.log(
        `         actual:   ${JSON.stringify(result, null, 2).slice(0, 400)}`,
      );
    }
  }
}

console.log(`\n${pass}/${pass + fail} fixtures passed.`);
if (fail > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
