import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExternalSourceList } from "@/components/settings/external-source-list";
import { PageHeader } from "@/components/ui/page-header";

export default function IntegrationsPage() {
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
        title="Integrations"
        subtitle="Connect external data sources to read as virtual databases."
      />
      <div className="max-w-3xl">
        <ExternalSourceList />
      </div>
    </div>
  );
}
