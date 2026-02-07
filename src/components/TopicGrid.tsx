"use client";

import { useEffect, useState } from "react";
import type { Topic, Urgency } from "@/lib/types";
import TopicCard from "./TopicCard";

export default function TopicGrid() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | null>(null);
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

  const filters: { label: string; value: Urgency | null }[] = [
    { label: "All", value: null },
    { label: "Breaking", value: "breaking" },
    { label: "Critical", value: "critical" },
    { label: "Moderate", value: "moderate" },
    { label: "Informational", value: "informational" },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1" data-testid="urgency-filters">
        {filters.map((f) => (
          <button
            key={f.label}
            onClick={() => setUrgencyFilter(f.value)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              urgencyFilter === f.value
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
            data-testid={`filter-${f.label.toLowerCase()}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12" data-testid="loading">Loading...</div>
      ) : topics.length === 0 ? (
        <div className="text-gray-500 text-center py-12" data-testid="empty">No topics found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="topic-grid">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
