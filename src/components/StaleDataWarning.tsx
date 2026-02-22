"use client";

import { useEffect, useState } from "react";

type HealthData = {
  lastBatchAt: string | null;
  isStale: boolean;
};

// Formats a relative date description from a DATE string ("YYYY-MM-DD")
// Returns "today", "yesterday", or "X days ago" for stale dates.
// Uses explicit UTC midnight parsing ("T00:00:00Z") to avoid cross-browser
// timezone ambiguity — bare "YYYY-MM-DD" strings are parsed as local midnight
// in some environments, causing off-by-one errors near day boundaries.
function formatRelativeDate(lastBatchAt: string): string {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const today = new Date(todayUtc + "T00:00:00Z");
  const last = new Date(lastBatchAt + "T00:00:00Z");
  const diffMs = today.getTime() - last.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

export default function StaleDataWarning() {
  const [health, setHealth] = useState<HealthData | null>(null);

  // MVP accepted behavior: fetch runs on every mount. Navigation away and back
  // triggers a fresh fetch. This is intentional — staleness check is cheap and
  // the component is only mounted once per page load in normal usage.
  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) {
          console.error("[StaleDataWarning] /api/health returned", res.status);
          return null;
        }
        return res.json() as Promise<HealthData>;
      })
      .then((data) => {
        if (data) setHealth(data);
      })
      .catch((err) => {
        // Fail silent — don't block the page for a health check failure
        console.error("[StaleDataWarning] fetch failed:", err);
      });
  }, []);

  // Loading state — render nothing to avoid flash
  if (health === null) return null;

  // Empty database — no batch has ever run
  if (health.lastBatchAt === null) {
    return (
      <div
        data-testid="empty-db-state"
        className="bg-stone-100 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3 text-stone-600 dark:text-stone-400 text-sm mb-4"
      >
        We&apos;re monitoring the environment. Scores will appear after the next
        batch run at 6 AM UTC.
      </div>
    );
  }

  // Fresh data — render nothing
  if (!health.isStale) return null;

  // Stale data — show amber warning banner
  const relativeTime = formatRelativeDate(health.lastBatchAt);

  return (
    <div
      data-testid="stale-data-warning"
      className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-amber-800 dark:text-amber-200 text-sm mb-4"
    >
      Data may be outdated — last updated {relativeTime}. Next batch at 6 AM UTC.
    </div>
  );
}
