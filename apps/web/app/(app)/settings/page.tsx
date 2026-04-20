import { AppearanceSection } from "@/components/settings/appearance-section";
import { ShortcutsSection } from "@/components/settings/shortcuts-section";
import { ApiKeySection } from "@/components/settings/api-key-section";
import { ImportSection } from "@/components/settings/import-section";
import { ExportSection } from "@/components/settings/export-section";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your data and preferences."
      />
      <div className="max-w-2xl space-y-6">
        <AppearanceSection />
        <ShortcutsSection />
        <ApiKeySection />
        <ImportSection />
        <ExportSection />
      </div>
    </div>
  );
}
