# Phase 11: Onboarding, PWA, and Polish - Research

**Researched:** 2026-03-30
**Domain:** PWA (Service Workers, Web App Manifest, Offline), Onboarding UX, React View Transitions
**Confidence:** HIGH

## Summary

Phase 11 covers three distinct but related areas: a first-run onboarding experience (wizard, AI-guided via MCP, or skip), Progressive Web App installability with offline support, and rich animations using React 19's `<ViewTransition>` component. The project is a Next.js 16.2.1 / React 19.2.4 app deployed as a standalone Docker container via Dokploy, which constrains PWA choices (service worker must be a static file in `public/`, no webpack-only solutions preferred).

The onboarding system needs to track whether a user has completed setup (a new field on the User model or a separate flag), then conditionally render one of three paths. The AI-guided path is the most interesting: it does not require building AI into the app. Instead, it instructs the user to connect their existing AI tool via MCP, and the external AI drives the setup through MCP tools that already exist (create_category, create_goal, etc.).

For PWA, the official Next.js docs recommend a manual approach: `app/manifest.ts` for the web app manifest, a hand-written `public/sw.js` for the service worker, and client-side registration. Serwist is an option for more sophisticated caching, but given the project's simple offline requirements (cache dashboard reads, queue writes), a manual service worker with the Cache API and IndexedDB outbox is cleaner and avoids the Serwist webpack/turbopack complexity.

For animations, React 19.2 ships `<ViewTransition>` which integrates with the browser's native View Transitions API. Next.js 16 supports it with an experimental config flag. The component wraps layout children and automatically animates page transitions, enter/exit, and shared element morphing. Combined with the existing `tw-animate-css` utilities, this covers all of THEME-05's requirements without adding Framer Motion or any animation library.

