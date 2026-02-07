"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ScoreHistoryEntry } from "@/lib/types";

export default function ScoreChart({ history }: { history: ScoreHistoryEntry[] }) {
  if (history.length === 0) {
    return <div data-testid="score-chart-empty" className="text-gray-500 text-sm">No score history available</div>;
  }

  const data = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: h.score,
    health: h.healthScore,
    eco: h.ecoScore,
    econ: h.econScore,
  }));

  return (
    <div data-testid="score-chart" className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Score History</h3>
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
              labelStyle={{ color: "#e5e7eb" }}
            />
            <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={false} name="Overall" />
            <Line type="monotone" dataKey="health" stroke="#22c55e" strokeWidth={1} dot={false} name="Health" />
            <Line type="monotone" dataKey="eco" stroke="#3b82f6" strokeWidth={1} dot={false} name="Ecological" />
            <Line type="monotone" dataKey="econ" stroke="#eab308" strokeWidth={1} dot={false} name="Economic" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
