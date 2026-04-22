# Phase 6 Auth Spike: Decision Doc

**Date:** 2026-04-22
**Scope:** W0 Phase 6.1 / 6.2. Pick Better-Auth or NextAuth v5 + custom JWT refresh for Ascend's token auth layer.
**Status:** DECIDED

## TL;DR

**Neither library. Build a custom auth service (~500 lines) on top of the existing Session model.** Both Better-Auth and NextAuth v5 mandate their own database schema (user, session, account, verification tables) that would run alongside or require extensive adapter mapping onto Ascend's purpose-built `Session` model (Phase 3 designed it specifically for Phase 6's custom rotation + reuse detection). NextAuth v5 has been in beta for 2+ years and does not support React Native clients. Better-Auth has a high security advisory cadence (26 advisories, incl. critical 2FA bypass April 2026) and would require us to layer its schema on top of the one we already built. The biggest tradeoff is owning security maintenance (password hashing, JWT sign/verify, CSRF) instead of delegating it to a library, but the surface area is small (email/password only, no OAuth) and the `ascend-security` agent will audit the implementation.

## Versions evaluated (pulled 2026-04-22)

- `better-auth`: v1.6.6 (stable, released 2026-04-21) [1]
- `next-auth` (Auth.js v5): v5.0.0-beta.31 (still beta, not stable) [2]

## Scoring matrix

| Criterion | Better-Auth v1.6.6 | NextAuth v5-beta.31 | Custom (chosen) | Notes |
|-----------|---------------------|---------------------|------------------|-------|
| Next.js 16 App Router | Native: route handler via `toNextJsHandler`, proxy.ts for Next 16+ [3] | Native: route handler + `proxy.ts` rename for Next 16 [4] | Native: standard route handlers | Both libs have Next 16 support; custom needs no framework glue |
| Refresh rotation + reuse detection over existing Session model | No native refresh tokens; cookie-based sessions with optional cookie caching [5]. Would need to ignore its session table and wire custom rotation on top. | JWT or DB strategy, no built-in rotation/reuse detection [6]. Rotation is a DIY callback. | Full control: `familyId` + `refreshTokenHash` on existing Session model, rotation + reuse detection per TASKS.md 6.3 spec | Both libs would require ignoring their session primitives and building rotation ourselves anyway |
| React Native / Expo Bearer support | Official `@better-auth/expo` package [7]; Bearer plugin intercepts `Authorization` header [8] | No official RN/Expo support [9]; no Bearer token mechanism documented | Custom `authenticate()` reads cookie OR Bearer header; Expo sends Bearer [10] | Better-Auth has the Expo story; NextAuth does not. Custom is trivial since we control the header parsing. |
| Community + docs | 27.9k GitHub stars, active releases (6 in April 2026), comprehensive docs [1] | Massive community (next-auth is the historic standard), but v5 is STILL beta after 2+ years [2][4] | N/A (our code) | Better-Auth is newer but shipping fast. NextAuth v5 beta status is a red flag for production use. |
| License | MIT [11] | ISC [12] | N/A | Both permissive; no issue |
| **API key coexistence** | Bearer plugin is scoped to Better-Auth's own router (mounted at `app/api/auth/[...all]/route.ts` via `toNextJsHandler`). Does NOT intercept other API routes. Invalid tokens fail silently (return undefined, no 401). [8][17] | No Bearer mechanism; cookie-only on web [6] | `authenticate()` tries JWT verify first, falls back to API key DB lookup. Zero ambiguity. [10] | Initial analysis flagged this as a deal-breaker for Better-Auth. Source code probe (see Probe note below) refuted that. All three approaches can coexist with API key auth on `/api/mcp` and other routes. No longer a discriminator. |
| **Existing schema fit** | Mandates 4 tables: user, session, account, verification. Column names customizable via `modelName`/`fields` [13], but required columns differ from ours (e.g., session needs `token` not `refreshTokenHash`; user needs `emailVerified`, `image`). | Mandates 4 tables: User, Account, Session, VerificationToken. Prisma adapter requires specific column sets [14]. | Uses existing User + Session models as-is. Only adds `passwordHash` column (6.4). | Both libs would require either (a) adding their 4 tables alongside ours (schema bloat, two session systems) or (b) extensive adapter customization to map to our existing models. Neither path is simpler than custom. |

## Decision

