// Chart colors use Tailwind v4's var(--color-*) tokens (exposed by the
// @theme inline block in app/globals.css). XP uses chart-2 (violet) to
// distinguish it from the primary/indigo todo-completion chart.
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: Array<{ week: string; amount: number }>;
}

export function XpEarnedChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-chart-2)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-chart-2)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          fill="url(#xpGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
