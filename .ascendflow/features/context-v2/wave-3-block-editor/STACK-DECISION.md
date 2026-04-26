# Wave 3 Stack Decision

**Verified:** 26. 4. 2026 by Phase 1 web-check via npm registry API (registry.npmjs.org)
**Re-verify if:** plan paused > 30 days

## Versions to pin

| Package | Version | Source | Notes |
|---|---|---|---|
| lexical | 0.43.0 | npm registry | Published 2026-04-09. Zero peer deps. Zero runtime deps. |
| @lexical/react | 0.43.0 | npm registry | Lockstep with core. Peer deps: react >=17.x, react-dom >=17.x. Lives in `apps/web` only. |
| @lexical/yjs | 0.43.0 | npm registry | Lockstep with core. Peer dep: yjs >=13.5.22. No react/react-dom peer dep. |
| @lexical/code | 0.43.0 | npm registry | Lockstep with core. No peer deps. |
| @lexical/list | 0.43.0 | npm registry | Lockstep with core. No peer deps. |
| @lexical/markdown | 0.43.0 | npm registry | Lockstep with core. No peer deps. |
| @lexical/link | 0.43.0 | npm registry | Lockstep with core. No peer deps. |
| @lexical/rich-text | 0.43.0 | npm registry | Lockstep with core. No peer deps. |
| @lexical/utils | 0.43.0 | npm registry | Lockstep with core. No peer deps. |
| yjs | 13.6.30 | npm registry | Published 2026-03-14. Dep: lib0. No peer deps. |
| y-protocols | 1.0.7 | npm registry | Published 2025-12-16. Peer dep: yjs ^13.0.0. |

## Peer-dep verification

- `@lexical/yjs` peer deps: `yjs >=13.5.22` only.
  - Does it require `react-dom`? **No.** The npm registry shows zero React peer deps on `@lexical/yjs`.
  - The `react-dom` requirement comes from `@lexical/react`, which is the React binding layer.
  - Consequence: `packages/editor` can safely depend on `lexical`, `@lexical/yjs`, `@lexical/code`, `@lexical/list`, `@lexical/markdown`, `@lexical/link`, `@lexical/rich-text`, `@lexical/utils`, and `yjs` without pulling in any React dependency. The React binding (`@lexical/react`, `LexicalComposer`, plugins) stays in `apps/web`.

- `@lexical/react` peer deps: `react >=17.x`, `react-dom >=17.x`.
  - This package lives exclusively in `apps/web`. It is NOT added to `packages/editor`.
  - `@lexical/react` bundles `@lexical/yjs` as a regular dependency (not peer), so the web app gets the collaboration plugin transitively.

## API surface check

- `$convertFromMarkdownString` / `$convertToMarkdownString` from `@lexical/markdown`: **still the canonical API.** Confirmed on lexical.dev/docs/packages/lexical-markdown (26. 4. 2026).
- Custom transformers via `TRANSFORMERS` array: **still the pattern.** Four transformer types: ELEMENT, TEXT_FORMAT, TEXT_MATCH, MULTILINE_ELEMENT.
- DecoratorNode / DecoratorBlockNode classes: **still the extend pattern** for custom non-editable inline/block nodes.
- `LexicalComposer` is still the top-level React wrapper accepting `initialConfig`.
- `CollaborationPlugin` from `@lexical/react` + `providerFactory` is the Yjs binding surface. The `@lexical/yjs` package provides the lower-level Yjs doc binding.

## Decisions

1. **Yjs storage strategy:** Full state blob (single BYTEA column). Rationale: single-user HTTP autosave in Wave 3; append-only log adds complexity for compaction that only pays off under real-time collaboration (Wave 8). The Yjs doc is reconstructed from the full state on each sync; incremental updates are applied and the full state is re-persisted. 1 MiB hard cap at both DB (CHECK constraint) and application layer.

2. **Where the Yjs binding lives:** `@lexical/yjs` (no React peer dep) can live in `packages/editor` for node defs and Markdown round-trip. The React collaboration plugin (`CollaborationPlugin` from `@lexical/react`) lives in `apps/web` only. This is a clean split: `packages/editor` exports framework-free node definitions, theme, transformers, and text extraction; `apps/web` owns the React binding, autosave plugin, and Yjs provider wiring.

3. **Snapshot regeneration:** Every save. Rationale: documents are small (typical entry is 1-50 blocks, well under 100 KiB snapshot). Regenerating the JSON snapshot on each Yjs state persist is cheap and keeps the read path (API, MCP, SSR) simple with no stale-snapshot risk. Background job only needed if profiling shows save latency issues.

## Open items deferred to Phase 2

- Exact split of which `@lexical/*` packages go into `packages/editor/package.json` vs `apps/web/package.json`. The rule is: anything with a React peer dep stays in `apps/web`; everything else goes in `packages/editor`.
- `y-protocols` inclusion: only needed if the Yjs awareness protocol is used (cursor positions for collaboration). Defer to Wave 8. Not installed in Phase 2.