**Primary recommendation:** Use manual PWA (no Serwist), React `<ViewTransition>` for rich animations, and a three-path onboarding flow stored as a boolean `onboardingComplete` on the User model.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ONBD-01 | First-time user sees a choice: guided wizard, AI-guided setup (via MCP), or skip | Onboarding tracked via `onboardingComplete` field on User model. Dashboard page conditionally renders onboarding overlay when false. Three buttons route to wizard, MCP instructions, or skip (sets flag immediately). |
| ONBD-02 | Guided wizard walks through: create categories, set a yearly goal, break it into quarterly | Multi-step wizard component using local state machine (step index). Reuses existing GoalForm, CategoryForm components. On completion, sets `onboardingComplete = true`. |
| ONBD-03 | AI-guided setup works via MCP (external AI asks questions, creates structure through MCP tools) | No new backend needed. MCP tools already support create_goal, create_category, list_goals, get_dashboard. Onboarding page shows instructions to connect MCP, then polls /api/dashboard to detect when goals exist, then marks onboarding complete. |
| ONBD-04 | Skip option drops user into empty dashboard with contextual hints | Skip sets `onboardingComplete = true` immediately. Empty dashboard state already exists (DashboardPage shows "Welcome to Ascend" card). Add tooltip hints pointing to sidebar, add goal button, and view switcher. |
| PWA-01 | App is installable from browser (manifest.json, service worker, icons) | `app/manifest.ts` using MetadataRoute.Manifest, `public/sw.js` with install/activate/fetch handlers, 192x192 and 512x512 icons in `public/icons/`. Registration in root layout via a `<ServiceWorkerRegistration>` client component. |
| PWA-02 | Installed PWA opens in standalone mode (no browser chrome) | `display: 'standalone'` in manifest. Verified by `window.matchMedia('(display-mode: standalone)')`. |
| PWA-03 | Offline read: cached dashboard and recently viewed goals available without network | Service worker uses Cache API with network-first strategy for API routes. On successful fetch, caches response keyed by URL. On network failure, serves from cache. Dashboard route `/api/dashboard` and `/api/goals` cached. |
| PWA-04 | Offline writes queue and sync when connectivity returns | IndexedDB outbox via `idb` library. When POST/PATCH/DELETE fails due to network, store request in outbox. On `online` event or service worker activation, drain the queue by replaying requests. Idempotency via client-generated UUIDs. |
| THEME-05 | Rich animations throughout: page transitions, hover effects, animated counters, parallax timeline, view transitions (React 19 View Transitions API) | React `<ViewTransition>` wrapping `{children}` in app layout for page transitions. CSS keyframes for hover micro-interactions. Animated counters via `useEffect` + requestAnimationFrame. Timeline parallax via scroll handler. `experimental.viewTransition: true` in next.config.ts. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `<ViewTransition>` | 19.2.4 (built-in) | Page transitions, enter/exit animations, shared element morphing | Native React 19 component, no external dependency. Uses browser View Transitions API. Already available in the project's React version. |
| `idb` | ^8 | Typed IndexedDB wrapper for offline outbox queue | Tiny (1.2 KB), TypeScript native, well maintained. The standard way to work with IndexedDB without raw API pain. |
| `tw-animate-css` | 1.4.0 (already installed) | Tailwind v4 animation utilities | Already in the project. Provides animate-in, slide-in, fade-in, zoom-in classes for micro-interactions. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `canvas-confetti` | 1.9.4 (already installed) | Celebration animations | Already used by useCelebrations hook for goal completion. Reuse for onboarding completion celebration. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual SW + idb | Serwist (@serwist/next) | Serwist adds precaching, runtime caching strategies, and background sync via Workbox. But it requires `@serwist/turbopack` for Turbopack compatibility, adds 2 packages, and the project only needs simple cache-then-network and an outbox. Manual approach is simpler for this scope. |
| Manual SW + idb | workbox-window + workbox-background-sync | More structured, but Background Sync only works in Chromium. Still need online-event fallback anyway. Full Workbox is overkill when the outbox has <5 mutation types. |
| React `<ViewTransition>` | Framer Motion | Framer Motion is heavier (~30 KB), requires wrapping every animated element, and doesn't use native browser View Transitions. React 19 ViewTransition is zero-cost (built into React) and CSS-based. |
| idb | Dexie.js | Dexie is more feature-rich (query engine, live queries) but larger. The outbox is a simple append/drain queue that doesn't need query capabilities. |

**Installation:**
```bash
npm install idb
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── manifest.ts                    # Dynamic PWA manifest
├── (app)/
│   ├── layout.tsx                 # Add <ViewTransition> wrapper here
│   └── onboarding/
│       └── page.tsx               # Onboarding flow page
│
components/
├── onboarding/
│   ├── onboarding-gate.tsx        # Conditional render: onboarding vs dashboard
│   ├── onboarding-wizard.tsx      # Multi-step guided wizard
│   ├── onboarding-mcp-guide.tsx   # AI-guided setup instructions + polling
│   ├── onboarding-choice.tsx      # Three-option landing (wizard/AI/skip)
│   └── contextual-hints.tsx       # Tooltip hints for skip path
├── pwa/
│   ├── sw-registration.tsx        # Service worker registration component
│   └── install-prompt.tsx         # "Add to home screen" prompt
│
lib/
├── offline/
│   ├── outbox.ts                  # IndexedDB outbox queue (idb)
│   └── cache-config.ts            # URLs to cache, strategies
│
public/
├── sw.js                          # Service worker (hand-written)
├── icons/
│   ├── icon-192x192.png           # PWA icon (standard)
│   ├── icon-512x512.png           # PWA icon (large)
│   └── icon-maskable-512x512.png  # Maskable icon for Android
│
prisma/
├── schema.prisma                  # Add onboardingComplete to User
```

