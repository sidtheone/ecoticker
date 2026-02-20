"use client";

import { useRouter } from "next/navigation";

export default function ScoreInfoIcon() {
  const router = useRouter();

  return (
    <span className="relative inline-block group">
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
        className="w-5 h-5 rounded-full bg-stone-300 dark:bg-gray-700 text-stone-600 dark:text-gray-300 text-xs font-bold leading-none hover:bg-stone-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-stone-400"
        aria-label="Scoring methodology"
        data-testid="score-info-icon"
      >
        ?
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-lg bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 shadow-lg text-xs text-stone-700 dark:text-gray-200 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity z-50">
        <p className="font-semibold mb-1">Severity Scale</p>
        <ul className="space-y-0.5">
          <li><span className="text-red-500 font-bold">76-100</span> SEVERE</li>
          <li><span className="text-orange-500 font-bold">51-75</span> SIGNIFICANT</li>
          <li><span className="text-yellow-500 font-bold">26-50</span> MODERATE</li>
          <li><span className="text-green-500 font-bold">0-25</span> MINIMAL</li>
        </ul>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); router.push("/scoring"); }}
          className="block mt-2 text-blue-600 dark:text-blue-400 hover:underline text-left"
          data-testid="score-info-link"
        >
          Learn more about our scoring →
        </button>
      </div>
    </span>
  );
}
