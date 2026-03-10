"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Topic } from "@/lib/types";
import UrgencyBadge from "@/components/UrgencyBadge";
import SeverityGauge from "@/components/SeverityGauge";
import { computeHeadline, severityColor, formatChange, relativeTime } from "@/lib/utils";

export default function HeroSection({ heroTopic, headline: headlineProp }: { heroTopic: Topic | null; headline?: string }) {
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
  const headline = headlineProp ?? computeHeadline([heroTopic]);
  const colors = severityColor(heroTopic.currentScore);

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
    <div
      className="pl-5 py-2"
      style={{ borderLeft: `4px solid ${colors.border}` }}
    >
      <div className="flex gap-6 items-start">
        <span
          data-testid="hero-score"
          className={`font-mono font-bold shrink-0 ${isDramatic ? "text-[72px]" : "text-[48px]"}`}
          style={{ color: colors.badge }}
        >
          {heroTopic.currentScore}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/topic/${heroTopic.slug}`} className="hover:underline">
              <h1 className="text-[22px] font-semibold text-stone-800 dark:text-white">
                {heroTopic.name}
              </h1>
            </Link>
            <UrgencyBadge score={heroTopic.currentScore} />
            <span className="font-mono text-sm" style={{ color: colors.badge }}>
              {formatChange(heroTopic.change)}
            </span>
          </div>
          <p className="text-sm sm:text-base text-stone-600 dark:text-gray-300 mt-1" data-testid="insight-headline">
            {headline}
          </p>
          {heroTopic.impactSummary && (
            <p className="text-sm sm:text-base text-stone-600 dark:text-gray-300 mt-1" data-testid="impact-summary">
              {heroTopic.impactSummary}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4">
        <SeverityGauge score={heroTopic.currentScore} />
      </div>
      <div className="flex items-center gap-3 mt-3 text-sm text-stone-400 dark:text-gray-400">
        <span>Updated {relativeTime(heroTopic.updatedAt)}</span>
        <span>·</span>
        <button
          onClick={handleShare}
          className="border border-stone-300 dark:border-gray-600 rounded-md px-3 py-0.5 text-xs font-semibold hover:text-stone-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Share"
        >
          Share
        </button>
        {toast && (
          <span className="text-green-600 dark:text-green-400 text-xs">Link copied!</span>
        )}
      </div>
    </div>
  );
}
