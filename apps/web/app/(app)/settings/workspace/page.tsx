import type { Metadata } from "next";
import { WorkspaceSettingsPage } from "@/components/workspace/workspace-settings-page";

export const metadata: Metadata = {
  title: "Workspace settings",
};

export default function Page() {
  return <WorkspaceSettingsPage />;
}
