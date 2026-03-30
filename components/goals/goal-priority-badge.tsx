import { Badge } from "@/components/ui/badge";

const PRIORITY_CONFIG = {
  HIGH: { label: "High", variant: "destructive" as const },
  MEDIUM: { label: "Medium", variant: "secondary" as const },
  LOW: { label: "Low", variant: "outline" as const },
} as const;

interface GoalPriorityBadgeProps {
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export function GoalPriorityBadge({ priority }: GoalPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.MEDIUM;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
