"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TopicDetail, ScoreHistoryEntry } from "@/lib/types";
import { changeColor, formatChange, scoreToUrgency, urgencyColor } from "@/lib/utils";
import { eventBus } from "@/lib/events";
import ScoreChart from "@/components/ScoreChart";
import ArticleList from "@/components/ArticleList";
import UrgencyBadge from "@/components/UrgencyBadge";
import ScoreInfoIcon from "@/components/ScoreInfoIcon";

const DIMENSIONS = [
  { key: "eco", label: "Ecological Impact", weight: "40%" },
  { key: "health", label: "Health Impact", weight: "35%" },
  { key: "econ", label: "Economic Impact", weight: "25%" },
] as const;

type DimensionKey = (typeof DIMENSIONS)[number]["key"];

function getDimensionScore(entry: ScoreHistoryEntry, key: DimensionKey): number | null {
  if (key === "eco") return entry.ecoScore;
  if (key === "health") return entry.healthScore;
  return entry.econScore;
}

function getDimensionLevel(entry: ScoreHistoryEntry, key: DimensionKey): string | null {
  if (key === "eco") return entry.ecoLevel;
  if (key === "health") return entry.healthLevel;
  return entry.econLevel;
}

function getDimensionReasoning(entry: ScoreHistoryEntry, key: DimensionKey): string | null {
  if (key === "eco") return entry.ecoReasoning;
  if (key === "health") return entry.healthReasoning;
  return entry.econReasoning;
}

function barColorClass(score: number): string {
  if (score >= 76) return "bg-red-500";
  if (score >= 51) return "bg-orange-500";
  if (score >= 26) return "bg-yellow-500";
  return "bg-green-500";
}

