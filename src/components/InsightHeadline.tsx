"use client";

import { useEffect, useState, useCallback } from "react";
import type { Topic, Urgency } from "@/lib/types";
import { scoreToUrgency } from "@/lib/utils";
import { eventBus } from "@/lib/events";

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

export default function InsightHeadline() {
  const [headline, setHeadline] = useState("Environmental News Impact Tracker");

  const fetchAndCompute = useCallback(async () => {
    try {
      const r = await fetch("/api/topics");
      if (!r.ok) return;
      const topics: Topic[] = await r.json();
      setHeadline(computeHeadline(topics));
    } catch {
      // keep fallback headline
    }
  }, []);

  useEffect(() => {
    fetchAndCompute();
  }, [fetchAndCompute]);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe("ui-refresh", fetchAndCompute);
    return unsubscribe;
  }, [fetchAndCompute]);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 dark:text-white" data-testid="insight-headline">
        {headline}
      </h1>
      <p className="text-sm sm:text-base text-stone-400 dark:text-gray-400 mt-1">EcoTicker</p>
    </div>
  );
}