**Chosen:** Custom auth service (no external auth library).

**Reasoning:**

1. **Schema fit is the decisive factor.** We already have a Session model with `familyId`, `refreshTokenHash`, `revokedAt`, `userAgent`, `ipAddress`, `deviceName`, all indexed. Both libraries would ignore this model and require their own session table, or demand non-trivial adapter work to map onto it. The Session model was designed in Phase 3 specifically to support Phase 6's custom rotation logic.

2. **Phase 3 Session model intent.** We deliberately designed the `Session` model in Phase 3 (`familyId`, `refreshTokenHash` unique index, `revokedAt`, device metadata, proper indexes) as the foundation for Phase 6's custom rotation + reuse detection. Using Better-Auth means either running its 4 tables alongside ours (schema bloat, two parallel session systems) or bending our model to its required column shape via extensive `modelName`/`fields` adapter mapping. Both paths waste the Phase 3 design work.

3. **NextAuth v5 is still beta.** After 2+ years, `next-auth@5.0.0-beta.31` has not reached stable [2]. Depending on a beta for a production auth layer introduces upgrade churn risk. Auth.js v4 (stable) does not support Next.js 16 App Router natively.

4. **Better-Auth has a heavy security advisory surface.** 26 advisories on GitHub, including a critical 2FA bypass (April 2026) and multiple high-severity issues (account takeover via trusted origins bypass, unauthenticated API key creation, path normalization bypass) [15]. For a single-user system where we control the entire surface, the attack vectors these patches address are less relevant, but the advisory velocity suggests a rapidly evolving and not-yet-hardened codebase.

5. **The custom surface area is small and well-scoped.** Email/password only (no OAuth, no social login, no magic links). Three routes (`login`, `refresh`, `logout`), one service (`authService`), one middleware upgrade. The TASKS.md 6.3 through 6.15 spec already defines the exact implementation shape. No library integration work, no adapter debugging, no schema migration conflicts.

**What this commits us to (implementation shape for 6.3 through 6.15):**

