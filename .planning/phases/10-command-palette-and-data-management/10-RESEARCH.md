# Phase 10: Command Palette and Data Management - Research

**Researched:** 2026-03-30
**Domain:** Command palette UI, keyboard shortcuts, data import/export (JSON, CSV, Markdown, PDF, DOCX), automated database backups
**Confidence:** HIGH

## Summary

Phase 10 combines two distinct feature sets: a power user navigation layer (command palette + keyboard shortcuts) and full data portability (import/export in five formats plus automated backups). Both build on existing infrastructure. The command palette leverages the `goalService.search()` method already implemented in the service layer and MCP tools. The data export formats (JSON, CSV, Markdown) already exist in `lib/mcp/tools/data-tools.ts` and need to be exposed through a UI endpoint. PDF and DOCX generation require two new server-side libraries. Automated backups use Dokploy's native pg_dump feature rather than custom cron infrastructure.

**Primary recommendation:** Use cmdk (v1.0.4+) via shadcn/ui's Command component for the palette, add PDFKit and docx as server-side dependencies for PDF/DOCX generation, create a `/api/export` endpoint that reuses existing MCP export logic, and configure Dokploy's built-in backup feature for automated pg_dump.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-01 | Cmd+K opens a command palette overlay | cmdk library with Command.Dialog renders a modal palette; shadcn/ui Command component provides styled version; global keydown listener on `useEffect` |
| CMD-02 | Command palette searches across all goals by title and description | `goalService.search()` already implements case-insensitive search across title, description, and notes via Prisma; need a new `/api/goals/search` REST endpoint for the UI |
| CMD-03 | Command palette offers quick actions (new goal, switch view, toggle theme, navigate to category) | cmdk Command.Group with Command.Item; actions dispatch to existing UIStore methods (`openGoalModal`, `setActiveView`) and next-themes `setTheme` |
| CMD-04 | Command palette navigates to specific categories and subcategories | Fetch categories via existing `useCategories()` hook; Command.Item per category that sets `activeFilters.categoryId` and navigates to `/goals` |
| CMD-05 | Keyboard shortcuts for navigation between views, create new goal, mark goal complete, open/close sidebar, toggle theme | Global `useEffect` keydown listener; map keys to UIStore actions; no library needed (plain DOM events) |
| CMD-06 | Keyboard shortcut reference accessible via `?` key | Modal/dialog component listing all shortcuts; triggered by `?` keydown when no input is focused |
| DATA-01 | Import existing todos.json into the goal hierarchy | `migrateOldFormat()` and `handleDataTool("import_data")` already exist in `data-tools.ts`; need a UI file upload component on the Settings page that POSTs JSON to a new `/api/import` endpoint |
| DATA-02 | Export goals as JSON (full structured backup) | `handleDataTool("export_data", { format: "JSON" })` already implemented; need `/api/export?format=json` endpoint and download trigger from Settings UI |
| DATA-03 | Export goals as CSV | `formatCSV()` already implemented in `data-tools.ts`; expose via same `/api/export` endpoint with `format=csv` |
| DATA-04 | Export goals as Markdown | `formatMarkdown()` already implemented in `data-tools.ts`; expose via same `/api/export` endpoint with `format=markdown` |
| DATA-05 | Export goals as PDF report with visual charts | PDFKit for server-side PDF generation; programmatic layout with tables and progress bars (no browser/Puppeteer needed); requires `serverExternalPackages: ["pdfkit"]` in next.config.ts |
| DATA-06 | Export goals as DOCX | `docx` npm library (v9.6.1) for declarative DOCX generation; server-side in API route, returns buffer |
| DATA-07 | Automated database backups via cron pg_dump | Dokploy's native backup feature handles this via dashboard config; no application code needed, just Dokploy configuration |
| DATA-08 | Manual export button accessible from settings | Settings page UI with format selector dropdown and "Export" button that triggers `/api/export` download |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | ^1.0.4 | Command palette component | De facto standard for React command palettes; used by Linear, Raycast, Vercel; unstyled and composable; React 19 compatible from v1.0.4 |
| pdfkit | ^0.17+ | Server-side PDF generation | Pure Node.js, no browser dependency; native table support since 0.17; 2.8M+ monthly npm downloads; works in Next.js API routes |
| docx | ^9.6.1 | DOCX document generation | Declarative API for creating .docx files; works in Node.js and browser; `Packer.toBuffer()` for server-side generation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Command | (via codegen) | Styled wrapper around cmdk with Tailwind | Install via `npx shadcn@latest add command`; provides Dialog variant out of the box |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk | react-cmdk | Pre-styled but less flexible; cmdk + shadcn/ui gives the same result with more control |
| cmdk | kbar | More opinionated, heavier; cmdk is simpler and more widely adopted |
| pdfkit | jsPDF | jsPDF is primarily client-side; server-side Node.js support is secondary; PDFKit is built for Node.js first |
| pdfkit | Puppeteer/Playwright | Full browser rendering but massive dependency (~300MB Chromium); overkill for structured data reports |
| docx | docxtemplater | Template-based (requires .docx template file); `docx` is declarative and template-free |

