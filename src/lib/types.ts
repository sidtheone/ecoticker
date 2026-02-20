export type Urgency = "breaking" | "critical" | "moderate" | "informational";

export type SeverityLevel = "MINIMAL" | "MODERATE" | "SIGNIFICANT" | "SEVERE" | "INSUFFICIENT_DATA";

export type Category =
  | "air_quality"
  | "deforestation"
  | "ocean"
  | "climate"
  | "pollution"
  | "biodiversity"
  | "wildlife"
  | "energy"
  | "waste"
  | "water";

export interface Topic {
  id: number;
  name: string;
  slug: string;
  category: Category;
  region: string | null;
  currentScore: number;
  previousScore: number;
  change: number;
  urgency: Urgency;
  impactSummary: string | null;
  imageUrl: string | null;
  articleCount: number;
  // US-1.1: sub-scores
  healthScore: number;
  ecoScore: number;
  econScore: number;
  scoreReasoning: string | null;
  // US-4.2: soft-hide
  hidden: boolean;
  updatedAt: string;
  sparkline: number[];
}

export interface Article {
  id: number;
  topicId: number;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  imageUrl: string | null;
  // US-5.2: source attribution
  sourceType: string;
  publishedAt: string | null;
}

export interface ScoreHistoryEntry {
  score: number;
  healthScore: number | null;
  ecoScore: number | null;
  econScore: number | null;
  impactSummary: string | null;
  // US-1.1: levels, reasoning, anomaly
  healthLevel: string | null;
  ecoLevel: string | null;
  econLevel: string | null;
  healthReasoning: string | null;
  ecoReasoning: string | null;
  econReasoning: string | null;
  overallSummary: string | null;
  anomalyDetected: boolean;
  date: string;
}

export interface TickerItem {
  name: string;
  slug: string;
  score: number;
  change: number;
}

export interface TopicDetail {
  topic: Topic;
  articles: Article[];
  scoreHistory: ScoreHistoryEntry[];
}

// Note: Database row types (TopicRow, ArticleRow, etc.) are now inferred from Drizzle schema.
// Use `typeof topics.$inferSelect` for type-safe row types.
