export type Urgency = "breaking" | "critical" | "moderate" | "informational";

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
  publishedAt: string | null;
}

export interface ScoreHistoryEntry {
  score: number;
  healthScore: number | null;
  ecoScore: number | null;
  econScore: number | null;
  impactSummary: string | null;
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

// Database row types (snake_case from SQLite)
export interface TopicRow {
  id: number;
  name: string;
  slug: string;
  category: string;
  region: string | null;
  current_score: number;
  previous_score: number;
  change: number;
  urgency: string;
  impact_summary: string | null;
  image_url: string | null;
  article_count: number;
  updated_at: string;
  sparkline_scores?: string | null;
}

export interface ArticleRow {
  id: number;
  topic_id: number;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
}

export interface ScoreHistoryRow {
  score: number;
  health_score: number | null;
  eco_score: number | null;
  econ_score: number | null;
  impact_summary: string | null;
  recorded_at: string;
}

export interface MoverRow {
  name: string;
  slug: string;
  current_score: number;
  previous_score: number;
  change: number;
  urgency: string;
}
