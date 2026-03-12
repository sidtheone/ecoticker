"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TopicDetail, ScoreHistoryEntry } from "@/lib/types";
import { changeDirectionColor, formatChange, relativeTime, severityColor } from "@/lib/utils";
import { eventBus } from "@/lib/events";
import ScoreChart from "@/components/ScoreChart";
import ArticleList from "@/components/ArticleList";
import UrgencyBadge from "@/components/UrgencyBadge";
import SeverityGauge from "@/components/SeverityGauge";

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
    return (
      <div data-testid="detail-loading" className="animate-pulse space-y-4 py-6">
        <div className="h-7 bg-stone-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-12 bg-stone-200 dark:bg-gray-700 rounded w-32" />
        <div className="h-4 bg-stone-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-stone-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div data-testid="detail-error" className="text-center py-12">
        <p className="text-gray-400 mb-4">{errorMessage}</p>
        <Link href="/" className="text-amber-700 dark:text-blue-400 hover:underline">← Back</Link>
      </div>
    );
  }

  const { topic, articles, scoreHistory } = data;
  const latest = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null;

  // Overall summary: prefer latest scoreHistory overallSummary, fall back to topic.impactSummary
  const summaryText = latest?.overallSummary || topic.impactSummary || null;

  // Check if all dimensions are INSUFFICIENT_DATA
  const allInsufficient = latest != null
    && getDimensionScore(latest, "eco") === -1
    && getDimensionScore(latest, "health") === -1
    && getDimensionScore(latest, "econ") === -1;

  const colors = severityColor(topic.currentScore);
  const isDramatic = topic.currentScore >= 30;

  return (
    <div data-testid="topic-detail">
      {/* De-emphasized back link — always in DOM for keyboard accessibility */}
      <Link
        href="/"
        className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-gray-300 mb-4 inline-block"
        data-testid="back-link"
      >
        ← Back
      </Link>

      {/* ── Score Hero ───────────────────────────────────────────────────────── */}
      <section data-testid="score-hero" className="mb-6">
        {/* Giant score — top of section */}
        <span
          className={`font-mono font-bold ${isDramatic ? "text-[72px]" : "text-[48px]"}`}
          style={{ color: colors.badge }}
          data-testid="detail-score"
        >
          {topic.currentScore}
        </span>

        {/* Badge + change on a new line below score */}
        <div className="flex items-center gap-3">
          <UrgencyBadge score={topic.currentScore} />
          <div className={`text-sm font-medium ${changeDirectionColor(topic.change)}`} data-testid="detail-change">
            {formatChange(topic.change)}
          </div>
        </div>

        {/* Topic name below badge line */}
        <h1
          className="text-[22px] font-semibold text-stone-800 dark:text-white line-clamp-2"
          data-testid="topic-name"
        >
          {topic.name}
        </h1>

        {/* Full-width gauge below name */}
        <SeverityGauge score={topic.currentScore} />

        {topic.region && (
          <div className="mt-2 text-sm text-stone-400 dark:text-gray-400">{topic.region}</div>
        )}

        {/* Metadata line: share + updated time */}
        <div className="flex items-center gap-3 mt-3 text-sm text-stone-400">
          <button
            onClick={handleShare}
            className="text-sm px-3 py-1 rounded-md border border-stone-300 dark:border-gray-600 text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-800 transition-colors"
            data-testid="share-button"
          >
            {copied ? "Link copied!" : "Share"}
          </button>
          {topic.updatedAt && (
            <span>Updated {relativeTime(topic.updatedAt)}</span>
          )}
        </div>
      </section>

      {/* ── Insight Lede ─────────────────────────────────────────────────────── */}
      {summaryText && (
        <section
          data-testid="insight-lede"
          className="mb-6 pl-5 py-2"
          style={{ borderLeft: `4px solid ${colors.border}` }}
        >
          <p className="text-base text-stone-700 dark:text-gray-200 leading-relaxed">{summaryText}</p>
        </section>
      )}

      {/* ── Dimension Body ───────────────────────────────────────────────────── */}
      {latest != null && !allInsufficient && (
        <section className="mb-6" data-testid="sub-score-breakdown">
          <h2 className="text-sm font-semibold text-stone-600 dark:text-gray-300 mb-3">Dimensions</h2>
          <div className="flex flex-col gap-1">
            {DIMENSIONS.map(({ key, label }) => {
              const score = getDimensionScore(latest, key);
              const level = getDimensionLevel(latest, key);
              const reasoning = getDimensionReasoning(latest, key);
              const isInsufficient = score === null || score === -1;

              if (isInsufficient) {
                return (
                  <div
                    key={key}
                    className="flex flex-col"
                    data-testid={`dimension-row-${key}`}
                    style={{ borderLeft: "4px solid #d6d3d1" }}
                  >
                    <div className="flex items-center gap-3 px-3 py-2">
                      <span className="font-mono font-bold text-sm w-8 shrink-0 text-right text-stone-400 dark:text-gray-500" data-testid={`dimension-score-${key}`}>N/A</span>
                      <span className="flex-1 text-sm font-medium text-stone-800 dark:text-gray-200">{label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-500 dark:bg-gray-700 dark:text-gray-400" data-testid={`dimension-level-${key}`}>No Data</span>
                      <div className="w-16 shrink-0">
                        <SeverityGauge score={0} compact />
                      </div>
                    </div>
                    <p className="text-xs text-stone-400 dark:text-gray-500 px-3 pb-2" data-testid={`dimension-reasoning-${key}`}>
                      Insufficient article data to assess this dimension
                    </p>
                  </div>
                );
              }

              const dimensionColors = severityColor(score);
              const levelText = level ?? dimensionColors.text.toUpperCase();
              const expanded = expandedDimensions[key] ?? false;

              return (
                <div
                  key={key}
                  className="flex items-center gap-3 px-3 py-2"
                  data-testid={`dimension-row-${key}`}
                  style={{ borderLeft: `4px solid ${dimensionColors.border}` }}
                >
                  <span className="font-mono font-bold text-sm w-8 shrink-0 text-right" style={{ color: dimensionColors.badge }} data-testid={`dimension-score-${key}`}>{score}</span>
                  <span className="flex-1 text-sm font-medium text-stone-800 dark:text-gray-200">{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${dimensionColors.badge}1a`, color: dimensionColors.badge }} data-testid={`dimension-level-${key}`}>{levelText}</span>
                  <div className="w-16 shrink-0">
                    <SeverityGauge score={score} compact />
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
                          {expanded ? "▲" : "▼"}
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
        </section>
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
          ? `Scored from ${topic.articleCount} article${topic.articleCount !== 1 ? "s" : ""}`
          : "No sources yet"}
      </div>

      {/* ── Source Citations ─────────────────────────────────────────────────── */}
      {articles.length > 0 && (
        <section data-testid="sources-section" className="mb-6">
          <h2 className="text-sm font-semibold text-stone-600 dark:text-gray-300 mb-3">Sources</h2>
          <ArticleList articles={articles} />
        </section>
      )}

      {/* ── Score History ────────────────────────────────────────────────────── */}
      <section data-testid="score-history-section" className="mb-6">
        <h2 className="text-sm font-semibold text-stone-600 dark:text-gray-300 mb-3">Score History</h2>
        <ScoreChart history={scoreHistory} />
      </section>
    </div>
  );
}
