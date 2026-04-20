import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../_landing/landing.css";

const TOC_ITEMS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "mcp-integration", label: "MCP Integration" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "claude-code", label: "Claude Code CLI" },
  { id: "cursor", label: "Cursor IDE" },
  { id: "vscode", label: "VS Code + Copilot" },
  { id: "windsurf", label: "Windsurf" },
  { id: "cline", label: "Cline" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "chatgpt", label: "ChatGPT Desktop" },
  { id: "perplexity", label: "Perplexity" },
  { id: "manus", label: "Manus" },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-[#0a0a0f] p-4 text-sm leading-relaxed text-zinc-300 border border-zinc-800">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-2xl font-bold text-white font-serif"
    >
      {children}
    </h2>
  );
}

function SubHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 text-lg font-semibold text-white"
    >
      {children}
    </h3>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400 ring-1 ring-inset ring-violet-500/20">
      {children}
    </span>
  );
}

export default function DocsPage() {
  return (
    <div
      className="landing-page landing-noise relative min-h-dvh bg-[#0F0F14] text-white dark"
      style={{ colorScheme: "dark" }}
    >
      {/* Floating gradient orbs (subtle) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="landing-orb landing-orb-1 opacity-[0.08]" />
        <div className="landing-orb landing-orb-2 opacity-[0.08]" />
      </div>

      {/* Nav */}
      <nav className="landing-glass-nav fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to Ascend
          </Link>
          <Link
            href="/dashboard"
            className="landing-shimmer rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/20"
          >
            Open App
          </Link>
        </div>
      </nav>

      {/* Developer docs notice */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-20">
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-zinc-400">
          <span className="font-medium text-violet-400">Developer Reference</span> — This page documents the MCP API for AI tool integrations. For app help, use <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs font-mono">?</kbd> inside the app or <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs font-mono">Cmd+K</kbd> to search.
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-6 pb-16">
        <div className="flex gap-12">
          {/* Sidebar TOC (desktop only) */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                On this page
              </p>
              <nav className="space-y-1">
                {TOC_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1 space-y-12">
            {/* Page header */}
            <div>
              <h1 className="font-serif text-4xl font-bold text-white sm:text-5xl">
                Documentation
              </h1>
              <p className="mt-4 text-lg text-zinc-400">
                Everything you need to set up Ascend and connect it to your AI workflow.
              </p>
            </div>

            <div className="landing-divider" />

            {/* Getting Started */}
            <section className="space-y-4">
              <SectionHeading id="getting-started">
                Getting Started
              </SectionHeading>
              <p className="text-zinc-400 leading-relaxed">
                Ascend is a goal tracking system that connects daily actions to yearly ambitions.
                It organizes your goals into four levels (yearly, quarterly, monthly, weekly)
                so every small task contributes to your bigger picture.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                You can use Ascend through the web app directly, or connect it to your favourite
                AI assistant through the Model Context Protocol (MCP). With MCP, your AI can
                create goals, log progress, check deadlines, and help you stay on track without
                ever leaving your coding environment or chat window.
              </p>
            </section>

            <div className="landing-divider" />

            {/* MCP Integration */}
            <section className="space-y-6">
              <SectionHeading id="mcp-integration">
                MCP Integration
              </SectionHeading>
              <p className="text-zinc-400 leading-relaxed">
                The Model Context Protocol (MCP) allows AI assistants to interact with Ascend
                programmatically. Once configured, your AI can create, update, and query your
                goals as part of your natural workflow.
              </p>

              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="text-sm text-violet-300 font-medium">API Key Required</p>
                <p className="mt-1 text-sm text-zinc-400">
                  To connect any AI tool to Ascend, you need an API key. You can find and copy
                  your API key from the{" "}
                  <Link href="/settings" className="text-violet-400 underline hover:text-violet-300">
                    Settings page
                  </Link>
                  .
                </p>
              </div>

              {/* Claude Desktop */}
              <div className="space-y-3">
                <SubHeading id="claude-desktop">Claude Desktop</SubHeading>
                <p className="text-sm text-zinc-400">
                  Open Settings &rarr; Developer &rarr; Edit Config, or directly edit the config file:
                </p>
                <ul className="list-disc pl-6 text-sm text-zinc-500 space-y-1">
                  <li>
                    macOS: <code className="text-zinc-300 font-mono text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                  </li>
                  <li>
                    Windows: <code className="text-zinc-300 font-mono text-xs">%APPDATA%\Claude\claude_desktop_config.json</code>
                  </li>
                </ul>
                <p className="text-sm text-zinc-400">Add the following to your config:</p>
                <CodeBlock>{`{
  "mcpServers": {
    "ascend": {
      "command": "npx",
      "args": ["-y", "ascend-goals-mcp"],
      "env": {
        "ASCEND_API_URL": "https://ascend.nativeai.agency",
        "ASCEND_API_KEY": "your-api-key"
      }
    }
  }
}`}</CodeBlock>
                <p className="text-sm text-zinc-500">
                  Restart Claude Desktop after saving the config.
                </p>
              </div>

              <div className="landing-divider" />

              {/* Claude Code CLI */}
              <div className="space-y-3">
                <SubHeading id="claude-code">Claude Code CLI</SubHeading>
                <p className="text-sm text-zinc-400">
                  Add the following to your <code className="text-zinc-300 font-mono text-xs">~/.claude.json</code> file:
                </p>
                <CodeBlock>{`{
  "mcpServers": {
    "ascend": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "ascend-goals-mcp"],
      "env": {
        "ASCEND_API_URL": "https://ascend.nativeai.agency",
        "ASCEND_API_KEY": "your-api-key"
      }
    }
  }
}`}</CodeBlock>
              </div>

              <div className="landing-divider" />

              {/* Cursor IDE */}
              <div className="space-y-3">
                <SubHeading id="cursor">Cursor IDE</SubHeading>
                <p className="text-sm text-zinc-400">
                  Create <code className="text-zinc-300 font-mono text-xs">.cursor/mcp.json</code> in your project root
                  (or <code className="text-zinc-300 font-mono text-xs">~/.cursor/mcp.json</code> for global):
                </p>
                <CodeBlock>{`{
  "mcpServers": {
    "ascend": {
      "command": "npx",
      "args": ["-y", "ascend-goals-mcp"],
      "env": {
        "ASCEND_API_URL": "https://ascend.nativeai.agency",
        "ASCEND_API_KEY": "your-api-key"
      }
    }
  }
}`}</CodeBlock>
              </div>

              <div className="landing-divider" />

              {/* VS Code + GitHub Copilot */}
              <div className="space-y-3">
                <SubHeading id="vscode">VS Code + GitHub Copilot</SubHeading>
                <p className="text-sm text-zinc-400">
                  Create <code className="text-zinc-300 font-mono text-xs">.vscode/mcp.json</code> in your workspace:
                </p>
                <CodeBlock>{`{
  "servers": {
    "ascend": {
      "command": "npx",
      "args": ["-y", "ascend-goals-mcp"],
      "env": {
        "ASCEND_API_URL": "https://ascend.nativeai.agency",
        "ASCEND_API_KEY": "your-api-key"
      }
    }
  }
}`}</CodeBlock>
              </div>

              <div className="landing-divider" />

              {/* Windsurf */}
              <div className="space-y-3">
                <SubHeading id="windsurf">Windsurf</SubHeading>
                <p className="text-sm text-zinc-400">
                  Edit <code className="text-zinc-300 font-mono text-xs">~/.codeium/windsurf/mcp_config.json</code>:
                </p>
                <CodeBlock>{`{
  "mcpServers": {
    "ascend": {
      "command": "npx",
      "args": ["-y", "ascend-goals-mcp"],
      "env": {
        "ASCEND_API_URL": "https://ascend.nativeai.agency",
        "ASCEND_API_KEY": "your-api-key"
      }
    }
  }
}`}</CodeBlock>
              </div>

              <div className="landing-divider" />

              {/* Cline */}
              <div className="space-y-3">
                <SubHeading id="cline">Cline (VS Code Extension)</SubHeading>
                <p className="text-sm text-zinc-400">
                  Open Cline Settings &rarr; MCP Servers tab &rarr; Add server, or edit
                  {" "}<code className="text-zinc-300 font-mono text-xs">cline_mcp_settings.json</code>:
                </p>
                <CodeBlock>{`{
  "mcpServers": {
    "ascend": {
      "command": "npx",
      "args": ["-y", "ascend-goals-mcp"],
      "env": {
        "ASCEND_API_URL": "https://ascend.nativeai.agency",
        "ASCEND_API_KEY": "your-api-key"
      }
    }
  }
}`}</CodeBlock>
              </div>

              <div className="landing-divider" />

              {/* Gemini CLI */}
              <div className="space-y-3">
                <SubHeading id="gemini-cli">Gemini CLI</SubHeading>
                <p className="text-sm text-zinc-400">
                  Edit <code className="text-zinc-300 font-mono text-xs">~/.gemini/settings.json</code>:
                </p>
                <CodeBlock>{`{
  "mcpServers": {
    "ascend": {
      "command": "npx",
      "args": ["-y", "ascend-goals-mcp"],
      "env": {
        "ASCEND_API_URL": "https://ascend.nativeai.agency",
        "ASCEND_API_KEY": "your-api-key"
      }
    }
  }
}`}</CodeBlock>
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
                  <p className="text-xs text-zinc-500">
                    Note: Only Gemini CLI supports MCP. The Gemini web app does not support MCP yet.
                  </p>
                </div>
              </div>

              <div className="landing-divider" />

              {/* ChatGPT Desktop */}
              <div className="space-y-3">
                <SubHeading id="chatgpt">ChatGPT Desktop</SubHeading>
                <Badge>Coming Soon</Badge>
                <p className="text-sm text-zinc-400">
                  ChatGPT Desktop supports remote MCP servers via Developer Mode
                  (Settings &rarr; Connectors &rarr; Advanced). Ascend will provide a hosted
                  remote MCP endpoint in a future update.
                </p>
                <p className="text-sm text-zinc-500">
                  Requires ChatGPT Plus or Pro subscription.
                </p>
              </div>

              <div className="landing-divider" />

              {/* Perplexity */}
              <div className="space-y-3">
                <SubHeading id="perplexity">Perplexity</SubHeading>
                <p className="text-sm text-zinc-400">
                  Open Perplexity (web or desktop) &rarr; Settings &rarr; MCP Connectors &rarr;
                  Add custom connector, then configure:
                </p>
                <ul className="list-disc pl-6 text-sm text-zinc-400 space-y-2">
                  <li>Name: <code className="text-zinc-300 font-mono text-xs">Ascend</code></li>
                  <li>MCP server URL: <code className="text-zinc-300 font-mono text-xs">https://ascend.nativeai.agency/api/mcp</code></li>
                  <li>Open the <strong className="text-zinc-300">Advanced</strong> section</li>
                  <li>Authentication: select <strong className="text-zinc-300">API Key</strong> or
                    <strong className="text-zinc-300"> Bearer Token</strong> and paste your Ascend API key</li>
                  <li>Transport: <strong className="text-zinc-300">Streamable HTTP</strong></li>
                  <li>Check the confirmation checkbox and click <strong className="text-zinc-300">Add</strong></li>
                </ul>
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
                  <p className="text-xs text-zinc-500">
                    If you only see OAuth as an authentication option, Ascend does not support
                    OAuth yet. In that case, select &quot;None&quot; for authentication and the
                    connection will work for read operations. Full authenticated access is planned.
                  </p>
                </div>
              </div>

              <div className="landing-divider" />

              {/* Manus */}
              <div className="space-y-3">
                <SubHeading id="manus">Manus</SubHeading>
                <Badge>Coming Soon</Badge>
                <p className="text-sm text-zinc-400">
                  Manus supports MCP through prebuilt connectors and custom MCP servers.
                  Ascend integration for Manus is planned for a future release.
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
