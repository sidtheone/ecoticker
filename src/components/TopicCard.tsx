import Link from "next/link";
import type { Topic } from "@/lib/types";
import { changeColor, formatChange } from "@/lib/utils";
import UrgencyBadge from "./UrgencyBadge";
import Sparkline from "./Sparkline";

const scoreColors: Record<string, string> = {
  "text-red-500": "#ef4444",
  "text-orange-500": "#f97316",
  "text-yellow-500": "#eab308",
  "text-green-500": "#22c55e",
};

export default function TopicCard({ topic }: { topic: Topic }) {
  const scoreColor =
    topic.currentScore >= 80
      ? "text-red-500"
      : topic.currentScore >= 60
        ? "text-orange-500"
        : topic.currentScore >= 30
          ? "text-yellow-500"
          : "text-green-500";

  return (
    <Link
      href={`/topic/${topic.slug}`}
      className="block bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4 hover:border-stone-400 dark:hover:border-gray-600 hover:shadow-lg transition-all"
      data-testid="topic-card"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-stone-800 dark:text-gray-100 leading-tight">{topic.name}</h3>
        <UrgencyBadge urgency={topic.urgency} />
      </div>

      <div className="flex items-end justify-between mt-3">
        <div>
          <span className={`text-3xl font-bold ${scoreColor}`} data-testid="score">
            {topic.currentScore}
          </span>
          <span
            className={`ml-2 text-sm font-medium ${changeColor(topic.change)}`}
            data-testid="change"
          >
            {formatChange(topic.change)}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {topic.articleCount} article{topic.articleCount !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        {topic.region ? (
          <div className="text-xs text-gray-500">{topic.region}</div>
        ) : <div />}
        {topic.sparkline && topic.sparkline.length >= 2 && (
          <Sparkline data={topic.sparkline} color={scoreColors[scoreColor]} />
        )}
      </div>
    </Link>
  );
}
