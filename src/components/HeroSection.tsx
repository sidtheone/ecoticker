"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Topic } from "@/lib/types";
import UrgencyBadge from "@/components/UrgencyBadge";
import SeverityGauge from "@/components/SeverityGauge";
import { computeHeadline } from "@/lib/utils";

function relativeTime(updatedAt: string): string {
  const hoursAgo = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 3600000);
  if (hoursAgo < 1) return "just now";
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  return `${Math.floor(hoursAgo / 24)}d ago`;
}

export default function HeroSection({ heroTopic }: { heroTopic: Topic | null }) {
  const [toast, setToast] = useState(false);
  const toastRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, []);

  if (!heroTopic) {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 dark:text-white" data-testid="insight-headline">
          Environmental News Impact Tracker
        </h1>
        <p className="text-sm sm:text-base text-stone-400 dark:text-gray-400 mt-1">EcoTicker</p>
      </div>
    );
  }

  const isDramatic = heroTopic.currentScore >= 30;
  const headline = computeHeadline([heroTopic]);

  async function handleShare() {
    try {
      const url = `${window.location.origin}/topic/${heroTopic!.slug}`;
      await navigator.clipboard.writeText(url);
      setToast(true);
      if (toastRef.current) clearTimeout(toastRef.current);
      toastRef.current = setTimeout(() => setToast(false), 3000);
    } catch {
      // clipboard can fail on HTTP, no focus, permission denied
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/topic/${heroTopic.slug}`} className="hover:underline">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-800 dark:text-white">
            {heroTopic.name}
          </h1>
        </Link>
        <UrgencyBadge score={heroTopic.currentScore} />
        <span
          data-testid="hero-score"
          className={`font-mono font-bold text-stone-800 dark:text-white ${isDramatic ? "text-[40px]" : "text-[28px]"}`}
        >
          {heroTopic.currentScore}
        </span>
      </div>
      <div className="mt-2 max-w-xs">
        <SeverityGauge score={heroTopic.currentScore} height={isDramatic ? 10 : 6} />
      </div>
      <p className="text-sm sm:text-base text-stone-600 dark:text-gray-300 mt-2" data-testid="insight-headline">
        {headline}
      </p>
      <div className="flex items-center gap-3 mt-2 text-sm text-stone-400 dark:text-gray-400">
        <span>Updated {relativeTime(heroTopic.updatedAt)}</span>
        <span>·</span>
        <button
          onClick={handleShare}
          className="hover:text-stone-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Share"
        >
          Share
        </button>
        {toast && (
          <span className="text-green-600 dark:text-green-400 text-xs">Link copied!</span>
        )}
      </div>
      <p className="text-sm sm:text-base text-stone-400 dark:text-gray-400 mt-1">EcoTicker</p>
    </div>
  );
}
