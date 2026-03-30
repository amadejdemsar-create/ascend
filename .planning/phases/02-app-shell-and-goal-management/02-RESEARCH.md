# Phase 2: App Shell and Goal Management - Research

**Researched:** 2026-03-30
**Domain:** Next.js App Router UI shell, responsive layout, theming, goal CRUD forms, hierarchy UI
**Confidence:** HIGH

## Summary

Phase 2 transforms the bare placeholder page into a functional application with navigation, theming, and complete goal management. The app shell consists of a collapsible sidebar on desktop (full or icons only) and a bottom tab bar on mobile, using shadcn/ui's built-in Sidebar component which provides collapsible state management, responsive detection, and keyboard shortcut toggling out of the box. The theme system uses next-themes with CSS variables following the shadcn/ui convention (oklch values in `:root` and `.dark` selectors, mapped via `@theme inline`), customized to the NativeAI palette (indigo #4F46E5, violet #8B5CF6, dark bg #0F0F14, surface layers #16161D/#1C1C26/#22222E).

The goal management UI has two distinct creation paths: a modal dialog with full SMART fields for yearly and quarterly goals (using shadcn/ui Dialog), and an inline quick-add input for monthly and weekly goals (minimal fields, just title and horizon). Editing uses the same form components in a detail panel or dialog, with status/priority managed via dropdown selects. Deletion requires confirmation when children exist, showing child count and offering to proceed. The hierarchy UI shows parent linking via a filtered select (only showing goals at the valid parent horizon) and a children list under each goal. When all children of a goal complete, the UI suggests completing the parent via a toast or banner (progress rollup suggestion, not automatic).

State management follows the established pattern: React Query (TanStack Query v5) for all server state (goals, categories), Zustand for UI state (sidebar collapse, theme override). The project already has the Service Layer and API routes from Phase 1, so this phase focuses entirely on the client-side React components and their data fetching hooks.

