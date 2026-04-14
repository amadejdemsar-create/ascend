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
            <stop offset="5%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="hsl(270, 70%, 60%)"
          strokeWidth={2}
          fill="url(#xpGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