### Pattern 1: Onboarding Gate in Dashboard
**What:** The dashboard page checks `onboardingComplete` on the user. If false, it renders the onboarding flow instead of the dashboard. If true, it renders normally.
**When to use:** First visit after account creation.
**Example:**
```typescript
// Source: Project convention (thin page, data in component)
// app/(app)/page.tsx remains: <DashboardPage />
// components/dashboard/dashboard-page.tsx adds onboarding check

export function DashboardPage() {
  const { data, isLoading } = useDashboard();

  // If user hasn't completed onboarding, show onboarding flow
  if (data && !data.onboardingComplete) {
    return <OnboardingGate />;
  }

  // ... existing dashboard rendering
}
```

### Pattern 2: Manual Service Worker with Cache-then-Network
**What:** A static `public/sw.js` that intercepts fetch requests, caches API responses on success, and serves from cache on network failure.
**When to use:** For offline-read of dashboard and goal data.
**Example:**
```javascript
// Source: https://nextjs.org/docs/app/guides/progressive-web-apps
// public/sw.js

const CACHE_NAME = 'ascend-v1';
const API_CACHE = 'ascend-api-v1';
const CACHED_API_ROUTES = ['/api/dashboard', '/api/goals', '/api/categories'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/icons/icon-192x192.png']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only cache GET requests to known API routes
  if (event.request.method === 'GET' && CACHED_API_ROUTES.some(r => url.pathname.startsWith(r))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For mutations, let them pass through (outbox handles failures client-side)
});
```

### Pattern 3: IndexedDB Outbox for Offline Writes
**What:** When a mutation (POST/PATCH/DELETE) fails due to network, store it in IndexedDB. On reconnection, drain the queue.
**When to use:** For PWA-04 offline write queue.
**Example:**
```typescript
// Source: idb library pattern + PWA offline-first architecture
// lib/offline/outbox.ts

import { openDB, type IDBPDatabase } from 'idb';

interface OutboxEntry {
  id: string;        // Client-generated UUID
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

const DB_NAME = 'ascend-outbox';
const STORE_NAME = 'mutations';

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function enqueue(entry: Omit<OutboxEntry, 'timestamp'>): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, { ...entry, timestamp: Date.now() });
}

export async function drain(): Promise<void> {
  const db = await getDb();
  const entries = await db.getAll(STORE_NAME);
  for (const entry of entries) {
    try {
      await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      await db.delete(STORE_NAME, entry.id);
    } catch {
      break; // Still offline, stop draining
    }
  }
}
```

### Pattern 4: ViewTransition for Page Transitions
**What:** Wrap the app layout's `{children}` in `<ViewTransition>` to get automatic cross-fade on route changes.
**When to use:** All page navigations within the app.
**Example:**
```typescript
// Source: https://react.dev/reference/react/ViewTransition
// https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
// app/(app)/layout.tsx

import { ViewTransition } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <ViewTransition>
            {children}
          </ViewTransition>
        </main>
      </SidebarInset>
      {/* ... */}
    </SidebarProvider>
  );
}
```

### Pattern 5: Animated Counters
**What:** Numbers that count up from 0 to their target value over a short duration.
**When to use:** Dashboard stat widgets (XP, goals completed, streak count).
**Example:**
```typescript
// Source: Standard requestAnimationFrame counter pattern
function useAnimatedCounter(target: number, duration = 600): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}
```

