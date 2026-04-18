---
name: ax:package
description: Scaffold a new monorepo package under packages/* with correct structure, package.json, tsconfig, exports, and cross-platform constraints. Use this when adding a new shared package for the Ascend monorepo (e.g., packages/graph, packages/editor, packages/llm). Runs the ascend-architect agent after scaffolding to verify compliance.
user_invocable: true
---

# ax:package

Scaffolds a new package in the Ascend monorepo under `packages/<name>`. Every package follows the same structure: `package.json` with correct name, exports, and scripts; `tsconfig.json` extending the base; a `src/` directory with `index.ts`; and cross-platform constraints documented inline.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**Mandatory before scaffolding:**
1. Read `/Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/context-v2/VISION.md` section 3 for the monorepo structure and package roles
2. Check whether the package already exists: `ls /Users/Shared/Domain/Code/Personal/ascend/packages/<name>/ 2>/dev/null`
3. Verify `pnpm-workspace.yaml` includes `packages/*` in its glob

## When to Use

- Adding a new shared package during Wave 0 or later (e.g., `packages/core`, `packages/api-client`, `packages/storage`, `packages/ui-tokens`, `packages/graph`, `packages/editor`, `packages/llm`, `packages/sync`)
- Extracting shared code from `apps/web/lib/` into a package
- Creating a utility package for cross-platform use

## When NOT to use

- For app-level code that is platform-specific (that goes in `apps/web/`, `apps/mobile/`, or `apps/desktop/`)
- For one-off scripts or tools (those go in `scripts/` at the repo root)
- For test utilities (those go in `test/` or alongside the test files)

## Usage

- `ax:package <name>` — scaffold a package named `@ascend/<name>`
- `ax:package <name> --purpose "<description>"` — include the purpose in generated docs

## Workflow

### Step 1: Gather package information

Ask the user (or derive from context):
1. **Name:** kebab-case, no `@ascend/` prefix (that is added automatically). Example: `core`, `api-client`, `graph`.
2. **Purpose:** one-sentence description. Example: "Typed fetch wrapper shared by web, mobile, and desktop clients."
3. **Platform constraints:** which platforms will consume this package? (web, mobile, desktop, all). This determines the banned import list.
4. **Dependencies:** any external npm packages needed? (e.g., `d3-force` for graph, `zod` for core)
5. **Internal dependencies:** does this package depend on other `@ascend/*` packages? (e.g., `api-client` depends on `core`)

### Step 2: Verify monorepo infrastructure

```bash
# Check pnpm-workspace.yaml exists
cat /Users/Shared/Domain/Code/Personal/ascend/pnpm-workspace.yaml

# Check tsconfig.base.json exists
cat /Users/Shared/Domain/Code/Personal/ascend/tsconfig.base.json 2>/dev/null

# List existing packages for context
ls /Users/Shared/Domain/Code/Personal/ascend/packages/ 2>/dev/null
```

If `pnpm-workspace.yaml` does not exist or does not include `packages/*`, stop and tell the user: "The monorepo infrastructure is not set up yet. Run Wave 0 first, or create pnpm-workspace.yaml manually."

If `tsconfig.base.json` does not exist, the skill will create a minimal base config alongside the package.

### Step 3: Create the package directory structure

```bash
mkdir -p /Users/Shared/Domain/Code/Personal/ascend/packages/<name>/src
```

### Step 4: Generate package.json

Write to `/Users/Shared/Domain/Code/Personal/ascend/packages/<name>/package.json`:

```json
{
  "name": "@ascend/<name>",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "description": "<purpose from Step 1>",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    <external deps from Step 1>
  },
  "peerDependencies": {
    <internal @ascend/* deps from Step 1>
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

Notes on the template:
- `"private": true` because monorepo packages are not published to npm
- `"type": "module"` for ESM
- `exports` uses TypeScript source directly (Turborepo or the consuming bundler handles compilation)
- Internal dependencies go in `peerDependencies` so the workspace resolves them, not the package
- `"typescript": "catalog:"` uses pnpm catalogs if configured, otherwise use the workspace root version

### Step 5: Generate tsconfig.json

Write to `/Users/Shared/Domain/Code/Personal/ascend/packages/<name>/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src/**/*.ts"]
}
```

If `tsconfig.base.json` does not exist yet, create a minimal one at the repo root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

### Step 6: Generate src/index.ts

Write to `/Users/Shared/Domain/Code/Personal/ascend/packages/<name>/src/index.ts`:

```typescript
/**
 * @ascend/<name>
 *
 * <purpose from Step 1>
 *
 * Platform constraints:
 * - This package is consumed by: <web | mobile | desktop | all>
 * - Banned imports: <list based on platform>
 * - See .claude/agents/ascend-architect.md for the full boundary rules
 */

