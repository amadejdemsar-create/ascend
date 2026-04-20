import { Badge } from "@/components/ui/badge";

const CONFIG: Record<
  "LOW" | "MEDIUM" | "HIGH",
  { className: string; label: string }
> = {
  HIGH: {
    className: "bg-destructive/10 text-destructive border-destructive/30",
    label: "High",
  },
  MEDIUM: {
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    label: "Medium",
  },
  LOW: {
    className: "bg-muted text-muted-foreground border-border",
    label: "Low",
  },
};

interface GoalPriorityBadgeProps {
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export function GoalPriorityBadge({ priority }: GoalPriorityBadgeProps) {
  const config = CONFIG[priority] ?? CONFIG.MEDIUM;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