**Primary recommendation:** Use shadcn/ui Sidebar component as the foundation for the app shell, add React Query + Zustand as state management providers in the root layout alongside next-themes ThemeProvider, and build goal forms as reusable components that serve both creation and editing.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | Desktop layout has a collapsible sidebar (full sidebar or icons-only) | shadcn/ui Sidebar with `collapsible="icon"` provides this natively |
| NAV-02 | Sidebar shows: navigation (Dashboard, views), categories tree, settings link | SidebarContent with SidebarGroup components for each section |
| NAV-03 | Mobile layout has a bottom tab bar with main views | Custom bottom tab bar component (shadcn/ui does not have built-in bottom nav) |
| NAV-04 | Mobile has a hamburger menu for secondary navigation | shadcn/ui Sheet component for slide-out drawer from top/left |
| NAV-05 | Responsive breakpoints: mobile (<768px), tablet (768-1024px), desktop (>1024px) | Tailwind responsive prefixes (md:768px, lg:1024px) with useSidebar's isMobile |
| THEME-01 | Dark and light themes following system preference by default | next-themes with `defaultTheme="system"` and `enableSystem` |
| THEME-02 | Manual theme override persisted | next-themes persists to localStorage automatically |
| THEME-03 | NativeAI color palette (indigo #4F46E5, violet #8B5CF6, dark bg #0F0F14) | CSS variables in `:root` and `.dark` with oklch values mapped via `@theme inline` |
| THEME-04 | Typography: Inter for body/UI, Playfair Display for headlines, JetBrains Mono for data | next/font/google with CSS variables, Inter already configured |
| GOAL-01 | Create goal with title and horizon selection | Goal creation form with title input and horizon select |
| GOAL-02 | Link goal to parent at appropriate horizon | Filtered parent select showing only valid parent horizon goals |
| GOAL-03 | SMART fields on yearly/quarterly goals | Modal dialog form with Specific, Measurable, Attainable, Relevant, Timely fields |
| GOAL-04 | Simple fields on monthly/weekly goals | Inline quick-add with title; editing adds status, priority, deadline, notes |
| GOAL-05 | Edit any field on existing goal | Reusable form component in edit mode, populated with current values |
| GOAL-06 | Delete goal with confirmation if children exist | AlertDialog with child count, onDelete calls goalService.delete |
| GOAL-07 | Set goal status (not started, in progress, completed, abandoned) | Status select dropdown using shadcn/ui Select component |
| GOAL-08 | Set goal priority (high, medium, low) | Priority select with color-coded indicators |
| GOAL-09 | Set measurable target (target value, current value, unit) | Target value, current value, unit fields in the goal form |
| GOAL-11 | View goal's children (sub-goals at next horizon) | Children list rendered below goal detail, fetched via React Query |
| GOAL-12 | Completing all children suggests completing parent | Check children status on status change, show toast/banner when all complete |
| GOAL-13 | Inline add for quick, minimal-field goals | QuickAdd component: text input + horizon selector, creates on Enter |
| GOAL-14 | Modal dialog for full-field SMART goals | Dialog component with tabbed or sectioned SMART fields form |
</phase_requirements>

## Standard Stack

### Core (new for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | 5.95.x | Server state management | Cache, background refetch, optimistic updates, mutations with invalidation. The standard for fetching data in Next.js App Router client components. |
| @tanstack/react-query-devtools | 5.95.x | Dev tools for React Query | Inspect query cache, mutations, and states during development. |
| zustand | 5.0.x | Client UI state | Sidebar collapse, theme preference, selected goal, modal state. Minimal API, no providers needed, works with Server Components. |
| next-themes | 0.4.x | Theme switching | Dark/light/system preference with zero-flash, localStorage persistence. Standard pairing with shadcn/ui. |
| sonner | latest | Toast notifications | Lightweight, accessible. shadcn/ui wraps it natively. Used for success/error/rollup suggestion feedback. |
| lucide-react | 1.7.x | Icons | Tree-shakable SVG icons. Integrated with shadcn/ui components. |

### shadcn/ui Components (code-copied, not npm dependencies)

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| Sidebar | App shell navigation (desktop) | NAV-01, NAV-02 |
| Sheet | Mobile hamburger drawer | NAV-04 |
| Dialog | Goal creation modal | GOAL-14 |
| AlertDialog | Delete confirmation | GOAL-06 |
| Button | Actions throughout | All interactive elements |
| Input | Text fields | Goal title, SMART fields, quick-add |
| Textarea | Multi-line fields | Notes, description |
| Select | Dropdowns | Horizon, status, priority, parent goal |
| Sonner | Toast notifications | Success/error feedback, rollup suggestion |
| Badge | Status/priority indicators | Goal cards, list items |
| Label | Form labels | All form fields |
| Tabs | Form sections | SMART fields organization |
| Separator | Visual dividers | Between sidebar sections |
| Skeleton | Loading states | While queries are pending |
| DropdownMenu | Context menus | Goal actions menu |
| Tooltip | Icon hints | Collapsed sidebar icon labels |
| Collapsible | Expandable sections | Sidebar navigation groups |

### Already Installed (from Phase 1)

| Library | Version | Purpose |
|---------|---------|---------|
| next | 16.2.1 | Framework |
| react | 19.2.4 | UI library |
| zod | 4.3.x | Validation (shared schemas already exist) |
| tailwindcss | 4.x | Styling |
| prisma / @prisma/client | 7.6.x | ORM (Service Layer ready) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-query | SWR | SWR is simpler but lacks built-in mutation support, optimistic updates, and query invalidation patterns. React Query is the better choice for an app with many write operations. |
| zustand | Jotai | Jotai is atom-based (bottom-up). Zustand is store-based (top-down). For UI state like sidebar/theme, Zustand's single store pattern is more straightforward. |
| next-themes | Custom useTheme hook | next-themes handles SSR flash prevention, localStorage sync, system preference detection, and class toggling automatically. Building this from scratch invites subtle bugs. |
| Custom bottom tab bar | Material UI BottomNavigation | shadcn/ui does not have a bottom navigation component. Building a simple fixed-bottom nav with Tailwind is trivial and avoids adding Material UI as a dependency. |

**Installation:**
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools zustand next-themes lucide-react

# shadcn/ui init (generates components.json, updates globals.css)
npx shadcn@latest init

# Add required shadcn/ui components
npx shadcn@latest add sidebar sheet dialog alert-dialog button input textarea select sonner badge label tabs separator skeleton dropdown-menu tooltip collapsible
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
app/
├── layout.tsx                    # Root layout: fonts, ThemeProvider, QueryProvider, SidebarProvider
├── (app)/                        # Route group for app shell layout
│   ├── layout.tsx                # App shell: AppSidebar + main content area
│   ├── page.tsx                  # Dashboard placeholder (redirect or simple)
│   └── goals/
│       └── page.tsx              # Goals page (Server Component, fetches initial data)
├── api/                          # Existing API routes (untouched)
│   ├── goals/
│   ├── categories/
│   └── health/
components/
├── layout/
│   ├── app-sidebar.tsx           # Desktop sidebar with navigation groups
│   ├── bottom-tab-bar.tsx        # Mobile bottom navigation
│   ├── mobile-drawer.tsx         # Hamburger menu sheet for secondary nav
│   ├── nav-config.ts             # Navigation items configuration
│   └── theme-toggle.tsx          # Dark/light mode switch
├── goals/
│   ├── goal-form.tsx             # Unified create/edit form (handles SMART + simple)
│   ├── goal-modal.tsx            # Dialog wrapper for goal creation
│   ├── goal-card.tsx             # Goal display card (used in lists/grids)
│   ├── goal-detail.tsx           # Full goal detail with children list
│   ├── goal-status-select.tsx    # Status dropdown with color indicators
│   ├── goal-priority-badge.tsx   # Priority display with color
│   ├── goal-delete-dialog.tsx    # Delete confirmation with children warning
│   ├── goal-parent-select.tsx    # Parent goal selector (filtered by valid horizon)
│   ├── quick-add.tsx             # Inline quick-add input for simple goals
│   └── children-list.tsx         # List of child goals under a parent
├── providers/
│   ├── query-provider.tsx        # "use client" React Query provider
│   └── theme-provider.tsx        # "use client" next-themes provider
└── ui/                           # shadcn/ui components (auto-generated)
lib/
├── hooks/
│   ├── use-goals.ts              # React Query hooks for goal operations
│   └── use-categories.ts         # React Query hooks for category data
├── queries/
│   └── keys.ts                   # Query key factory
├── stores/
│   └── ui-store.ts               # Zustand store for sidebar, selected goal
├── services/                     # Existing (untouched)
├── validations.ts                # Existing (untouched)
└── utils.ts                      # Date formatting, horizon display names
```

### Pattern 1: Provider Composition in Root Layout

**What:** Wrap the root layout with all providers in the correct nesting order.
**When to use:** Once, in `app/layout.tsx`.

```typescript
// app/layout.tsx
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Pattern 2: App Shell with Route Group

**What:** Use a Next.js route group `(app)` for the shell layout that includes sidebar + main content, keeping the root layout clean.
**When to use:** Separates the app shell from potential auth pages or landing pages.

```typescript
// app/(app)/layout.tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </SidebarInset>
      <BottomTabBar />
    </SidebarProvider>
  );
}
```

### Pattern 3: React Query Provider with Client Boundary

**What:** Create a client component that wraps children in QueryClientProvider with proper singleton handling.
**When to use:** Once, in the provider composition.

```typescript
// components/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Important:** Use `useState(() => new QueryClient())` rather than a module-level singleton. In Next.js App Router, a module-level singleton would be shared across requests on the server, leaking data between users. The useState pattern ensures one QueryClient per browser session while remaining stable across re-renders.

### Pattern 4: React Query Hook Factory for Goals

**What:** Centralize all goal-related queries and mutations in a single hook file.
**When to use:** Every component that reads or writes goals.

```typescript
// lib/hooks/use-goals.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import type { GoalFilters, CreateGoalInput, UpdateGoalInput } from "@/lib/validations";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

export function useGoals(filters?: GoalFilters) {
  const params = new URLSearchParams();
  if (filters?.horizon) params.set("horizon", filters.horizon);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.categoryId) params.set("categoryId", filters.categoryId);
  if (filters?.parentId !== undefined) params.set("parentId", filters.parentId ?? "");

  return useQuery({
    queryKey: queryKeys.goals.list(filters),
    queryFn: async () => {
      const res = await fetch(`/api/goals?${params}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch goals");
      return res.json();
    },
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: queryKeys.goals.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/goals/${id}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch goal");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGoalInput) => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateGoalInput }) => {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update goal");
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(id) });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/goals/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}
```

### Pattern 5: Query Key Factory

**What:** Centralize query keys for consistent cache invalidation across all hooks.
**When to use:** Referenced by all query/mutation hooks.

```typescript
// lib/queries/keys.ts
import type { GoalFilters } from "@/lib/validations";

export const queryKeys = {
  goals: {
    all: () => ["goals"] as const,
    list: (filters?: GoalFilters) => ["goals", "list", filters] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
    tree: () => ["goals", "tree"] as const,
  },
  categories: {
    all: () => ["categories"] as const,
    tree: () => ["categories", "tree"] as const,
  },
};
```

### Pattern 6: Zustand UI Store

**What:** Manage ephemeral UI state that does not persist to the server.
**When to use:** Sidebar collapse state, selected goal for detail panel, modal open state.

```typescript
// lib/stores/ui-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarCollapsed: boolean;
  selectedGoalId: string | null;
  goalModalOpen: boolean;
  goalModalMode: "create" | "edit";
  goalModalHorizon: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY" | null;
  toggleSidebar: () => void;
  selectGoal: (id: string | null) => void;
  openGoalModal: (mode: "create" | "edit", horizon?: string) => void;
  closeGoalModal: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      selectedGoalId: null,
      goalModalOpen: false,
      goalModalMode: "create",
      goalModalHorizon: null,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      selectGoal: (id) => set({ selectedGoalId: id }),
      openGoalModal: (mode, horizon) =>
        set({
          goalModalOpen: true,
          goalModalMode: mode,
          goalModalHorizon: (horizon as UIStore["goalModalHorizon"]) ?? null,
        }),
      closeGoalModal: () => set({ goalModalOpen: false }),
    }),
    {
      name: "ascend-ui",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
```

**Note on persist middleware with Next.js:** Only persist values that genuinely need to survive page reloads (like sidebar collapse preference). Transient state (selected goal, modal open) should not persist. The `partialize` option controls what gets saved to localStorage.

### Pattern 7: API Key for Client-Side Fetching

**What:** The existing API routes require Bearer token auth. Client components need access to the API key.
**When to use:** All React Query hooks that call `/api/*` endpoints.

Since this is a single-user app, expose the API key via `NEXT_PUBLIC_API_KEY` environment variable. This is acceptable because there is no multi-user authentication; the API key is public-facing by design for this v1 app. For future multi-user support, replace this with session-based auth.

### Anti-Patterns to Avoid

- **Mixing Server Component data fetching with React Query on the same data:** Either fetch in a Server Component and pass as props, or fetch entirely with React Query. Do not do both for the same data on the same page. For Phase 2, use React Query for all goal data since the UI is heavily interactive (create, edit, delete, status changes).

- **Storing server state in Zustand:** Goals, categories, and other database-backed data must live in React Query's cache, not Zustand. Zustand is exclusively for client-only UI state. Mixing them creates sync issues.

- **Creating provider chains inside pages:** All providers belong in `app/layout.tsx` or `app/(app)/layout.tsx`. Never wrap individual pages in providers.

- **Using shadcn/ui Sidebar's built-in state for persisted preferences:** The `SidebarProvider` manages open/close state for the current session. For persisting sidebar preference across sessions, sync it with the Zustand store (which uses localStorage via persist middleware).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme switching with SSR flash prevention | Custom useTheme with localStorage | next-themes | Handles SSR hydration mismatch, `<script>` injection for zero-flash, system preference detection, class toggling on `<html>` |
| Sidebar collapse with responsive detection | Custom sidebar with media queries and state | shadcn/ui Sidebar component | Built-in collapsible modes (offcanvas, icon, none), mobile detection via useSidebar hook, keyboard shortcut (Cmd+B), CSS-variable-based width control |
| Toast notifications | Custom notification system | sonner (via shadcn/ui) | Accessible, animated, action buttons, auto-dismiss, promise-based toasts, position control |
| Confirmation dialogs | Custom modal with portal | shadcn/ui AlertDialog | Accessible (focus trap, ARIA), keyboard navigation, composable API |
| Form dropdown selects | Custom select with dropdown | shadcn/ui Select | Accessible, keyboard navigable, styled consistently with the design system |
| Data fetching cache | Custom cache with useState/useEffect | @tanstack/react-query | Automatic cache invalidation, background refetch, optimistic updates, mutation state tracking, devtools |

**Key insight:** This phase is primarily a UI composition exercise. The data layer (Service Layer, API routes, Prisma schema) is complete from Phase 1. Every interaction pattern needed here (responsive sidebar, theme toggle, dialogs, selects, toasts) has a shadcn/ui or established library solution. The risk is in the composition and state management, not in building primitives.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Theme Toggle
**What goes wrong:** The server renders with one theme class, the client hydrates with another, causing a React hydration mismatch error.
**Why it happens:** next-themes reads from localStorage on the client, which is not available on the server.
**How to avoid:** Add `suppressHydrationWarning` to the `<html>` element. Use `disableTransitionOnChange` on ThemeProvider to prevent flash during theme switch. next-themes handles the script injection for zero-flash automatically.
**Warning signs:** Console error about hydration mismatch on the `<html>` element's class attribute.

### Pitfall 2: Zustand Persist Hydration Error
**What goes wrong:** Server-rendered HTML differs from client because Zustand's persisted state (e.g., `sidebarCollapsed: true`) is loaded from localStorage after hydration.
**Why it happens:** localStorage is only available on the client. The server renders with the default state.
**How to avoid:** Only persist truly necessary preferences (sidebar collapse). For values that affect layout (like sidebar width), accept the brief flash or use a CSS approach that handles both states gracefully. Alternatively, use the `skipHydration` option and merge state manually after mount.
**Warning signs:** Sidebar briefly appears expanded then collapses on page load.

### Pitfall 3: QueryClient Singleton Leak in App Router
**What goes wrong:** Using a module-level `new QueryClient()` causes all server-rendered requests to share the same cache, potentially leaking data between users.
**Why it happens:** Module-level variables persist across requests in Next.js App Router on the server.
**How to avoid:** Create the QueryClient inside `useState(() => new QueryClient())` within the client provider component. This ensures one instance per browser session on the client and no shared state on the server.
**Warning signs:** Stale data appearing for different users (not relevant for single-user v1 but important to establish the correct pattern).

### Pitfall 4: API Key Exposure in Client Components
**What goes wrong:** The API key is needed for client-side fetches but exposed in the browser.
**Why it happens:** `NEXT_PUBLIC_*` environment variables are bundled into the client JavaScript.
**How to avoid:** For v1 single-user, this is acceptable. The API key is effectively a session token for one user. Document that this must change to session-based auth in multi-user v2. Do NOT store sensitive keys (database credentials, etc.) in `NEXT_PUBLIC_*`.
**Warning signs:** Not a security issue for v1 single-user but would be for multi-user.

### Pitfall 5: Missing Mobile Bottom Tab Bar Padding
**What goes wrong:** Content at the bottom of the page is hidden behind the fixed bottom tab bar on mobile.
**Why it happens:** A fixed-position bottom bar overlays content without reserving space.
**How to avoid:** Add `pb-20 md:pb-6` (or similar) to the main content area. The `pb-20` reserves space on mobile for the tab bar, while `md:pb-6` restores normal padding on desktop where the sidebar is used instead.
**Warning signs:** Last item in a list is partially hidden on mobile.

### Pitfall 6: Tailwind v4 Dark Mode Class Not Applying
**What goes wrong:** `dark:` utility classes do not apply when the `.dark` class is toggled on the `<html>` element.
**Why it happens:** Tailwind v4 uses `@custom-variant` in CSS instead of a JavaScript config. If the custom variant is missing or uses the wrong selector, dark mode fails.
**How to avoid:** Ensure globals.css includes `@custom-variant dark (&:is(.dark *));` after the Tailwind import. This tells Tailwind to activate dark variants when a parent has the `.dark` class.
**Warning signs:** Changing theme in the toggle does nothing visually.

### Pitfall 7: Parent Goal Select Showing Invalid Options
**What goes wrong:** When creating a quarterly goal, the parent selector shows other quarterly or weekly goals as parent options.
**Why it happens:** The parent select is not filtered by the hierarchy rules.
**How to avoid:** Filter the parent options based on `VALID_PARENT_HORIZONS[selectedHorizon]`. A QUARTERLY goal should only show YEARLY goals. A MONTHLY should only show QUARTERLY. A WEEKLY should only show MONTHLY. A YEARLY should have no parent select at all.
**Warning signs:** User links a quarterly goal to another quarterly goal, which the Service Layer rejects.

## Code Examples

### CSS Variables for NativeAI Palette (globals.css)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(0.985 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.453 0.185 264);       /* indigo #4F46E5 */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.553 0.191 293);     /* violet #8B5CF6 */
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0.005 264);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.453 0.185 264);          /* indigo for focus rings */
  --sidebar: oklch(0.975 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.453 0.185 264);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.95 0.005 264);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.453 0.185 264);
}

