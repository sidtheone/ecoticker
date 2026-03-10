import Link from "next/link";
import type { Topic } from "@/lib/types";
import { severityColor, formatChange } from "@/lib/utils";
import UrgencyBadge from "@/components/UrgencyBadge";
import SeverityGauge from "@/components/SeverityGauge";

export default function TopicList({ topics }: { topics: Topic[] }) {
  if (topics.length === 0) {
    return <div data-testid="topic-list" />;
  }

  return (
    <div data-testid="topic-list" className="flex flex-col gap-1">
      {topics.map((topic) => (
        <div
          key={topic.id}
          data-testid="topic-list-row"
          className="flex items-center gap-3 px-3 py-2 rounded-md bg-stone-50 dark:bg-gray-900 border border-stone-200 dark:border-gray-800"
        >
          <span
            className="font-mono font-bold text-sm w-8 shrink-0 text-right"
            style={{ color: severityColor(topic.currentScore).badge }}
          >
            {topic.currentScore}
          </span>
          <Link
            href={`/topic/${topic.slug}`}
            className="flex-1 text-sm font-medium text-stone-800 dark:text-gray-200 hover:underline truncate"
          >
            {topic.name}
          </Link>
          <span className="text-xs font-mono text-stone-500 dark:text-gray-400 shrink-0">
            {formatChange(topic.change)}
          </span>
          <UrgencyBadge score={topic.currentScore} />
          <div className="w-16 shrink-0">
            <SeverityGauge score={topic.currentScore} compact />
          </div>
        </div>
      ))}
    </div>
  );
}
