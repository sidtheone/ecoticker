"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TickerItem } from "@/lib/types";
import { eventBus } from "@/lib/events";
import { severityColor, topicAbbreviation, formatChange } from "@/lib/utils";

export default function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    async function fetchTicker() {
      try {
        const res = await fetch("/api/ticker");
        const data = await res.json();
        setItems(data.items || []);
      } catch {
        // Silently fail — ticker is non-critical
      }
    }

    // Initial fetch
    fetchTicker();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchTicker, 5 * 60 * 1000);

    // Listen for manual refresh events
    const unsubscribe = eventBus.subscribe("ui-refresh", fetchTicker);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div
      className="sticky top-0 z-50 bg-[#f0ebe1] dark:bg-gray-950 border-b border-[#e8dfd3] dark:border-gray-800 overflow-hidden"
      role="region"
      aria-label="Environmental topic scores"
    >
      <div className="ticker-scroll flex whitespace-nowrap py-2">
        {doubled.map((item, i) => {
          const colors = severityColor(item.score);
          return (
            <Link
              key={`${item.slug}-${i}`}
              href={`/topic/${item.slug}`}
              aria-hidden={i >= items.length ? "true" : undefined}
              className="inline-flex items-center gap-2 px-4 text-sm hover:bg-[#e8dfd3] dark:hover:bg-gray-900 transition-colors"
            >
              <span className="text-stone-600 dark:text-gray-300 font-mono font-bold">{topicAbbreviation(item.name)}</span>
              <span className="font-mono font-bold" style={{ color: colors.badge }}>{item.score}</span>
              <span style={{ color: colors.badge }}>
                {formatChange(item.change)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