- `authService` at `apps/web/lib/services/auth-service.ts` owns session creation, rotation, revocation, JWT signing/verification, and password hashing (scrypt via Node.js `crypto.scrypt`, no external dependency).
- `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` are standard Next.js route handlers following the existing auth-parse-service-respond pattern.
- `validateApiKey` stays as-is. A new `authenticate(request)` function wraps it: checks `Authorization: Bearer` header as API key first, then checks `access_token` cookie as JWT. Exported alongside `validateApiKey` for backward compatibility.
- `passwordHash String?` added to User via migration (6.4). No other schema changes needed; Session model is already complete.
- Cookie settings: `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Access token: 15-min JWT. Refresh token: 256-bit random hex, 30-day expiry, stored as SHA-256 hash in Session.
- Wave 6 Expo client sends `Authorization: Bearer <accessTokenJWT>` (not API key). The `authenticate()` function will need a third branch: try API key lookup, then try JWT verification from header, then try JWT from cookie. This is a minor extension of 6.9.

## Risks and mitigations

- **Risk: We own password hashing correctness.** Mitigation: use Node.js built-in `crypto.scrypt` (OWASP-recommended when Argon2 is unavailable), with salt length >= 16 bytes and key length >= 32 bytes. No external dependency. Code review via `ascend-security` agent.

- **Risk: We own CSRF protection for cookie-based auth.** Mitigation: `SameSite=Lax` cookies block cross-origin POST by default. State-changing routes already require `Content-Type: application/json` (non-simple request, triggers CORS preflight). For extra safety, add `Origin` header validation in `authenticate()`. Better-Auth uses the same approach [16].

- **Risk: No OAuth/social login path.** Mitigation: not needed for Ascend's single-user model. If multi-user or social login becomes a requirement in a future wave, that is the point to reconsider a library. The custom auth service is isolated enough (~250 lines) that swapping it later is a 1-day task, not a rewrite.

- **Risk: Wave 6 Expo client needs Bearer JWT, not just Bearer API key.** Mitigation: extend `authenticate()` with a three-way check (API key, JWT from header, JWT from cookie). The JWT is self-describing (has `exp`, `sub` claims), so it can be distinguished from an API key (which is a plain cuid) by attempting `jwt.verify` first and falling back to API key lookup on failure.

## Resolved during spike (2026-04-22)

1. **Password hashing algorithm: scrypt.** Decided. TASKS.md 6.6 originally specified `bcrypt.compare`; it will be updated in the Phase 6 plan to use `crypto.scrypt` (Node.js built-in, no `bcrypt` npm dependency, OWASP-acceptable when Argon2 is unavailable). Recommended parameters: `N=2^17` (131072), `r=8`, `p=1`, salt length 16 bytes, key length 64 bytes. `ascend-security` reviews the exact parameters during the 6.3 implementation audit.

2. **Wave 6 Bearer disambiguation: JWT-first.** Decided. The new `authenticate()` function tries `jwt.verify(token, accessSecret)` first (in-memory, <1ms, fails immediately on malformed tokens), falls back to `userService.findByApiKey(token)` on verification failure. API key requests add ~1ms of wasted JWT parsing overhead; acceptable. The verify-first order also means a leaked API key cannot be silently re-used as a JWT (since it won't verify), preserving existing MCP security posture.

## Probe note (2026-04-22)

The original draft of this doc cited Better-Auth's Bearer plugin as a deal-breaker on the assumption it intercepted all `Authorization: Bearer` headers globally. That assumption was false. Source code probe against `better-auth/better-auth@main`, file `packages/better-auth/src/plugins/bearer/index.ts`, confirmed:

- The plugin's `before` hook is registered inside Better-Auth's internal `better-call` router (`packages/better-auth/src/api/index.ts:280`), which only processes requests dispatched via `toNextJsHandler`. In a typical Next.js setup this is a single catch-all route, e.g., `app/api/auth/[...all]/route.ts`. Ascend's 37 other routes (`/api/goals`, `/api/todos`, `/api/mcp`, etc.) never enter this router.
- When the plugin does run and receives a Bearer token that fails HMAC-SHA-256 signature verification, the hook `return`s (lines 79-85 of the plugin), which is a silent pass-through. The plugin does not 401 on invalid tokens; Better-Auth's session resolver simply sees no session. Test fixture at line 68-77 (`"should work if valid cookie is provided even if authorization header isn't valid"`) confirms this.

The verdict does not flip because the remaining factors (schema fit, Phase 3 Session model intent, NextAuth v5 beta, Better-Auth advisory cadence, small custom surface) are still decisive. But the "API key coexistence" row in the matrix and the earlier reasoning bullet have been corrected to match the source. Leaving the probe note for future re-readers so the correction is visible, not silent.

## References

1. https://github.com/better-auth/better-auth/releases: v1.6.6 released 2026-04-21, 27.9k stars, MIT license
2. https://github.com/nextauthjs/next-auth/blob/main/packages/next-auth/package.json: v5.0.0-beta.31, still beta
3. https://www.better-auth.com/docs/integrations/next: Next.js 16+ proxy support, `toNextJsHandler` for App Router
4. https://authjs.dev/getting-started/installation: `proxy.ts` rename for Next.js 16, `next-auth@beta` install
5. https://www.better-auth.com/docs/concepts/session-management: cookie-based sessions, no refresh token rotation
6. https://authjs.dev/getting-started/session-management/protecting: cookie-only session checks, no Bearer support
7. https://www.better-auth.com/docs/integrations/expo: official `@better-auth/expo` package, SDK 55+
8. https://www.better-auth.com/docs/plugins/bearer: Bearer plugin scoped to Better-Auth router
9. https://authjs.dev/getting-started/integrations: web frameworks only, no React Native/Expo listed
10. TASKS.md 6.9: `authenticate()` spec with API key + cookie dual path
11. https://github.com/better-auth/better-auth: MIT license badge
12. https://github.com/nextauthjs/next-auth/blob/main/LICENSE: ISC license
13. https://www.better-auth.com/docs/concepts/database: 4 required tables, customizable names/columns
14. https://authjs.dev/getting-started/adapters/prisma: 4 required models, customizable via @map
15. https://github.com/advisories?query=better-auth: 26 advisories, critical 2FA bypass April 2026
16. https://www.better-auth.com/docs/reference/security: SameSite=Lax, httpOnly, Secure, Origin validation
17. `better-auth/better-auth@main`, `packages/better-auth/src/plugins/bearer/index.ts` lines 62-87 and `packages/better-auth/src/api/index.ts:280` — source-code probe 2026-04-22 confirming the plugin is router-scoped and fails silently on invalid tokens
