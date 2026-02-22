import type { Category, Urgency, Topic } from "./types";

export function urgencyRank(urgency: Urgency): number {
  switch (urgency) {
    case "informational": return 0;
    case "moderate": return 1;
    case "critical": return 2;
    case "breaking": return 3;
  }
}

export function computeHeadline(topics: Topic[]): string {
  if (topics.length === 0) return "Environmental News Impact Tracker";

  const escalated = topics.filter(
    (t) => urgencyRank(scoreToUrgency(t.currentScore)) > urgencyRank(scoreToUrgency(t.previousScore))
  );
  const deescalated = topics.filter(
    (t) => urgencyRank(scoreToUrgency(t.currentScore)) < urgencyRank(scoreToUrgency(t.previousScore))
  );

  // Rule 1: Single escalation
  if (escalated.length === 1) {
    return `${escalated[0].name} reached ${scoreToUrgency(escalated[0].currentScore).toUpperCase()}`;
  }
  // Rule 2: Multiple escalations
  if (escalated.length >= 2) {
    const highest = escalated.reduce((a, b) => (a.currentScore > b.currentScore ? a : b));
    return `${escalated.length} topics escalated — ${highest.name} reached ${scoreToUrgency(highest.currentScore).toUpperCase()}`;
  }
  // Rule 3: De-escalation (no escalations)
  if (deescalated.length > 0) {
    return `${deescalated[0].name} improved to ${scoreToUrgency(deescalated[0].currentScore).toUpperCase()}`;
  }
  // Rule 4: Large move without level change
  const biggestMove = topics.reduce((a, b) => (Math.abs(a.change) > Math.abs(b.change) ? a : b));
  if (Math.abs(biggestMove.change) > 10) {
    return `Biggest move: ${biggestMove.name} ${biggestMove.change > 0 ? "+" : ""}${biggestMove.change}`;
  }
  // Rule 5: All stable
  if (topics.every((t) => Math.abs(t.change) <= 5)) {
    return "All topics stable today";
  }
  // Rule 6: Fallback
  return "Environmental News Impact Tracker";
}

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

export interface SeverityColors {
  badge: string;
  gauge: string;
  border: string;
  text: string;
  sparkline: string;
  change: string;
}

export function severityColor(score: number): SeverityColors {
  if (score >= 80) {
    return { badge: "#dc2626", gauge: "#991b1b", border: "#dc2626", text: "Breaking", sparkline: "#dc2626", change: "text-red-400" };
  }
  if (score >= 60) {
    return { badge: "#c2410c", gauge: "#9a3412", border: "#c2410c", text: "Critical", sparkline: "#c2410c", change: "text-red-400" };
  }
  if (score >= 30) {
    return { badge: "#a16207", gauge: "#854d0e", border: "#a16207", text: "Moderate", sparkline: "#a16207", change: "text-yellow-400" };
  }
  return { badge: "#15803d", gauge: "#166534", border: "#15803d", text: "Informational", sparkline: "#15803d", change: "text-green-400" };
}

export function changeDirectionColor(change: number) {
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

export function computeHeroScore(topic: Topic): number {
  return topic.currentScore * 0.6 + Math.abs(topic.currentScore - topic.previousScore) * 0.4;
}

export function selectHeroTopic(topics: Topic[]): Topic | null {
  if (topics.length === 0) return null;
  return [...topics].sort((a, b) => {
    const scoreDiff = computeHeroScore(b) - computeHeroScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const dateDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.currentScore - a.currentScore;
  })[0];
}

export function truncateToWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 0) return "...";
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace <= 0) return truncated + "...";
  return truncated.slice(0, lastSpace) + "...";
}

export function relativeTime(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "unknown";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  // NOTE: No months/years formatting — timestamps older than ~30d show as "30d ago", "365d ago", etc.
  // This is MVP-acceptable since EcoTicker data is refreshed daily and old entries are uncommon.
  return `${diffDay}d ago`;
}

export function topicAbbreviation(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 8).toUpperCase();
  return (words[0].slice(0, 4) + "-" + words[words.length - 1].slice(0, 3)).toUpperCase();
}
