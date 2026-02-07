import type { Urgency } from "./types";

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