### Anti-Patterns to Avoid
- **Don't use `document.startViewTransition()` manually:** React's `<ViewTransition>` calls this internally. Manual calls conflict with React's batching and cause double transitions.
- **Don't precache the entire app shell with Serwist/Workbox:** The app uses standalone output mode with Docker. Heavy precaching increases install time and storage on mobile without proportional benefit for a single-user app. Cache only the critical API responses.
- **Don't build a custom animation library:** The combination of `<ViewTransition>` (page transitions), `tw-animate-css` (micro-interactions), CSS transitions (already throughout the codebase), and `canvas-confetti` (celebrations) covers every animation type in THEME-05 without adding a runtime.
- **Don't store onboarding state in localStorage:** The user model already exists server-side. A boolean on User ensures onboarding state persists across devices and is consistent with the server-authoritative data model.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB typed access | Raw IndexedDB API wrapper | `idb` library | IndexedDB's raw API is callback-based, error-prone, and verbose. `idb` is 1.2 KB and provides Promises + TypeScript types. |
| Page transitions | Custom FLIP animation system | React `<ViewTransition>` | Native browser API, zero JS runtime cost, handled by React's reconciler. Custom solutions are fragile across route changes. |
| CSS animations | Framer Motion or custom keyframes for every hover/enter | `tw-animate-css` + Tailwind transitions | Already installed and used throughout. Tailwind's `transition-*` utilities handle hover effects. tw-animate-css provides enter/exit keyframes. |
| Background sync | Custom sync manager with retry logic | `idb` outbox + `online` event listener | Background Sync API has limited browser support (Chromium only, no Safari/Firefox). A simple online-event drain is universally supported and sufficient for this use case. |
| Service worker caching | Full Workbox/Serwist setup | Manual Cache API in `public/sw.js` | The project caches <5 API endpoints. Workbox's configuration complexity is not justified. Manual Cache API code is ~40 lines. |

**Key insight:** This phase adds polish and infrastructure, not new application logic. Every component (PWA, onboarding, animations) should use the simplest available tool. Over-engineering these features creates maintenance burden without user-visible benefit.

## Common Pitfalls

### Pitfall 1: Service Worker Caching Stale Data
**What goes wrong:** The service worker caches API responses that become stale (e.g., dashboard data from yesterday). Users in standalone mode see outdated data indefinitely.
**Why it happens:** Cache-first strategies serve cached data without ever revalidating.
**How to avoid:** Use network-first strategy: always try the network, fall back to cache only on failure. This means offline users see the last-known-good state, while online users always get fresh data.
**Warning signs:** Users report "my dashboard doesn't update" after making changes on another device.

### Pitfall 2: Service Worker Scope and Standalone Output
**What goes wrong:** The service worker at `public/sw.js` is not served in the Docker container because standalone output only copies specific files.
**Why it happens:** Next.js standalone output copies `public/` to the output directory, but the Dockerfile must explicitly include it.
**How to avoid:** The existing Dockerfile already has `COPY --from=builder /app/public ./public`, so `public/sw.js` will be included. Verify after build by checking `curl https://ascend.nativeai.agency/sw.js` returns JavaScript.
**Warning signs:** Service worker registration silently fails; `navigator.serviceWorker.controller` is null.

### Pitfall 3: Service Worker Headers
**What goes wrong:** Browser caches the service worker file itself, preventing updates from reaching users.
**Why it happens:** Without `Cache-Control: no-cache` on `sw.js`, CDN or browser disk cache serves a stale service worker.
**How to avoid:** Add security and cache headers for `/sw.js` in `next.config.ts` using the `headers()` function. Set `Cache-Control: no-cache, no-store, must-revalidate` and `Content-Type: application/javascript; charset=utf-8`.
**Warning signs:** Deploying a new version doesn't update the service worker. Chrome DevTools > Application > Service Workers shows the old version.

### Pitfall 4: ViewTransition Experimental Status
**What goes wrong:** The `experimental.viewTransition` flag or `<ViewTransition>` behavior changes in a future Next.js/React update, breaking transitions.
**Why it happens:** As of March 2026, `experimental.viewTransition` is explicitly marked "not recommended for production" by Next.js. However, the `<ViewTransition>` React component itself works without the flag (the flag only adds Next.js-specific transition types for navigations).
**How to avoid:** Use `<ViewTransition>` directly from React (already in 19.2.4) for the core animation behavior. Enable the experimental flag as a nice-to-have for navigation integration, but structure code so it degrades gracefully (CSS transitions still work without ViewTransition).
**Warning signs:** Console warnings about experimental features. Transitions not firing on route changes.

