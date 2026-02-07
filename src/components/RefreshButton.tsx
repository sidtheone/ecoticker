"use client";

import { useState } from "react";
import { eventBus } from "@/lib/events";

export default function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    // Emit refresh event to all components
    eventBus.emit("ui-refresh");

    // Wait for components to finish refreshing (simulate)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setLastRefresh(new Date());
    setIsRefreshing(false);

    // Auto-reset after 3 seconds
    setTimeout(() => setLastRefresh(null), 3000);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="p-2 rounded-lg bg-[#e8dfd3] dark:bg-gray-800 text-stone-600 dark:text-gray-300 hover:bg-[#ddd3c4] dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Refresh dashboard data"
      aria-busy={isRefreshing}
      data-testid="refresh-button"
    >
      {isRefreshing ? (
        // Loading spinner
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-spin"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : lastRefresh ? (
        // Success checkmark
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        // Refresh icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      )}
    </button>
  );
}