.dark {
  --background: oklch(0.107 0.005 270);    /* #0F0F14 */
  --foreground: oklch(0.93 0 0);
  --card: oklch(0.133 0.005 270);          /* #16161D */
  --card-foreground: oklch(0.93 0 0);
  --popover: oklch(0.155 0.005 270);       /* #1C1C26 */
  --popover-foreground: oklch(0.93 0 0);
  --primary: oklch(0.553 0.191 293);       /* violet #8B5CF6 in dark */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.453 0.185 264);     /* indigo #4F46E5 in dark */
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.178 0.005 270);         /* #22222E */
  --muted-foreground: oklch(0.6 0 0);
  --accent: oklch(0.178 0.01 264);
  --accent-foreground: oklch(0.93 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.22 0.01 270);
  --input: oklch(0.22 0.01 270);
  --ring: oklch(0.553 0.191 293);          /* violet for focus rings in dark */
  --sidebar: oklch(0.12 0.005 270);
  --sidebar-foreground: oklch(0.93 0 0);
  --sidebar-primary: oklch(0.553 0.191 293);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.16 0.01 264);
  --sidebar-accent-foreground: oklch(0.93 0 0);
  --sidebar-border: oklch(0.22 0.01 270);
  --sidebar-ring: oklch(0.553 0.191 293);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-sans: var(--font-inter);
  --font-serif: var(--font-playfair);
  --font-mono: var(--font-jetbrains);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}
