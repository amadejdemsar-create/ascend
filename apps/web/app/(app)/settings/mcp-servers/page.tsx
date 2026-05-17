import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { McpServerList } from "@/components/settings/mcp-server-list";
import { PageHeader } from "@/components/ui/page-header";

export default function McpServersPage() {
  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Settings
      </Link>
      <PageHeader
        title="MCP servers"
        subtitle="Connect external MCP servers and federate their tools."
      />
      <div className="max-w-3xl">
        <McpServerList />
      </div>
    </div>
  );
}
