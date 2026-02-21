import type { Category, Urgency } from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  air_quality: "Air Quality",
  deforestation: "Deforestation",
  ocean: "Ocean",
  climate: "Climate",
  pollution: "Pollution",
  biodiversity: "Biodiversity",
  wildlife: "Wildlife",
  energy: "Energy",
  waste: "Waste",
  water: "Water",
};

export function urgencyColor(urgency: Urgency) {
  switch (urgency) {
    case "breaking":
      return { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" };
    case "critical":
      return { text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" };
    case "moderate":
      return { text: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
    case "informational":
      return { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" };
  }
}

export function changeColor(change: number) {
  if (change > 0) return "text-red-400";
  if (change < 0) return "text-green-400";
  return "text-gray-400";
}

export function formatChange(change: number) {
  if (change > 0) return `+${change} ▲`;
  if (change < 0) return `${change} ▼`;
  return "0 ─";
}

export function scoreToUrgency(score: number): Urgency {
  if (score >= 80) return "breaking";
  if (score >= 60) return "critical";
  if (score >= 30) return "moderate";
  return "informational";
}

export function scoreToHex(score: number): string {
  if (score >= 80) return "#ef4444"; // red-500
  if (score >= 60) return "#f97316"; // orange-500
  if (score >= 30) return "#eab308"; // yellow-500
  return "#22c55e"; // green-500
}
