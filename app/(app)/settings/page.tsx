import { ApiKeySection } from "@/components/settings/api-key-section";
import { ImportSection } from "@/components/settings/import-section";
import { ExportSection } from "@/components/settings/export-section";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your data and preferences.
      </p>
      <div className="mt-6 max-w-2xl space-y-6">
        <ApiKeySection />
        <ImportSection />
        <ExportSection />
      </div>
    </div>
  );
}