**Installation:**
```bash
npm install cmdk pdfkit docx
npm install --save-dev @types/pdfkit
```

Additionally, install the shadcn Command component:
```bash
npx shadcn@latest add command
```

## Architecture Patterns

### Recommended Project Structure
```
components/
├── command-palette/
│   ├── command-palette.tsx      # Main palette component (cmdk + shadcn Dialog)
│   ├── command-actions.ts       # Action definitions (grouped by type)
│   └── keyboard-shortcuts.tsx   # Shortcut reference overlay
├── settings/
│   ├── export-section.tsx       # Export format selector + download button
│   └── import-section.tsx       # File upload for todos.json import
app/
├── api/
│   ├── export/
│   │   └── route.ts             # GET: returns file in requested format
│   ├── import/
│   │   └── route.ts             # POST: accepts JSON, creates goals/categories
│   └── goals/
│       └── search/
│           └── route.ts         # GET: search goals by query string
lib/
├── services/
│   └── export-service.ts        # PDF and DOCX generation logic
```

### Pattern 1: Command Palette with Global Keyboard Listener
**What:** A single `CommandPalette` component mounted at the app layout level, triggered by Cmd+K (Mac) / Ctrl+K (Windows), with actions that dispatch to existing stores and router.
**When to use:** For the global command palette that needs access to all app state.
**Example:**
```typescript
// Mounted in app/(app)/layout.tsx, not per-page
"use client";
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/stores/ui-store";
import { useTheme } from "next-themes";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { openGoalModal, setActiveView, toggleSidebar } = useUIStore();
  const { setTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}>
      <Command.Input value={query} onValueChange={setQuery} placeholder="Search goals or type a command..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        {/* Goal search results populated from API */}
        <Command.Group heading="Actions">
          <Command.Item onSelect={() => { openGoalModal("create"); setOpen(false); }}>
            Create New Goal
          </Command.Item>
          <Command.Item onSelect={() => { setActiveView("list"); setOpen(false); }}>
            Switch to List View
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

### Pattern 2: Debounced Search with Server Query
**What:** As the user types in the command palette, debounce the input and query `/api/goals/search?q=...` to get matching goals. Display them as selectable Command.Items.
**When to use:** For CMD-02 (search across all goals by title and description).
**Example:**
```typescript
// Inside CommandPalette, after query state:
const [results, setResults] = useState([]);

