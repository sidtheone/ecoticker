import Link from "next/link";
import type { Topic } from "@/lib/types";
import { CATEGORY_LABELS, severityColor, truncateToWord, relativeTime } from "@/lib/utils";
import UrgencyBadge from "./UrgencyBadge";
import Sparkline from "./Sparkline";
import SeverityGauge from "./SeverityGauge";

export default function TopicCard({ topic }: { topic: Topic }) {
  const colors = severityColor(topic.currentScore);
  const trimmedSummary = topic.impactSummary?.trim() ?? "";

  return (
    <Link
      href={`/topic/${topic.slug}`}
      style={{ borderLeft: `3px solid ${colors.border}` }}
      className="block bg-[#f5f0e8] dark:bg-[#24243a] border border-[#e8dfd3] dark:border-[#2e2e48] rounded-lg p-4 pl-5 hover:border-stone-400 dark:hover:border-gray-600 hover:shadow-lg transition-all"
      data-testid="topic-card"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <UrgencyBadge score={topic.currentScore} />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xl font-mono font-bold" style={{ color: colors.badge }} data-testid="score">
            {topic.currentScore}
          </span>
          <span
            className="text-sm font-mono font-medium"
            style={{ color: colors.badge }}
            data-testid="change"
          >
            {topic.change > 0 ? `▲${topic.change}` : topic.change < 0 ? `▼${Math.abs(topic.change)}` : "─0"}
          </span>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-stone-800 dark:text-gray-100 leading-tight mt-1">{topic.name}</h3>

      <div className="mt-2">
        <SeverityGauge score={topic.currentScore} compact height={6} />
      </div>

      {trimmedSummary && (
        <p className="mt-2 text-xs text-stone-500 dark:text-gray-400 truncate" data-testid="impact-summary">
          {truncateToWord(trimmedSummary, 120)}
        </p>
      )}

      <div className="flex items-center justify-between mt-2 text-[11px] text-stone-400 dark:text-gray-500">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-gray-800" data-testid="category-chip">
            {CATEGORY_LABELS[topic.category]}
          </span>
          <span>{topic.articleCount} article{topic.articleCount !== 1 ? "s" : ""}</span>
          {topic.region && <span>{topic.region}</span>}
        </div>
        {topic.sparkline && topic.sparkline.length >= 2 && (
          <Sparkline data={topic.sparkline} color={colors.sparkline} />
        )}
      </div>

      <div className="mt-1 text-xs text-stone-400 dark:text-gray-500" data-testid="updated-at">
        Updated {relativeTime(topic.updatedAt)}
      </div>
    </Link>
  );
}
