"use client";

import { useEffect, useState } from "react";
import type { Topic, Urgency, Category } from "@/lib/types";
import TopicCard from "./TopicCard";
import { eventBus } from "@/lib/events";

const CATEGORY_LABELS: Record<Category, string> = {
  air_quality: "Air Quality",
  deforestation: "Deforestation",
  ocean: "Ocean",
  climate: "Climate",
  pollution: "Pollution",
  biodiversity: "Biodiversity",
  wildlife: "Wildlife",
  energy: "Energy",
  waste: "Waste",
  water: "Water",
};

export default function TopicGrid() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopics() {
      try {
        const params = urgencyFilter ? `?urgency=${urgencyFilter}` : "";
        const res = await fetch(`/api/topics${params}`);
        const data = await res.json();
        setTopics(data.topics || []);
      } catch {
        setTopics([]);
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    fetchTopics();
  }, [urgencyFilter]);

  // Listen for refresh events
  useEffect(() => {
    const unsubscribe = eventBus.subscribe("ui-refresh", () => {
      setLoading(true);
      fetch(`/api/topics${urgencyFilter ? `?urgency=${urgencyFilter}` : ""}`)
        .then((r) => r.json())
        .then((data) => setTopics(data.topics || []))
        .catch(() => setTopics([]))
        .finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [urgencyFilter]);

  const urgencyFilters: { label: string; value: Urgency | null }[] = [
    { label: "All", value: null },
    { label: "Breaking", value: "breaking" },
    { label: "Critical", value: "critical" },
    { label: "Moderate", value: "moderate" },
    { label: "Informational", value: "informational" },
  ];

  const availableCategories = Array.from(new Set(topics.map((t) => t.category))).sort();

  const filteredTopics = categoryFilter
    ? topics.filter((t) => t.category === categoryFilter)
    : topics;

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
      active
        ? "bg-stone-800 dark:bg-white text-white dark:text-gray-900"
        : "bg-[#e8dfd3] dark:bg-gray-800 text-stone-500 dark:text-gray-400 hover:bg-[#ddd3c4] dark:hover:bg-gray-700 hover:text-stone-700 dark:hover:text-gray-200"
    }`;

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" data-testid="urgency-filters">
        {urgencyFilters.map((f) => (
          <button
            key={f.label}
            onClick={() => setUrgencyFilter(f.value)}
            className={chipClass(urgencyFilter === f.value)}
            data-testid={`filter-${f.label.toLowerCase()}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!loading && topics.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" data-testid="category-filters">
          <button
            onClick={() => setCategoryFilter(null)}
            className={chipClass(categoryFilter === null)}
            data-testid="filter-category-all"
          >
            All Categories
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={chipClass(categoryFilter === cat)}
              data-testid={`filter-category-${cat}`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-12" data-testid="loading">Loading...</div>
      ) : filteredTopics.length === 0 && topics.length > 0 ? (
        <div className="text-stone-400 dark:text-gray-500 text-center py-12" data-testid="no-matches">
          No topics match these filters.{" "}
          <button
            onClick={() => { setUrgencyFilter(null); setCategoryFilter(null); }}
            className="text-stone-600 dark:text-gray-300 underline"
            data-testid="clear-filters"
          >
            Clear filters
          </button>
        </div>
      ) : topics.length === 0 ? (
        <div className="text-gray-500 text-center py-12" data-testid="empty">No topics found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="topic-grid">
          {filteredTopics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