// Export your public API here
export {};
```

The platform constraints comment is important. It is the first thing a developer (or agent) reads when opening the package.

### Step 7: Generate platform constraint docs

Based on the platform constraints from Step 1, determine the banned import list:

**For packages consumed by ALL platforms (web + mobile + desktop):**
```
Banned: react, react-dom, react-native, next/*, @tanstack/react-query,
        zustand, tailwindcss, @radix-ui/*, lucide-react, sonner,
        expo/*, @expo/*, @tauri-apps/*,
        window, document, navigator, localStorage, sessionStorage
```

**For packages consumed by web + mobile only:**
```
Banned: @tauri-apps/*, plus all of the above except react and react-native
        (since both web and mobile use React, but with different renderers)
```

**For packages consumed by web only:**
```
No platform bans (web-specific packages live in apps/web/, not packages/)
This package probably should NOT be in packages/ — flag for the user.
```

Write these constraints as a comment block in `src/index.ts` and also as a section in `package.json` under a custom `"ascend"` field:

```json
"ascend": {
  "platforms": ["web", "mobile", "desktop"],
  "bannedImports": ["react", "react-dom", "next/*", "..."]
}
```

### Step 8: Add the package as a dependency to consumers

Ask the user which apps or packages should consume this new package. For each consumer:

```bash
cd /Users/Shared/Domain/Code/Personal/ascend/apps/web && pnpm add @ascend/<name>@workspace:*
```

Or if the consumer is another package:
```bash
cd /Users/Shared/Domain/Code/Personal/ascend/packages/<consumer> && pnpm add --save-peer @ascend/<name>@workspace:*
```

### Step 9: Run pnpm install

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && pnpm install
```

This resolves the workspace link and makes `@ascend/<name>` importable in consumers.

### Step 10: Run the architect audit

Launch the `ascend-architect` agent to verify the new package complies with all boundary rules:

- No banned imports in `src/`
- `package.json` exports are correct
- `tsconfig.json` extends the base
- No circular dependencies introduced
- Workspace configuration is valid

If the architect returns NON-COMPLIANT, fix the issues before reporting success.

### Step 11: Type check

```bash
cd /Users/Shared/Domain/Code/Personal/ascend && npx tsc --noEmit 2>&1
```

### Step 12: Report

```
ASCEND PACKAGE CREATED
======================

Package: @ascend/<name>
Path: packages/<name>/
Purpose: <purpose>
Platforms: <web, mobile, desktop>
Dependencies: <external deps>
Internal deps: <@ascend/* deps>

Files created:
  packages/<name>/package.json
  packages/<name>/tsconfig.json
  packages/<name>/src/index.ts

Consumers updated:
  apps/web/package.json (added @ascend/<name>)
  packages/<consumer>/package.json (added @ascend/<name>)

Architect audit: COMPLIANT | NON-COMPLIANT (details)
TypeScript: PASS | FAIL (details)

Next steps:
1. Implement the package API in packages/<name>/src/
2. Import from consumers: import { ... } from "@ascend/<name>"
3. Run ax:test after implementation to verify the full build
```

## Package Templates by Role

These are the known packages from VISION.md section 3. Use these templates when creating each specific package.

### @ascend/core

```
Purpose: Zod schemas, TypeScript types, enums, business constants
Platforms: all
Dependencies: zod, date-fns, rrule
Internal deps: none (this is the leaf package)
Banned: everything except zod, date-fns, rrule, and pure TS
What to extract: lib/validations.ts schemas, lib/constants.ts, type definitions from Prisma models
```

### @ascend/api-client

```
Purpose: Typed fetch wrapper with auth header injection
Platforms: all
Dependencies: none (uses native fetch)
Internal deps: @ascend/core (for types)
Banned: next/*, react, axios, window.location
What to extract: the duplicated fetchJson from lib/hooks/use-*.ts
```

### @ascend/storage

```
Purpose: Platform-polymorphic storage adapter (localStorage on web, SecureStore on native)
Platforms: all (with platform-specific implementations)
Dependencies: none in the interface; expo-secure-store as optional peer
Internal deps: none
Banned: direct localStorage outside web.ts, direct SecureStore outside native.ts
What to extract: localStorage usage from lib/stores/ui-store.ts persistence
```

### @ascend/ui-tokens

```
Purpose: Design tokens (colors, spacing, typography, radii, shadows)
Platforms: all
Dependencies: none
Internal deps: none
Banned: react, tailwindcss, nativewind, any JSX
What to extract: color constants, spacing scale, typography scale
```

### @ascend/graph

```
Purpose: Platform-agnostic graph layout using d3-force
Platforms: all (renderers are app-specific)
Dependencies: d3-force
Internal deps: none
Banned: react, react-dom, reactflow, d3-selection, any DOM/canvas/SVG
What to extract: future graph view simulation logic
```

### @ascend/editor

```
Purpose: Shared Lexical node definitions and commands
Platforms: all (React bindings are app-specific)
Dependencies: lexical, @lexical/yjs, @lexical/markdown
Internal deps: @ascend/core (for types)
Banned: react-dom, @lexical/react (app-specific bindings)
What to extract: future block editor node types
```

### @ascend/llm

```
Purpose: LLMProvider interface + provider implementations
Platforms: server-only (called via API, not bundled in clients)
Dependencies: openai, @anthropic-ai/sdk (or equivalent)
Internal deps: @ascend/core (for types)
Banned: react, next/*, browser APIs
What to extract: future LLM integration for Context Map synthesis
```

## Rules

- **ALWAYS use `@ascend/` namespace** for package names. Consistency matters.
- **ALWAYS extend `tsconfig.base.json`.** Do not create standalone configs with duplicated compiler options.
- **ALWAYS include platform constraints** in the source code comment and `package.json` custom field.
- **ALWAYS run the architect audit** after creating a package. An unchecked package may have banned imports from the template or from copied code.
- **NEVER put platform-specific code in a shared package.** If code only runs on web, it belongs in `apps/web/`. If it only runs on mobile, it belongs in `apps/mobile/`.
- **ALWAYS use peerDependencies for internal `@ascend/*` deps.** This lets pnpm workspace resolution handle versions.
- **NEVER add `react` as a dependency to a non-UI package.** Only packages that export React components or hooks should depend on React, and even then, as a peerDependency.

## Related Skills and Agents

- `ascend-architect` agent: verifies the new package complies with all boundary rules
- `ax:cross-platform-check` skill: fast invariant check for banned imports across all packages
- `ax:test`: run after implementing the package to verify the full build