### Pitfall 5: Outbox Ordering and Idempotency
**What goes wrong:** Offline mutations replayed in wrong order cause data inconsistency (e.g., update fires before create).
**Why it happens:** IndexedDB getAll returns entries in insertion order, but if the user creates a goal then updates it, and both are queued, the order matters.
**How to avoid:** Drain the outbox sequentially (not in parallel), oldest first. Use timestamps for ordering. Include client-generated IDs so the server can detect duplicates. Stop draining on first failure (the rest may depend on it).
**Warning signs:** 404 errors when draining (update for a goal that hasn't been created yet).

### Pitfall 6: Onboarding MCP Path Detection
**What goes wrong:** The MCP-guided onboarding path tells the user to connect their AI tool, but there's no way to detect when setup is complete.
**Why it happens:** MCP is a stateless protocol; the app can't listen to MCP sessions or events.
**How to avoid:** Poll the `/api/dashboard` endpoint periodically (every 5s). When goals exist (totalGoals > 0), consider the AI setup complete and show a "Setup complete" button. Alternatively, include a manual "I'm done" button that checks if any goals/categories were created.
**Warning signs:** User connects MCP, creates goals, but onboarding overlay never goes away because polling isn't set up.

### Pitfall 7: prefers-reduced-motion
**What goes wrong:** Rich animations play for users who have requested reduced motion, causing accessibility issues.
**Why it happens:** ViewTransition and CSS animations fire regardless of the system setting unless explicitly checked.
**How to avoid:** CSS: use `@media (prefers-reduced-motion: reduce)` to disable keyframe animations. For ViewTransition, React respects the preference and skips transitions when reduced motion is enabled. For canvas-confetti, the existing `disableForReducedMotion: true` flag is already set in `useCelebrations`. For animated counters, check `window.matchMedia('(prefers-reduced-motion: reduce)')` and set the value instantly instead of animating.
**Warning signs:** Lighthouse accessibility audit flags animations without reduced-motion support.

## Code Examples

Verified patterns from official sources:

### Dynamic Manifest in Next.js 16
```typescript
// Source: https://nextjs.org/docs/app/guides/progressive-web-apps
// app/manifest.ts

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ascend',
    short_name: 'Ascend',
    description: 'Goal tracking that connects daily actions to yearly ambitions',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F0F14',
    theme_color: '#8B5CF6',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
```

### Service Worker Registration Component
```typescript
// Source: https://nextjs.org/docs/app/guides/progressive-web-apps
// components/pwa/sw-registration.tsx

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          console.log('[SW] registered, scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[SW] registration failed:', err);
        });
    }
  }, []);

  return null;
}
```

### ViewTransition with Custom CSS
```css
/* Source: https://react.dev/reference/react/ViewTransition */
/* Add to globals.css */

/* Page cross-fade transition */
::view-transition-old(.page-transition) {
  animation: fade-out 200ms ease-out;
}

::view-transition-new(.page-transition) {
  animation: fade-in 200ms ease-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### Security Headers for Service Worker
```typescript
// Source: https://nextjs.org/docs/app/guides/progressive-web-apps
// next.config.ts addition

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@modelcontextprotocol/sdk", "pdfkit"],
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};
```

### Online Event Listener for Outbox Drain
```typescript
// Source: Standard PWA online/offline event pattern
// In the app layout or a dedicated provider component

'use client';

