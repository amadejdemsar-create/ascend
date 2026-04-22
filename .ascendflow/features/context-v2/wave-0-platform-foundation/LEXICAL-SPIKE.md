# Lexical Viability Spike — Decision Doc

**Date:** 22. 4. 2026
**Scope:** Wave 0 Phase 8. Decide whether Lexical is the editor foundation for Wave 3 (Context block editor) and Wave 6 (Expo mobile).
**Status:** DECIDED.

## TL;DR

**Lexical on web. NOT Lexical on native. Shared Markdown as the serialization format between platforms.**

Lexical is fundamentally web-only in April 2026. There is no `@lexical/react-native` package, no official roadmap for one, and the Meta team has been publicly silent on RN support since April 2023. The only production-proven path for Lexical on mobile is a WebView wrapper (Planable uses this approach), which inherits inferior keyboard and IME behavior vs. native inputs.

For Ascend, Wave 3 ships Lexical on web with full plugin depth (paragraph, heading, list, code, link, markdown import/export, wikilink pill, slash menu). Wave 6 ships a different editor on native — candidate: `react-native-enriched` (Software Mansion, actively maintained, native UX) — reading and writing the same Markdown that web does. The wikilink pill renders as native UI on mobile OR degrades gracefully to plain `[[Title]]` text, depending on Wave 6 design decisions.

## Spike scope adjustment

The original Phase 8 checklist (TASKS.md 8.1-8.8) called for building a minimal web demo under `apps/web/app/(app)/__spike-editor` and a parallel Expo sandbox. After the research phase (below), the web demo was skipped because:

1. The RN question is the load-bearing decision, and research answered it conclusively.
2. Lexical's web plugin surface is well-documented and production-tested at Meta (Facebook, Threads). Building a throwaway demo that would be deleted per 8.7 adds no evidence beyond what the docs already confirm.
3. The Wave 3 implementation (months away) will build the real editor; a spike demo is not a prerequisite for the go/no-go.

The Expo sandbox half (8.4) was skipped because Lexical is not viable on React Native; there is nothing to sandbox.

## Research (pulled 22. 4. 2026)

### Versions