useEffect(() => {
  if (query.length < 2) { setResults([]); return; }
  const timeout = setTimeout(async () => {
    const res = await fetch(`/api/goals/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (res.ok) setResults(await res.json());
  }, 200); // 200ms debounce
  return () => clearTimeout(timeout);
}, [query]);
```

### Pattern 3: Global Keyboard Shortcuts via useEffect
**What:** A single `useKeyboardShortcuts` hook mounted at layout level that listens for key combinations and dispatches actions. Skips when focus is inside an input, textarea, or contenteditable.
**When to use:** For CMD-05 (keyboard shortcuts for navigation, create, complete, sidebar, theme).
**Example:**
```typescript
export function useKeyboardShortcuts() {
  const { openGoalModal, setActiveView, toggleSidebar } = useUIStore();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.key) {
        case "n": openGoalModal("create"); break;
        case "1": setActiveView("cards"); break;
        case "2": setActiveView("list"); break;
        case "3": setActiveView("board"); break;
        case "4": setActiveView("tree"); break;
        case "5": setActiveView("timeline"); break;
        case "b": toggleSidebar(); break;
        case "?": /* open shortcut reference */ break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openGoalModal, setActiveView, toggleSidebar, setTheme, theme]);
}
```

### Pattern 4: Server-side Export API Route
**What:** A single `/api/export` GET endpoint that accepts a `format` query parameter and returns the appropriate file as a downloadable response with correct Content-Type and Content-Disposition headers.
**When to use:** For DATA-02 through DATA-06.
**Example:**
```typescript
// app/api/export/route.ts
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  const format = new URL(request.url).searchParams.get("format") ?? "json";

  switch (format) {
    case "json": {
      const data = await exportJSON(auth.userId);
      return new NextResponse(data, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=ascend-export.json",
        },
      });
    }
    case "pdf": {
      const buffer = await exportPDF(auth.userId);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=ascend-report.pdf",
        },
      });
    }
    // ... csv, markdown, docx
  }
}
```

### Anti-Patterns to Avoid
- **Client-side PDF generation:** jsPDF or html2canvas in the browser produces inconsistent results across browsers and cannot access server-side data directly. Always generate PDF on the server.
- **Custom cron infrastructure for backups:** Dokploy has native pg_dump backup support with cron expressions; building a custom backup system in the application is unnecessary complexity.
- **Separate keyboard listener per component:** Mount one global listener in the layout; individual components should not fight for keyboard events.
- **Blocking search requests:** Always debounce the command palette search input. Without debounce, typing "goal" fires 4 API requests instead of 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command palette UI | Custom modal with input and filtered list | cmdk + shadcn Command | Accessible keyboard navigation, automatic filtering, item scoring, focus management, and screen reader support are extremely difficult to get right |
| PDF document layout | Manual canvas/SVG rendering or string concatenation of PDF syntax | PDFKit | PDF spec is complex (fonts, encoding, cross-reference tables); PDFKit handles all internals |
| DOCX document structure | Manual XML generation for OpenXML format | docx library | DOCX is a zipped XML format with complex schema; the docx library abstracts all OpenXML complexity |
| Database backup scheduling | Custom cron job in Docker, sidecar containers, or application-level scheduling | Dokploy native backups | Dokploy manages pg_dump scheduling, retention, and optional S3 offload through its dashboard |
| Keyboard shortcut system | Custom keyboard shortcut framework with chord support, context stacking | Plain `useEffect` + `addEventListener("keydown")` | The shortcut set is small (~10 shortcuts) and does not need a framework; a simple switch statement suffices |

**Key insight:** The data export formats (JSON, CSV, Markdown) are already fully implemented in the MCP data-tools module. The main work is creating API endpoints that reuse that logic and building the Settings page UI. PDF and DOCX require new libraries but follow the same buffer-response pattern.

## Common Pitfalls

### Pitfall 1: PDFKit Font Files Missing in Next.js Standalone Build
**What goes wrong:** PDFKit bundles `.afm` font metric files (e.g., Helvetica.afm) that Next.js webpack tracing fails to include in the standalone output, causing runtime errors.
**Why it happens:** Next.js standalone mode traces imports but cannot follow PDFKit's runtime `fs.readFileSync` calls for font data.
**How to avoid:** Add `"pdfkit"` to `serverExternalPackages` in `next.config.ts`, alongside the existing `"@modelcontextprotocol/sdk"` entry. This tells Next.js to use the full node_modules copy instead of webpack bundling.
**Warning signs:** Error message mentioning "Helvetica.afm" not found, or empty/corrupt PDF output.

### Pitfall 2: Command Palette Interferes with Text Inputs
**What goes wrong:** Global keyboard shortcuts fire while the user is typing in an input field, textarea, or the command palette's own search input.
**Why it happens:** The keydown listener is attached to `document` without checking the event target.
**How to avoid:** In the global keyboard handler, check `e.target.tagName` and `e.target.isContentEditable` before processing shortcuts. The command palette's own shortcuts (Cmd+K) should always work, but single-character shortcuts (like `n` for new goal, `?` for help) must be suppressed when focus is in a text field.
**Warning signs:** Typing "note" in a goal description triggers the "n" shortcut and opens the create goal modal.

### Pitfall 3: Command Palette Search Fires Too Many Requests
**What goes wrong:** Every keystroke in the command palette input triggers an API call to `/api/goals/search`.
**Why it happens:** No debounce on the search input onChange handler.
**How to avoid:** Debounce the search query by 200ms before fetching. Also set a minimum query length (2 characters) before initiating a search.
**Warning signs:** Network tab shows dozens of search requests when typing a single word.

### Pitfall 4: Large Export Files Block the Event Loop
**What goes wrong:** Exporting a large number of goals as PDF or DOCX blocks the Node.js event loop, causing request timeouts.
**Why it happens:** PDFKit and docx both do synchronous-heavy computation for document construction.
**How to avoid:** For the expected data volume (personal goal tracker, likely under 500 goals), this is unlikely to be an issue. If it becomes one, stream the PDFKit output via `doc.pipe()` instead of collecting it in memory. The docx library's `Packer.toBuffer()` is inherently async.
**Warning signs:** Export requests timing out after 30+ seconds.

### Pitfall 5: Zustand Persist Version Mismatch After Adding New State
**What goes wrong:** Adding new persisted state to UIStore without bumping the persist version causes existing localStorage to be in an inconsistent state.
**Why it happens:** Zustand's persist middleware compares the stored version with the current version; if they match, it uses the stored state as-is (which lacks the new fields).
**How to avoid:** Bump `version` from 4 to 5 in the UIStore persist config and add a migration callback for version 4 that adds any new default values.
**Warning signs:** Undefined values in store state, UI components crashing because expected state fields are missing.

### Pitfall 6: Dokploy Backup Not Configured for the Right Database
**What goes wrong:** The pg_dump backup runs but dumps an empty database or the wrong one.
**Why it happens:** The database name in the Dokploy backup config does not match the actual PostgreSQL database name used by the application.
**How to avoid:** Verify the database name from the `DATABASE_URL` environment variable and use that exact name in the Dokploy backup configuration.
**Warning signs:** Backup files are suspiciously small (a few KB for what should be significant data).

## Code Examples

### Server-side PDF Export with PDFKit
```typescript
// lib/services/export-service.ts
import PDFDocument from "pdfkit";
import { goalService } from "./goal-service";
import { categoryService } from "./category-service";

export async function exportPDF(userId: string): Promise<Buffer> {
  const [goals, categories] = await Promise.all([
    goalService.list(userId),
    categoryService.list(userId),
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(24).font("Helvetica-Bold").text("Ascend Goal Report");
    doc.fontSize(10).font("Helvetica").text(`Exported: ${new Date().toISOString()}`);
    doc.moveDown(2);

    // Group goals by horizon
    const horizons = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"];
    for (const horizon of horizons) {
      const filtered = goals.filter((g) => g.horizon === horizon);
      if (filtered.length === 0) continue;

      doc.fontSize(16).font("Helvetica-Bold").text(`${horizon.charAt(0) + horizon.slice(1).toLowerCase()} Goals`);
      doc.moveDown(0.5);

      for (const goal of filtered) {
        const status = goal.status === "COMPLETED" ? "[x]" : "[ ]";
        doc.fontSize(11).font("Helvetica").text(`${status} ${goal.title} (${goal.priority}) ${goal.progress}%`);
      }
      doc.moveDown(1);
    }

    doc.end();
  });
}
```

### Server-side DOCX Export with docx Library
```typescript
// lib/services/export-service.ts
import { Document, Paragraph, TextRun, HeadingLevel, Packer, Table, TableRow, TableCell, WidthType } from "docx";

export async function exportDOCX(userId: string): Promise<Buffer> {
  const [goals, categories] = await Promise.all([
    goalService.list(userId),
    categoryService.list(userId),
  ]);

  const sections = [];
  const horizons = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"];

  for (const horizon of horizons) {
    const filtered = goals.filter((g) => g.horizon === horizon);
    if (filtered.length === 0) continue;

    sections.push(
      new Paragraph({
        text: `${horizon.charAt(0) + horizon.slice(1).toLowerCase()} Goals`,
        heading: HeadingLevel.HEADING_2,
      }),
      ...filtered.map((goal) => new Paragraph({
        children: [
          new TextRun({ text: `${goal.status === "COMPLETED" ? "\u2611" : "\u2610"} ` }),
          new TextRun({ text: goal.title, bold: true }),
          new TextRun({ text: ` (${goal.priority}) ${goal.progress}%` }),
        ],
      })),
    );
  }

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "Ascend Goal Report", heading: HeadingLevel.TITLE }),
        new Paragraph({ text: `Exported: ${new Date().toISOString()}` }),
        ...sections,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
```

### Search API Endpoint
```typescript
// app/api/goals/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (q.length < 2) return NextResponse.json([]);
    const results = await goalService.search(auth.userId, q);
    return NextResponse.json(results);
  } catch (error) {
    return handleApiError(error);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom filter + modal for command palette | cmdk library (composable, accessible, unstyled) | cmdk v1.0 (2024) | Standard pattern for all React command palettes; shadcn/ui has built-in wrapper |
| Client-side PDF (jsPDF + html2canvas) | Server-side PDFKit or Puppeteer | Ongoing (2024+) | Consistent output, no browser dependency, works in API routes |
| Manual pg_dump cron via Docker exec | Dokploy native backup feature | Dokploy 2024+ | Dashboard configuration, retention management, S3 support built in |
| cmdk required React 18 only | cmdk v1.0.4+ supports React 19 | 2025 | Unblocks usage with Next.js 15+ and React 19 |

**Deprecated/outdated:**
- jsPDF for server-side use: While jsPDF has a Node.js build, PDFKit is the better fit for pure server-side generation. jsPDF's strength is client-side browser rendering.
- Custom backup sidecar containers: Dokploy's native backup eliminates the need for separate pg_dump Docker containers.

## Open Questions

1. **PDFKit chart rendering for DATA-05**
   - What we know: The requirement says "formatted PDF report with visual charts." PDFKit can draw rectangles, lines, and text, which is sufficient for progress bars. Full chart rendering (pie charts, line graphs) would require additional effort.
   - What's unclear: How sophisticated do the "visual charts" need to be? Simple progress bars are straightforward; complex charts would require a charting library that renders to canvas/SVG plus conversion.
   - Recommendation: Implement progress bars as colored rectangles in PDFKit for v1. This covers the spirit of "visual charts" without adding Puppeteer or a charting library. If more sophisticated charts are needed later, that can be a follow-up enhancement.

2. **File upload size limits for DATA-01 import**
   - What we know: Next.js API routes have a default body size limit (typically 1MB for JSON).
   - What's unclear: How large could a todos.json file realistically be?
   - Recommendation: For a personal goal tracker, the default limit should be fine. If needed, configure `bodyParser.sizeLimit` in the route config. This is unlikely to be an issue.

## Sources

### Primary (HIGH confidence)
- cmdk GitHub repository (https://github.com/dip/cmdk): API documentation, component props, React 19 compatibility confirmed in v1.0.4+
- docx GitHub repository (https://github.com/dolanmiu/docx): v9.6.1 confirmed, declarative API, Packer.toBuffer() pattern
- PDFKit GitHub repository (https://github.com/foliojs/pdfkit): v0.17+ with native table support, Node.js first design
- PDFKit issue #1549 (https://github.com/foliojs/pdfkit/issues/1549): serverExternalPackages fix confirmed for Next.js 15+
- cmdk issue #266 (https://github.com/dip/cmdk/issues/266): React 19 support confirmed resolved in v1.0.4
- Dokploy backup guide (https://massivegrid.com/blog/dokploy-automatic-database-backups/): Native pg_dump support with cron, retention, and S3

### Secondary (MEDIUM confidence)
- shadcn/ui Command component (https://ui.shadcn.com/docs/components/radix/command): shadcn wrapper around cmdk with Dialog variant
- NPM search results for docx, pdfkit, cmdk version verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all libraries verified via official repos and npm; cmdk React 19 compatibility confirmed; PDFKit Next.js fix documented
- Architecture: HIGH, patterns follow established project conventions (UIStore, API routes, service layer); command palette is a well-trodden pattern
- Pitfalls: HIGH, PDFKit font issue and keyboard shortcut interference are well-documented problems with known solutions

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, unlikely to change significantly)
