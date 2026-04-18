---
name: ax:cross-platform-check
description: Fast grep-based audit for banned imports and browser-only APIs in packages/*. Runs in under 30 seconds. Use this as a quick invariant check during development, after extracting code into a package, or before committing changes to shared code. For a deeper architectural audit, use the ascend-architect agent via ax:review.
user_invocable: true
---

# ax:cross-platform-check

Quick invariant check that all `packages/*` stay platform-agnostic. Runs a battery of grep patterns against every shared package and reports violations in a green/yellow/red format. Completes in under 30 seconds for the entire monorepo.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**This is a binary check: CLEAN or VIOLATIONS.** There is no "mostly clean." A single banned import in a shared package is a violation that must be fixed before the package ships to mobile or desktop.

## When to Use

- After extracting code from `apps/web/` into `packages/`
- After adding new imports to any file in `packages/`
- As a quick pre-commit check for changes touching `packages/`
- During Wave 0 to verify extractions are clean
- As part of `ax:deploy-check` (called automatically if packages/ exists)

## When NOT to use

- For a full architectural review (use `ascend-architect` agent)
- When `packages/` does not exist yet (monorepo not converted)
- For checking `apps/` code (app-level code is allowed to use platform-specific imports)

## Usage

- `ax:cross-platform-check` — check all packages
- `ax:cross-platform-check <package-name>` — check a single package (e.g., `ax:cross-platform-check core`)

## Workflow

### Step 1: Detect packages

```bash
cd /Users/Shared/Domain/Code/Personal/ascend
ls -d packages/*/src/ 2>/dev/null
```

If `packages/` does not exist or has no packages with `src/`, report:

```
ASCEND CROSS-PLATFORM CHECK
============================

Status: SKIPPED
Reason: No packages found. Monorepo conversion has not started (Wave 0 pending).

No action required.
```

Exit cleanly.

### Step 2: Run banned import patterns

For EACH package, run the following grep battery. Group results by package.

**Category A: React and UI framework imports (banned in all shared packages except ui-primitives)**

```bash
PKG="packages/<name>/src"

# React core
grep -rn "from ['\"]react['\"]" "$PKG" 2>/dev/null
grep -rn "from ['\"]react-dom" "$PKG" 2>/dev/null
grep -rn "from ['\"]react-native" "$PKG" 2>/dev/null

# React ecosystem
grep -rn "from ['\"]@tanstack/react-query" "$PKG" 2>/dev/null
grep -rn "from ['\"]@tanstack/react-table" "$PKG" 2>/dev/null
grep -rn "from ['\"]zustand" "$PKG" 2>/dev/null
grep -rn "from ['\"]@radix-ui" "$PKG" 2>/dev/null
grep -rn "from ['\"]lucide-react" "$PKG" 2>/dev/null
grep -rn "from ['\"]sonner" "$PKG" 2>/dev/null
grep -rn "from ['\"]class-variance-authority" "$PKG" 2>/dev/null
grep -rn "from ['\"]clsx" "$PKG" 2>/dev/null
```

**Category B: Next.js imports (banned in all shared packages)**

```bash
grep -rn "from ['\"]next/" "$PKG" 2>/dev/null
grep -rn "from ['\"]next['\"]" "$PKG" 2>/dev/null
grep -rn "\"use server\"" "$PKG" 2>/dev/null
grep -rn "\"use client\"" "$PKG" 2>/dev/null
```

**Category C: Expo/React Native imports (banned in non-mobile packages)**

```bash
grep -rn "from ['\"]expo" "$PKG" 2>/dev/null
grep -rn "from ['\"]@expo/" "$PKG" 2>/dev/null
grep -rn "from ['\"]react-native" "$PKG" 2>/dev/null
grep -rn "from ['\"]nativewind" "$PKG" 2>/dev/null
```

**Category D: Tauri/desktop imports (banned in non-desktop packages)**

```bash
grep -rn "from ['\"]@tauri-apps" "$PKG" 2>/dev/null
```

**Category E: Browser-only globals (banned in all shared packages)**

```bash
grep -rn "\bwindow\." "$PKG" 2>/dev/null | grep -v "// platform:" | grep -v "typeof window"
grep -rn "\bdocument\." "$PKG" 2>/dev/null | grep -v "// platform:" | grep -v "typeof document"
grep -rn "\bnavigator\." "$PKG" 2>/dev/null | grep -v "// platform:" | grep -v "typeof navigator"
grep -rn "\blocalStorage\b" "$PKG" 2>/dev/null | grep -v "// platform:"
grep -rn "\bsessionStorage\b" "$PKG" 2>/dev/null | grep -v "// platform:"
```

Note: `typeof window !== 'undefined'` checks are allowed (guard patterns). Direct usage of `window.*` is not. The `// platform:` comment is an escape hatch for documented exceptions.

**Category F: Tailwind / CSS class strings (banned in non-UI token packages)**

```bash
grep -rn "className" "$PKG" 2>/dev/null
grep -rn "tailwind\|@apply\|tw\`" "$PKG" 2>/dev/null
```