export default function TopicDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Topic not found");
  const [expandedDimensions, setExpandedDimensions] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (HTTP, no focus, permission denied)
    }
  };

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  const toggleReasoning = (key: string) => {
    setExpandedDimensions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchTopicData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const r = await fetch(`/api/topics/${slug}`);
      if (!r.ok) {
        setErrorMessage(r.status === 404 ? "Topic not found" : "Something went wrong. Please try again.");
        setError(true);
        return;
      }
      const d = await r.json();
      setData(d);
    } catch {
      setErrorMessage("Failed to load topic. Please check your connection.");
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchTopicData();
  }, [fetchTopicData]);

  // Listen for refresh events
  useEffect(() => {
    const unsubscribe = eventBus.subscribe("ui-refresh", fetchTopicData);
    return unsubscribe;
  }, [fetchTopicData]);

  if (loading) {
    return <div data-testid="detail-loading" className="text-gray-500 text-center py-12">Loading...</div>;
  }

  if (error || !data) {
    return (
      <div data-testid="detail-error" className="text-center py-12">
        <p className="text-gray-400 mb-4">{errorMessage}</p>
        <Link href="/" className="text-amber-700 dark:text-blue-400 hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const { topic, articles, scoreHistory } = data;
  const latest = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null;

  // Overall summary: prefer latest scoreHistory overallSummary, fall back to topic.impactSummary
  const summaryText = latest?.overallSummary ?? topic.impactSummary;

  // Check if all dimensions are INSUFFICIENT_DATA
  const allInsufficient = latest != null
    && getDimensionScore(latest, "eco") === -1
    && getDimensionScore(latest, "health") === -1
    && getDimensionScore(latest, "econ") === -1;

  return (
    <div data-testid="topic-detail">
      <Link href="/" className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-gray-300 mb-4 inline-block" data-testid="back-link">
        ← Back to dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-800 dark:text-white" data-testid="topic-name">{topic.name}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
            <UrgencyBadge urgency={topic.urgency} />
            {topic.region && <span className="text-sm text-stone-400 dark:text-gray-400">{topic.region}</span>}
            <span className="text-sm text-stone-400 dark:text-gray-500">{topic.category}</span>
            <button
              onClick={handleShare}
              className="text-sm px-3 py-1 rounded-md border border-stone-300 dark:border-gray-600 text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="share-button"
            >
              {copied ? "Link copied!" : "Share"}
            </button>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="flex items-center gap-2 sm:justify-end">
            <span className="text-3xl sm:text-4xl font-bold text-stone-800 dark:text-white" data-testid="detail-score">{topic.currentScore}</span>
            <ScoreInfoIcon />
          </div>
          <div className={`text-sm font-medium ${changeColor(topic.change)}`} data-testid="detail-change">
            {formatChange(topic.change)}
          </div>
        </div>
      </div>

      {summaryText && (
        <div className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4 mb-6" data-testid="impact-summary">
          <h3 className="text-sm font-semibold text-stone-600 dark:text-gray-300 mb-1">Impact Summary</h3>
          <p className="text-sm text-stone-500 dark:text-gray-400">{summaryText}</p>
        </div>
      )}

      {/* Sub-Score Breakdown */}
      {latest != null && !allInsufficient && (
        <div className="mb-6" data-testid="sub-score-breakdown">
          <h3 className="text-sm font-semibold text-stone-600 dark:text-gray-300 mb-3">Sub-Score Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DIMENSIONS.map(({ key, label, weight }) => {
              const score = getDimensionScore(latest, key);
              const level = getDimensionLevel(latest, key);
              const reasoning = getDimensionReasoning(latest, key);
              const isInsufficient = score === null || score === -1;

              if (isInsufficient) {
                return (
                  <div
                    key={key}
                    className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4"
                    data-testid={`dimension-card-${key}`}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <h4 className="text-sm font-semibold text-stone-600 dark:text-gray-300">{label}</h4>
                      <span className="text-xs text-stone-400 dark:text-gray-500">({weight} weight)</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-stone-400 dark:text-gray-500" data-testid={`dimension-score-${key}`}>N/A</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-500 dark:bg-gray-700 dark:text-gray-400" data-testid={`dimension-level-${key}`}>No Data</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-gray-700 mb-2" data-testid={`dimension-bar-${key}`} />
                    <p className="text-xs text-stone-400 dark:text-gray-500" data-testid={`dimension-reasoning-${key}`}>
                      Insufficient article data to assess this dimension
                    </p>
                  </div>
                );
              }

              const urgency = scoreToUrgency(score);
              const colors = urgencyColor(urgency);
              const levelText = level ?? urgency.toUpperCase();
              const expanded = expandedDimensions[key] ?? false;

              return (
                <div
                  key={key}
                  className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4"
                  data-testid={`dimension-card-${key}`}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <h4 className="text-sm font-semibold text-stone-600 dark:text-gray-300">{label}</h4>
                    <span className="text-xs text-stone-400 dark:text-gray-500">({weight} weight)</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-2xl font-bold ${colors.text}`} data-testid={`dimension-score-${key}`}>{score}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`} data-testid={`dimension-level-${key}`}>{levelText}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-gray-700 mb-2" data-testid={`dimension-bar-${key}`}>
                    <div
                      className={`h-full rounded-full ${barColorClass(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  {reasoning && (
                    <>
                      {/* Desktop: always visible */}
                      <p className="hidden sm:block text-xs text-stone-500 dark:text-gray-400" data-testid={`dimension-reasoning-${key}`}>
                        {reasoning}
                      </p>
                      {/* Mobile: toggle */}
                      <div className="sm:hidden">
                        <button
                          onClick={() => toggleReasoning(key)}
                          className="text-xs text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300"
                          data-testid={`reasoning-toggle-${key}`}
                        >
                          {expanded ? "Hide reasoning ▲" : "Show reasoning ▼"}
                        </button>
                        {expanded && (
                          <p className="text-xs text-stone-500 dark:text-gray-400 mt-1" data-testid={`dimension-reasoning-mobile-${key}`}>
                            {reasoning}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All dimensions insufficient notice */}
      {latest != null && allInsufficient && (
        <div className="mb-6 text-sm text-stone-400 dark:text-gray-500 italic" data-testid="sub-score-unavailable">
          Sub-score breakdown unavailable — insufficient article data
        </div>
      )}

      {/* Article count attribution */}
      <div className="mb-4 text-sm text-stone-500 dark:text-gray-400" data-testid="article-count-line">
        {topic.articleCount > 0
          ? `Latest score based on ${topic.articleCount} article${topic.articleCount !== 1 ? "s" : ""}`
          : "No articles available for this topic"}
      </div>

      <div className="mb-6">
        <ScoreChart history={scoreHistory} />
      </div>

      <ArticleList articles={articles} />
    </div>
  );
}
