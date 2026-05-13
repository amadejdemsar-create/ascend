import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { ShortcutsSection } from "@/components/settings/shortcuts-section";
import { ApiKeySection } from "@/components/settings/api-key-section";
import { ImportSection } from "@/components/settings/import-section";
import { ExportSection } from "@/components/settings/export-section";
import { LlmProviderPicker } from "@/components/settings/llm-provider-picker";
import { LlmUsagePanel } from "@/components/settings/llm-usage-panel";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your data and preferences."
      />
      <div className="max-w-2xl space-y-6">
        {/* Workspace nav card */}
        <Link
          href="/settings/workspace"
          className="group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Workspace</p>
            <p className="text-xs text-muted-foreground">
              Name, members, and workspace settings
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <LlmProviderPicker />
        <LlmUsagePanel />
        <AppearanceSection />
        <ShortcutsSection />
        <ApiKeySection />
        <ImportSection />
        <ExportSection />
      </div>
    </div>
  );
}