**Category G: DOM manipulation (banned in packages/graph)**

```bash
# Only check packages/graph specifically
if [ -d "packages/graph/src" ]; then
  grep -rn "from ['\"]d3-selection" "packages/graph/src" 2>/dev/null
  grep -rn "\.append\(.*svg\|\.append\(.*g\b\|\.selectAll\|\.select(" "packages/graph/src" 2>/dev/null
fi
```

### Step 3: Check package.json peerDeps correctness

For each package, verify that internal `@ascend/*` dependencies are in `peerDependencies`, not `dependencies`:

```bash
for pkg in packages/*/package.json; do
  INTERNAL_IN_DEPS=$(cat "$pkg" | python3 -c "import sys,json; d=json.load(sys.stdin); deps=d.get('dependencies',{}); print([k for k in deps if k.startswith('@ascend/')])" 2>/dev/null)
  if [ "$INTERNAL_IN_DEPS" != "[]" ]; then
    echo "VIOLATION: $pkg has @ascend/* in dependencies (should be peerDependencies): $INTERNAL_IN_DEPS"
  fi
done
```

### Step 4: Classify results

For each violation, classify the severity:

| Severity | Meaning | Example |
|----------|---------|---------|
| RED (blocker) | Package cannot work on target platform | `packages/core` imports `react`, `packages/graph` imports `d3-selection` |
| YELLOW (warning) | Package may work but violates the boundary contract | `typeof window` guard in a package that should never reference `window` at all |
| GREEN (clean) | No violations found for this package | |

### Step 5: Report

```
ASCEND CROSS-PLATFORM CHECK
============================

Date: D. M. YYYY
Packages scanned: N

Package results:
  @ascend/core: GREEN (0 violations)
  @ascend/api-client: RED (2 violations)
  @ascend/storage: YELLOW (1 warning)
  @ascend/ui-tokens: GREEN (0 violations)
  @ascend/graph: GREEN (0 violations)

VERDICT: CLEAN | VIOLATIONS FOUND (N red, M yellow)

Red violations (must fix):
1. [RED] packages/api-client/src/client.ts:23
   Category: B (Next.js imports)
   Import: from "next/headers"
   Fix: Remove next/headers import. Use the Authorization header from config, not cookies.

2. [RED] packages/api-client/src/client.ts:45
   Category: E (browser globals)
   Usage: window.location.origin as base URL
   Fix: Accept baseUrl as a constructor parameter instead of reading from window.

Yellow warnings (should fix):
3. [YELLOW] packages/storage/src/index.ts:12
   Category: E (browser globals)
   Usage: typeof window !== 'undefined' in the main export
   Note: Guard pattern is acceptable in storage/web.ts but should not be in index.ts.
   Fix: Move the guard to the platform-specific implementation.

Dep graph:
  @ascend/core → (none)
  @ascend/api-client → @ascend/core (peer)
  @ascend/storage → (none)
  @ascend/ui-tokens → (none)
  @ascend/graph → (none)
  Circular deps: NONE

Summary: <one sentence>
```

## Escape Hatch: Documented Platform Exceptions

Some packages legitimately need to detect the platform at runtime (e.g., `packages/storage` needs to know whether to use `localStorage` or `SecureStore`). These are allowed IF and ONLY IF:

1. The usage is in a platform-specific file (`web.ts`, `native.ts`), not in the main export (`index.ts`)
2. The usage has a `// platform: <justification>` comment on the same line
3. The grep patterns in this skill explicitly exclude lines with `// platform:` comments

Example of a valid exception:
```typescript
// packages/storage/src/web.ts
const value = localStorage.getItem(key); // platform: web-only storage adapter
```

Example of an INVALID exception:
```typescript
// packages/storage/src/index.ts
if (typeof window !== 'undefined') {  // NOT OK: platform detection in main export
  return new WebStorage();
}
```

The main export should use dependency injection or a factory pattern, not runtime platform detection.

## Rules

- **ALWAYS check ALL packages, not just the one that changed.** A change to `@ascend/core` types can break consumers.
- **ALWAYS classify as RED, YELLOW, or GREEN.** No ambiguous "maybe" verdicts.
- **ALWAYS include the exact file path, line number, and the specific import or usage.** Not just "some file in packages/core has a react import."
- **NEVER ignore a RED violation.** RED means the package will not work on at least one target platform. It must be fixed.
- **NEVER auto-fix.** Report violations; let `ascend-dev` or the user fix them.

## Forbidden Phrases When Red Violations Exist

If ANY RED violation exists, you may NOT say:
- "Clean" / "All good" / "Compliant" / "Platform-agnostic"
- "Minor issues" (a RED is not minor)

You MUST say:
- "VIOLATIONS FOUND. <N> red violations must be fixed. See report."

## Related Skills and Agents

- `ascend-architect` agent: deeper architectural audit (boundaries, workspace config, dep graph analysis)
- `ax:package` skill: scaffolds a new package with correct constraints
- `ax:test`: run after fixing violations to verify the build passes
- `ax:deploy-check`: includes a cross-platform check step when packages/ exists