- **`lexical`** v0.43.0 (9 April 2026). Monthly release cadence. Still pre-1.0 after 3+ years of development. Source: [github.com/facebook/lexical/releases](https://github.com/facebook/lexical/releases), [npmjs.com/package/lexical](https://www.npmjs.com/package/lexical).
- **`@lexical/react`** v0.43.0. Separate package, lockstep with core.
- **`@lexical/react-native`**: does not exist on npm.
- **`lexical-ios`** v0.2, pre-release, last commit 22 April 2026, explicitly labeled "no guarantee of support." Swift-only; no React Native bridge. Source: [github.com/facebook/lexical-ios](https://github.com/facebook/lexical-ios).
- **Lexical for Android**: not open-sourced.

### Official Lexical docs on RN

**Zero mention.** Mapped lexical.dev (130+ pages) and searched for "react native" and "mobile"; nothing. The canonical discussion is [GitHub Discussion #2410](https://github.com/facebook/lexical/discussions/2410). Quoted here:

- **amyworrall (Meta, April 2022):** "I'm leading a project to build native Lexical on iOS... the issue will be the completely different layout engine for TextKit on iOS compared with DOM/CSS."
- **acywatson (Lexical maintainer, April 2023):** "We did end up open-sourcing Lexical iOS... we also have an extremely basic android version, but I am still not confident about that or RN support being released into OSS in the near future."
- **May 2025:** community user asks "Still no plans for React Native support? Just asking" — 34 upvotes, zero maintainer reply.

The last maintainer statement on RN is from April 2023. Nearly three years of silence.

### Community approaches (WebView wrappers)

- **[Planable/react-native-lexical](https://github.com/Planable/react-native-lexical)**: 27 stars, last commit April 2024 (2 years stale), uses `react-native-webview` to host a Vite-built Lexical editor. Production use at Planable. Experimental playground, not a published npm package.
- **[strdr4605's WebView guide (Feb 2024)](https://strdr4605.com/how-to-set-up-lexical-editor-in-react-native)**: detailed reproduction of the Planable approach. Lexical maintainer offered to add it to official docs; the PR was never completed.
- **Expo DOM Components (`'use dom'`)**: comment on Discussion #2410 (Sept 2025) showed a demo. Another commenter clarified: "it's just a WebView" under the hood.

All three are variants of the same underlying pattern: host Lexical in a web engine inside a native shell.

### Known pain points (WebView approach)

1. **Keyboard behavior.** Delayed focus, keyboard overlapping content, no native keyboard avoidance. `react-native-keyboard-controller` mitigates but remains fragile.
2. **Text input feel.** WebView editing lacks native selection handles, native autocorrect UX, native haptics.
3. **Message bridge overhead.** Every editor state change needs JSON serialization across the RN-to-WebView `postMessage` bridge.
4. **Android IME composition.** Lexical v0.41.0 release notes specifically highlight IME and non-ASCII fixes for the web version. In a WebView on Android, these compound with the WebView's own IME issues.
5. **Build pipeline complexity.** Vite workspace + singlefile plugin + htmlString export; significant added complexity.

### Alternatives

- **Tiptap / ProseMirror**: web-only. Maintainers: "Tiptap won't support React Native (natively) anytime soon. ProseMirror is heavily reliant on the Browser DOM." Same WebView-only path.
- **Slate**: web-only core. Community RN effort became a WebView wrapper.
- **BlockNote**: ProseMirror/Tiptap-based. Web-only.
- **Remirror**: ProseMirror wrapper. Web-only.
- **react-native-enriched** (Software Mansion): genuinely native RN rich text. 1.2k stars, actively maintained (last commit 22 April 2026), v0.6.1, iOS + Android, New Architecture required. No web. The mirror-image problem: native-only, no web.

## Evaluated options

### Option (a) Full Lexical everywhere natively

**Viable: NO.** No RN binding layer exists. `lexical-ios` is Swift-only and pre-release. No credible signal a native RN Lexical will exist before Wave 6 (or ever). Zero further investment warranted.

### Option (b) Lexical on web + WebView on native

**Viable: YES, but inferior UX.** Only production-proven mobile path. Shared serialization free (same Lexical runs on both). Primary downside: keyboard, IME, and text input feel materially below native standard. Debugging is painful (debugging a web app inside a native shell).

### Option (c) Lexical on web + different editor on native + shared Markdown serialization — **CHOSEN**

**Viable: YES, and the safest option.** Wave 3 ships Lexical on web with full feature depth. Wave 6 ships `react-native-enriched` (or similar) on native. Both sides read and write Markdown as the portable format — Ascend already plans Markdown import/export for Lexical (required spike feature), so this is zero additional work on the web side. Users edit a context entry on web, sync, open on mobile, see the same document rendered natively. Divergence is constrained to complex node types (wikilinks), which can render as a plain `[[Title]]` Markdown token on mobile and as a pill on web. Acceptable for the single-user-per-workspace model; re-evaluate if Wave 8 multi-tenancy exposes cross-device edit-conflict scenarios.

## Decision

**Chosen: Option (c).**

### What this commits Wave 3 to

- `lexical@^0.43` + `@lexical/react@^0.43` on web.
- Node definitions: paragraph, heading (h1/h2/h3), list (ordered/unordered/task), code block, link, wikilink (custom node).
- Plugins: markdown import/export (Lexical built-in), slash menu (custom typeahead using `@lexical/react` hooks), wikilink plugin (custom node + serializer with `[[Title]]` ↔ pill rendering).
- Serialization: Markdown as the portable format on the wire and on disk. Lexical's internal JSON editor state is used only for ephemeral undo/redo, never sent to the client API or stored.
- Wrapper component (`ContextEditor`) that mounts the full stack and handles autosave to the Context API.

### What this commits Wave 6 to

- Native editor on Expo via `react-native-enriched` (tentative; re-evaluate at Wave 6 kickoff given fast-moving RN ecosystem).
- Shared Markdown serializer with web; round-trippable.
- Wikilink render strategy: either (i) implement a native Markdown-node → pill component using `react-native-enriched` custom nodes if the library supports them, or (ii) render `[[Title]]` as plain styled text with a tap handler that navigates to the linked entry. Decision deferred to Wave 6 design.

### Non-goals for Wave 3

- NO WebView wrapper for native. Deliberate: option (b) was rejected in favor of native UX on mobile.
- NO attempt to run Lexical on React Native in any form. Close off the exploration to reduce Wave 6 scope.
- NO native iOS rich text via `lexical-ios`. Bridge work would dwarf the editor.

## Risks and mitigations

- **Risk:** Markdown round-trip loses data for non-standard nodes (custom block types added later).
  **Mitigation:** Keep the node set minimal (the 6 node types above) through Wave 3. Any custom block that doesn't Markdown-serialize is deferred to a later polish wave with an explicit design decision.

- **Risk:** `react-native-enriched` is Wave 6 tentative; it may not meet needs when we get there.
  **Mitigation:** Re-evaluate at Wave 6 kickoff with a fresh 1-day spike. Ascend's web editor ships independently of mobile editor choice (they share only Markdown, which is stable regardless).

- **Risk:** Wikilink pill divergence creates visual inconsistency between web and mobile.
  **Mitigation:** Accept this in Wave 6. The alternative (WebView wrapper) trades this for a worse text input experience everywhere on mobile. The tradeoff is one-way in favor of option (c).

- **Risk:** Lexical might introduce a breaking change before Wave 3.
  **Mitigation:** Lexical has a monthly release cadence and is still pre-1.0. Pin to a known-good version during Wave 3 implementation. Monitor for 1.0 release which will signal API stabilization.

## Open questions (for Wave 3 planning, not blocking)

1. **Wave 3 will need a specific Lexical version pinned.** Recommend pinning to the latest stable at Wave 3 kickoff, not now, given the monthly release cadence.
2. **Wikilink pill interaction on mobile** is a Wave 6 design question. Current spike doesn't commit to a direction.
3. **Collaboration / CRDT** is out of scope for Wave 3 (yjs-style sync). If added in a future wave, it amplifies the web-vs-native divergence question; re-evaluate then.

## References

1. npm & GitHub: lexical v0.43.0 — https://www.npmjs.com/package/lexical, https://github.com/facebook/lexical/releases
2. npm: @lexical/react v0.43.0 — https://www.npmjs.com/package/@lexical/react
3. GitHub: lexical-ios (Swift) — https://github.com/facebook/lexical-ios
4. Official docs map (zero RN mentions) — https://lexical.dev
5. Canonical RN discussion (Meta silent since April 2023) — https://github.com/facebook/lexical/discussions/2410
6. Planable WebView wrapper (abandoned April 2024) — https://github.com/Planable/react-native-lexical
7. WebView integration guide (Feb 2024) — https://strdr4605.com/how-to-set-up-lexical-editor-in-react-native
8. Expo DOM Components guide — https://docs.expo.dev/guides/dom-components/
9. Tiptap maintainers on RN — https://github.com/ueberdosis/tiptap/discussions/3113
10. Slate RN effort — https://github.com/ianstormtaylor/slate/issues/1374
11. BlockNote — https://www.blocknotejs.org/
12. react-native-enriched (Software Mansion) — https://github.com/software-mansion/react-native-enriched
13. Ascend Wave 0 Phase 8 plan — .ascendflow/features/context-v2/wave-0-platform-foundation/TASKS.md lines 199-218
