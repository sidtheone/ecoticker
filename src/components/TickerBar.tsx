"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TickerItem } from "@/lib/types";
import { eventBus } from "@/lib/events";

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
    <div className="sticky top-0 z-50 bg-[#f0ebe1] dark:bg-gray-950 border-b border-[#e8dfd3] dark:border-gray-800 overflow-hidden" role="marquee" aria-label="Environmental topic scores ticker">
      <div className="ticker-scroll flex whitespace-nowrap py-2">
        {doubled.map((item, i) => (
          <Link
            key={`${item.slug}-${i}`}
            href={`/topic/${item.slug}`}
            className="inline-flex items-center gap-2 px-4 text-sm hover:bg-[#e8dfd3] dark:hover:bg-gray-900 transition-colors"
            aria-label={`${item.name}: score ${item.score}, change ${item.change > 0 ? "+" : ""}${item.change}`}
          >
            <span className="text-stone-600 dark:text-gray-300 font-medium">{item.name}</span>
            <span className="text-stone-800 dark:text-white font-bold">{item.score}</span>
            <span className={item.change > 0 ? "text-red-400" : item.change < 0 ? "text-green-400" : "text-gray-500"}>
              {item.change > 0 ? `+${item.change} ▲` : item.change < 0 ? `${item.change} ▼` : "0 ─"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