```

### Multiple Fonts with next/font

```typescript
// app/layout.tsx
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

// Apply all three CSS variable classes to <html>
// className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`}
// Then in @theme inline, map them to Tailwind font families:
// --font-sans: var(--font-inter);
// --font-serif: var(--font-playfair);
// --font-mono: var(--font-jetbrains);
// Usage in Tailwind: font-sans, font-serif, font-mono
```

### Bottom Tab Bar for Mobile

```typescript
// components/layout/bottom-tab-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Settings, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### Goal Form with SMART Fields (Conditional)

```typescript
// Simplified pattern showing SMART field conditional rendering
// The actual form would use shadcn/ui form components

interface GoalFormProps {
  mode: "create" | "edit";
  initialData?: ExistingGoal;
  onSubmit: (data: CreateGoalInput | UpdateGoalInput) => void;
}

function GoalForm({ mode, initialData, onSubmit }: GoalFormProps) {
  const [horizon, setHorizon] = useState(initialData?.horizon ?? "WEEKLY");
  const showSmartFields = horizon === "YEARLY" || horizon === "QUARTERLY";

  return (
    <form onSubmit={handleSubmit}>
      {/* Always shown */}
      <Input label="Title" required />
      <Select label="Horizon" value={horizon} onValueChange={setHorizon} />
      <GoalParentSelect horizon={horizon} /> {/* Filtered by valid parent */}
      <Select label="Priority" />
      <Input label="Deadline" type="date" />

      {/* SMART fields for yearly/quarterly only */}
      {showSmartFields && (
        <div>
          <Textarea label="Specific" placeholder="What exactly will you achieve?" />
          <Textarea label="Measurable" placeholder="How will you measure success?" />
          <Textarea label="Attainable" placeholder="Is this realistically achievable?" />
          <Textarea label="Relevant" placeholder="Why does this matter?" />
          <Textarea label="Timely" placeholder="What is the timeframe?" />
        </div>
      )}

      {/* Measurable target */}
      <Input label="Target Value" type="number" />
      <Input label="Unit" placeholder="e.g., clients, articles, km" />

      <Textarea label="Notes" />
    </form>
  );
}
```

