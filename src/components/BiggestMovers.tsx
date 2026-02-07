"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { changeColor, formatChange } from "@/lib/utils";

interface Mover {
  name: string;
  slug: string;
  currentScore: number;
  change: number;
}

export default function BiggestMovers() {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/movers")
      .then((r) => r.json())
      .then((data) => setMovers(data.movers || []))
      .catch(() => setMovers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div data-testid="movers-loading" className="text-gray-500 text-sm">Loading movers...</div>;
  if (movers.length === 0) return null;

  return (
    <div data-testid="biggest-movers">
      <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">Biggest Movers</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {movers.map((m) => (
          <Link
            key={m.slug}
            href={`/topic/${m.slug}`}
            className="flex-shrink-0 bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg px-4 py-3 hover:border-stone-400 dark:hover:border-gray-600 transition-colors min-w-[160px]"
            data-testid="mover-card"
          >
            <div className="text-sm font-medium text-stone-700 dark:text-gray-200 truncate">{m.name}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-stone-800 dark:text-gray-100">{m.currentScore}</span>
              <span className={`text-sm font-medium ${changeColor(m.change)}`}>
                {formatChange(m.change)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
