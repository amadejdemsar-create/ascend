// Chart colors use Tailwind v4's var(--color-*) tokens (exposed by the
// @theme inline block in app/globals.css). Those resolve to the oklch()
// values of the underlying design tokens. The previous hsl(var(--primary))
// pattern produced invalid CSS like hsl(oklch(...)) because --primary is
// stored as an oklch() string, not an HSL triplet.
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: Array<{ week: string; count: number }>;
}

export function TodoCompletionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar
          dataKey="count"
          fill="var(--color-chart-1)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
