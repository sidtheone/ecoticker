"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function Sparkline({ data, color = "#6b7280" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const points = data.map((value) => ({ value }));

  return (
    <div className="w-16 h-8" data-testid="sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
