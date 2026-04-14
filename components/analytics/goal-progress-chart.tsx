// Chart colors use Tailwind v4's var(--color-*) tokens (exposed by the
// @theme inline block in app/globals.css). Goal progress uses chart-6
// (emerald green) to distinguish it from todo completion (chart-1 indigo)
// and XP earned (chart-2 violet). With a dedicated green token the three
// analytics charts are now differentiated by hue as well as by shape and
// panel title.
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: Array<{ week: string; goalsProgressed: number }>;
}

export function GoalProgressChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="goalsProgressed"
          stroke="var(--color-chart-6)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-chart-6)" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
