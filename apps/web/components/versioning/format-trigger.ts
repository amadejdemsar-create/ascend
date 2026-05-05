import type { VersionTrigger } from "@/lib/validations";

export interface TriggerDisplay {
  label: string;
  tone: "neutral" | "info" | "warning";
}

export function formatTrigger(trigger: VersionTrigger): TriggerDisplay {
  switch (trigger) {
    case "EDIT_DEBOUNCED":
      return { label: "Auto-saved", tone: "neutral" };
    case "EDIT_BLUR":
      return { label: "Saved", tone: "neutral" };
    case "EDIT_EXPLICIT":
      return { label: "Saved", tone: "neutral" };
    case "RESTORE":
      return { label: "Restored", tone: "info" };
    case "BRANCH":
      return { label: "Branched", tone: "info" };
    case "BACKFILL":
      return { label: "Backfill", tone: "warning" };
    case "MIGRATION":
      return { label: "Migration", tone: "warning" };
  }
}
