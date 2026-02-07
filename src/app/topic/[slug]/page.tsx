"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TopicDetail } from "@/lib/types";
import { changeColor, formatChange } from "@/lib/utils";
import ScoreChart from "@/components/ScoreChart";
import ArticleList from "@/components/ArticleList";
import UrgencyBadge from "@/components/UrgencyBadge";

export default function TopicDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/topics/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div data-testid="detail-loading" className="text-gray-500 text-center py-12">Loading...</div>;
  }

  if (error || !data) {
    return (
      <div data-testid="detail-error" className="text-center py-12">
        <p className="text-gray-400 mb-4">Topic not found</p>
        <Link href="/" className="text-blue-400 hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const { topic, articles, scoreHistory } = data;

  return (
    <div data-testid="topic-detail">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block" data-testid="back-link">
        ← Back to dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white" data-testid="topic-name">{topic.name}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
            <UrgencyBadge urgency={topic.urgency} />
            {topic.region && <span className="text-sm text-gray-400">{topic.region}</span>}
            <span className="text-sm text-gray-500">{topic.category}</span>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-3xl sm:text-4xl font-bold text-white" data-testid="detail-score">{topic.currentScore}</div>
          <div className={`text-sm font-medium ${changeColor(topic.change)}`} data-testid="detail-change">
            {formatChange(topic.change)}
          </div>
        </div>
      </div>

      {topic.impactSummary && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6" data-testid="impact-summary">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Impact Summary</h3>
          <p className="text-sm text-gray-400">{topic.impactSummary}</p>
        </div>
      )}

      <div className="mb-6">
        <ScoreChart history={scoreHistory} />
      </div>

      <ArticleList articles={articles} />
    </div>
  );
}
