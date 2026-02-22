import Link from "next/link";
import type { Topic } from "@/lib/types";
import { changeDirectionColor, formatChange, CATEGORY_LABELS, severityColor, truncateToWord, relativeTime } from "@/lib/utils";
import UrgencyBadge from "./UrgencyBadge";
import ScoreInfoIcon from "./ScoreInfoIcon";
import Sparkline from "./Sparkline";
import SeverityGauge from "./SeverityGauge";

export default function TopicCard({ topic }: { topic: Topic }) {
  const colors = severityColor(topic.currentScore);
  const trimmedSummary = topic.impactSummary?.trim() ?? "";

  return (
    <Link
      href={`/topic/${topic.slug}`}
      style={{ borderLeft: `3px solid ${colors.border}` }}
      className="block bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4 hover:border-stone-400 dark:hover:border-gray-600 hover:shadow-lg transition-all"
      data-testid="topic-card"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-stone-800 dark:text-gray-100 leading-tight">{topic.name}</h3>
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <UrgencyBadge score={topic.currentScore} />
          <span className="text-xs px-2 py-0.5 rounded-full text-stone-400 bg-stone-100 dark:bg-gray-800 dark:text-gray-500" data-testid="category-chip">
            {CATEGORY_LABELS[topic.category]}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between mt-3">
        <div>
          <span className="text-3xl font-bold" style={{ color: colors.badge }} data-testid="score">
            {topic.currentScore}
          </span>
          <span
            className={`ml-2 text-sm font-medium ${changeDirectionColor(topic.change)}`}
            data-testid="change"
          >
            {formatChange(topic.change)}
          </span>
          <span className="ml-1"><ScoreInfoIcon /></span>
        </div>
        <div className="text-xs text-gray-500">
          {topic.articleCount} article{topic.articleCount !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="mt-2">
        <SeverityGauge score={topic.currentScore} compact height={6} />
      </div>

      {trimmedSummary && (
        <p className="mt-2 text-xs text-stone-500 dark:text-gray-400 truncate" data-testid="impact-summary">
          {truncateToWord(trimmedSummary, 120)}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        {topic.region ? (
          <div className="text-xs text-gray-500">{topic.region}</div>
        ) : <div />}
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
