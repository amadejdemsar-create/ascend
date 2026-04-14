// Chart colors use Tailwind v4's var(--color-*) tokens (exposed by the
// @theme inline block in app/globals.css). The previous hardcoded green
// was not part of the design system. Goal progress uses chart-1 (primary
// indigo) as the canonical "goals" accent; todo-completion also uses
// chart-1 (bar) and XP uses chart-2 (violet area), so the three charts
// are distinguished primarily by shape and panel title rather than hue.
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
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-chart-1)" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
