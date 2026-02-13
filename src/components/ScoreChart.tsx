"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ScoreHistoryEntry } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

const DIMENSION_COLORS = {
  overall: "#ef4444",
  health: "#8b5cf6",
  eco: "#06b6d4",
  econ: "#f59e0b",
} as const;

const DIMENSIONS = [
  { key: "eco" as const, label: "Ecology", weight: "40%" },
  { key: "health" as const, label: "Health", weight: "35%" },
  { key: "econ" as const, label: "Economy", weight: "25%" },
];

export default function ScoreChart({ history }: { history: ScoreHistoryEntry[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [visible, setVisible] = useState({ health: false, eco: false, econ: false });

  if (history.length === 0) {
    return <div data-testid="score-chart-empty" className="text-gray-500 text-sm">No score history available</div>;
  }

  const data = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: h.score,
    health: h.healthScore === -1 ? null : h.healthScore,
    eco: h.ecoScore === -1 ? null : h.ecoScore,
    econ: h.econScore === -1 ? null : h.econScore,
  }));

  const gridColor = isDark ? "#374151" : "#e8dfd3";
  const tickColor = isDark ? "#9ca3af" : "#78716c";
  const tooltipBg = isDark ? "#1f2937" : "#f5f0e8";
  const tooltipBorder = isDark ? "#374151" : "#e8dfd3";
  const tooltipLabel = isDark ? "#e5e7eb" : "#44403c";

  return (
    <div data-testid="score-chart" className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-stone-600 dark:text-gray-300 mb-3">Score History</h3>
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: tickColor, fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "8px" }}
              labelStyle={{ color: tooltipLabel }}
            />
            <Line type="monotone" dataKey="score" stroke={DIMENSION_COLORS.overall} strokeWidth={2} dot={false} name="Overall" />
            {visible.health && <Line type="monotone" dataKey="health" stroke={DIMENSION_COLORS.health} strokeWidth={1} dot={false} name="Health (35%)" connectNulls={false} />}
            {visible.eco && <Line type="monotone" dataKey="eco" stroke={DIMENSION_COLORS.eco} strokeWidth={1} dot={false} name="Ecology (40%)" connectNulls={false} />}
            {visible.econ && <Line type="monotone" dataKey="econ" stroke={DIMENSION_COLORS.econ} strokeWidth={1} dot={false} name="Economy (25%)" connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {DIMENSIONS.map(({ key, label, weight }) => (
          <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer text-stone-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={visible[key]}
              onChange={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
              className="cursor-pointer"
              data-testid={`toggle-${key}`}
            />
            <span style={{ color: DIMENSION_COLORS[key] }}>●</span>
            {label} ({weight})
          </label>
        ))}
      </div>
    </div>
  );
}
