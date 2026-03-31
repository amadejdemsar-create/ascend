import { ImportSection } from "@/components/settings/import-section";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your data and preferences.
      </p>
      <div className="mt-6 max-w-2xl">
        <ImportSection />
      </div>
    </div>
  );
}