import { useEffect } from 'react';
import { drain } from '@/lib/offline/outbox';

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleOnline = () => {
      drain().catch(console.error);
    };

    window.addEventListener('online', handleOnline);

    // Also drain on mount in case we came back online while the tab was closed
    if (navigator.onLine) {
      drain().catch(console.error);
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return <>{children}</>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-pwa (webpack plugin) | Manual SW or Serwist | 2024 (next-pwa abandoned) | next-pwa no longer maintained. Manual or Serwist are the two paths. |
| Framer Motion for page transitions | React `<ViewTransition>` | React 19.2 (March 2026) | Zero-cost page transitions using browser native API. No library needed. |
| `document.startViewTransition()` manual calls | `<ViewTransition>` component | React 19.2 (March 2026) | React manages the lifecycle automatically. Manual calls should not be used alongside the component. |
| Background Sync API for offline writes | Online event + IndexedDB outbox | Ongoing (2024-2026) | Background Sync only works in Chromium. The online-event pattern is universally supported. |
| Static manifest.json in public/ | Dynamic `app/manifest.ts` | Next.js 14+ (2024) | TypeScript manifest with type safety via MetadataRoute.Manifest. Can reference env vars. |

**Deprecated/outdated:**
- `next-pwa` (npm package): Abandoned since 2023. Do not use.
- `@ducanh2912/next-pwa`: Predecessor of Serwist. Use Serwist instead if going the library route.
- Manual `document.startViewTransition()`: Superseded by React's `<ViewTransition>` component. Never call it directly in a React 19 app.

## Open Questions

1. **PWA Icons Generation**
   - What we know: Need 192x192, 512x512, and maskable variants. The app uses the NativeAI indigo/violet palette.
   - What's unclear: Whether to generate icons programmatically or design them manually.
   - Recommendation: Create simple icons using the Ascend brand (mountain/arrow-up motif in violet on dark background). Can be SVGs converted to PNGs. Generate during the plan execution phase.

2. **ViewTransition Browser Fallback**
   - What we know: ViewTransition works in ~78% of browsers (Chromium + Safari 18). Firefox is behind a flag.
   - What's unclear: Whether the component silently degrades (no animation) or throws errors in unsupported browsers.
   - Recommendation: Based on the React docs, `<ViewTransition>` is a no-op in unsupported browsers (no error, no animation). This is acceptable since the underlying app remains fully functional. No polyfill needed.

3. **Onboarding Data Migration**
   - What we know: The User model currently has no `onboardingComplete` field. Adding it requires a Prisma migration.
   - What's unclear: Whether existing users should be marked as onboarding-complete automatically.
   - Recommendation: Default `onboardingComplete` to `true` in the migration for existing users (they clearly don't need onboarding). New users get `false`.

## Sources

### Primary (HIGH confidence)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps) - Complete manual PWA setup for Next.js 16 App Router
- [React ViewTransition Docs](https://react.dev/reference/react/ViewTransition) - Full API reference for `<ViewTransition>` component
- [Next.js viewTransition Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) - Experimental flag documentation
- [React Labs Blog (April 2025)](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more) - ViewTransition announcement and roadmap

### Secondary (MEDIUM confidence)
- [Serwist Getting Started](https://serwist.pages.dev/docs/next/getting-started) - @serwist/next installation and configuration
- [Serwist Turbopack](https://www.npmjs.com/package/@serwist/turbopack) - Turbopack support for Serwist
- [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) - Browser API reference
- [idb library](https://www.npmjs.com/package/idb) - IndexedDB wrapper used for outbox

### Tertiary (LOW confidence)
- [LogRocket: Next.js 16 PWA](https://blog.logrocket.com/nextjs-16-pwa-offline-support/) - Community guide for offline PWA patterns
- [Background Sync in React PWAs](https://oneuptime.com/blog/post/2026-01-15-background-sync-react-pwa/view) - Background sync implementation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js docs and React docs directly support all choices. No experimental or unmaintained libraries.
- Architecture: HIGH - Patterns follow official docs (manifest.ts, manual SW, ViewTransition component). Project conventions (thin routes, Zustand store, React Query) are well established from 10 prior phases.
- Pitfalls: HIGH - Offline caching pitfalls are well-documented in PWA literature. ViewTransition experimental status is explicitly stated in Next.js docs. Service worker header requirements come from official docs.
- Onboarding flow: MEDIUM - The three-path approach is a UX design decision. The MCP-guided path (polling for goal creation) is novel and may need iteration. The wizard reuses existing components but the step flow needs design.

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days; stable domain, no rapidly changing dependencies)