### Progress Rollup Suggestion Pattern

```typescript
// When updating a goal's status to COMPLETED, check if all siblings are complete
export function useUpdateGoalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: async (updatedGoal) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });

      // Check if parent should be suggested for completion
      if (updatedGoal.status === "COMPLETED" && updatedGoal.parentId) {
        const parent = await fetch(`/api/goals/${updatedGoal.parentId}`, { headers });
        const parentData = await parent.json();

        if (parentData.children?.every((c: { status: string }) => c.status === "COMPLETED")) {
          toast("All sub-goals complete!", {
            description: `"${parentData.title}" has all children completed.`,
            action: {
              label: "Complete parent",
              onClick: () => {
                // Trigger parent completion mutation
              },
            },
          });
        }
      }
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js `darkMode: "class"` | `@custom-variant dark (&:is(.dark *));` in CSS | Tailwind CSS v4 (2025) | No JavaScript config file needed. Dark mode is CSS-first. |
| `framer-motion` npm package | `motion` npm package | Motion 11+ (2024) | Same library, new name. Import from `motion` or `motion/react`. |
| `tailwindcss-animate` plugin | `tw-animate-css` import | March 2025 | Direct CSS import replaces plugin registration. |
| HSL color values in CSS variables | OKLCH color values | shadcn/ui v2 + Tailwind v4 | OKLCH provides perceptually uniform colors. Better for programmatic palette generation. |
| Manual sidebar with state management | shadcn/ui Sidebar component | shadcn/ui 2024 | Full sidebar system with collapsible modes, responsive detection, keyboard shortcuts. |
| `QueryClientProvider` at module level | `useState(() => new QueryClient())` | Next.js App Router (2023+) | Prevents server-side cache leakage between requests. |

**Deprecated/outdated:**
- `tailwindcss-animate`: Replaced by `tw-animate-css`
- `darkMode: "class"` in tailwind.config: Replaced by `@custom-variant dark` in CSS
- Module-level `new QueryClient()`: Replaced by `useState` pattern in App Router

## Open Questions

1. **OKLCH values for NativeAI palette**
   - What we know: The hex values are #4F46E5 (indigo), #8B5CF6 (violet), #0F0F14 (dark bg), #16161D, #1C1C26, #22222E (surface layers)
   - What's unclear: The exact oklch conversions. The values in the code example above are approximations.
   - Recommendation: Use a color converter tool (oklch.com) during implementation to get precise conversions. Or use hex values in CSS variables directly since modern browsers support both. The `@theme inline` mapping works with any valid CSS color format.

2. **API key in client-side code**
   - What we know: The existing API routes require Bearer token auth. Client components need to call these endpoints.
   - What's unclear: Whether to expose via `NEXT_PUBLIC_API_KEY` or create unauthenticated internal endpoints.
   - Recommendation: Use `NEXT_PUBLIC_API_KEY` for v1 single-user. This is a pragmatic choice. Alternative: create internal API routes that skip auth for same-origin requests (check `Origin` header), but this adds complexity without security benefit for a single-user app.

3. **Sidebar state persistence coordination**
   - What we know: shadcn/ui SidebarProvider manages open/close state. Zustand persist middleware saves to localStorage.
   - What's unclear: Whether to use the SidebarProvider's `defaultOpen` prop seeded from Zustand, or use the SidebarProvider's controlled mode (`open` + `onOpenChange`) synced with Zustand.
   - Recommendation: Use SidebarProvider's `defaultOpen` prop read from localStorage directly (via a client component that checks localStorage before render), or accept the brief flash on first load. The simpler approach is to let SidebarProvider manage its own state and not sync with Zustand at all; sidebar collapse preference is low-stakes.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Installation for Next.js](https://ui.shadcn.com/docs/installation/next) - Setup steps, CLI commands
- [shadcn/ui Sidebar Component](https://ui.shadcn.com/docs/components/sidebar) - Complete sidebar API, collapsible modes, useSidebar hook, responsive behavior
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) - CSS variables, theme tokens, oklch convention, @theme inline
- [shadcn/ui Dark Mode for Next.js](https://ui.shadcn.com/docs/dark-mode/next) - ThemeProvider setup, next-themes integration
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) - @custom-variant dark, tw-animate-css migration, @theme inline
- [shadcn/ui Sonner](https://ui.shadcn.com/docs/components/radix/sonner) - Toast notification setup
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - API reference, version 0.4.6
- [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query) - Version 5.95.x
- [zustand npm](https://www.npmjs.com/package/zustand) - Version 5.0.12
- [lucide-react npm](https://www.npmjs.com/package/lucide-react) - Version 1.7.x

### Secondary (MEDIUM confidence)
- [TanStack Query Next.js App Router Guide](https://ihsaninh.com/blog/the-complete-guide-to-tanstack-query-next.js-app-router) - Provider setup, hook patterns
- [Tailwind CSS v4 Dark Mode Docs](https://tailwindcss.com/docs/dark-mode) - @custom-variant syntax
- [shadcn/ui Sidebar Admin Dashboard Guide](https://adminlte.io/blog/build-admin-dashboard-shadcn-nextjs/) - Layout patterns, configuration-driven nav
- [Zustand persist middleware in Next.js](https://dev.to/abdulsamad/how-to-use-zustands-persist-middleware-in-nextjs-4lb5) - Hydration handling
- [next/font Google Fonts multiple fonts](https://github.com/vercel/next.js/discussions/41872) - Multiple font variables pattern

### Tertiary (LOW confidence)
- Bottom navigation component request for shadcn/ui (GitHub issue #8847) - Confirms no built-in bottom nav; custom implementation needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All library versions verified against npm on 2026-03-30
- Architecture: HIGH - Provider pattern, React Query hooks, Zustand store patterns all verified against official docs and established Next.js App Router conventions
- Pitfalls: HIGH - Hydration mismatch, Tailwind v4 dark mode, QueryClient singleton patterns all documented in official docs and community guides
- shadcn/ui patterns: HIGH - Sidebar component docs, theming docs, and dark mode setup all verified directly from ui.shadcn.com

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, 30-day window)
