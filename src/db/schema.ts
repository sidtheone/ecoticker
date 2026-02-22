import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  date,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Topics ────────────────────────────────────────────
export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category").default("climate"),
    region: text("region"),
    currentScore: integer("current_score").default(0),
    previousScore: integer("previous_score").default(0),
    urgency: text("urgency").default("informational"),
    impactSummary: text("impact_summary"),
    imageUrl: text("image_url"),
    articleCount: integer("article_count").default(0),
    // US-1.1: sub-scores on the topic for quick access
    healthScore: integer("health_score").default(0),
    ecoScore: integer("eco_score").default(0),
    econScore: integer("econ_score").default(0),
    scoreReasoning: text("score_reasoning"),
    // US-4.2: soft-hide from dashboard
    hidden: boolean("hidden").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_topics_urgency").on(table.urgency),
    index("idx_topics_category").on(table.category),
  ]
);

// ─── Articles ──────────────────────────────────────────
export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    source: text("source"),
    summary: text("summary"),
    imageUrl: text("image_url"),
    // US-5.2: source attribution
    sourceType: text("source_type").default("unknown"),
    publishedAt: timestamp("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow(),
  },
  (table) => [index("idx_articles_topic").on(table.topicId)]
);

// ─── Score History ─────────────────────────────────────
export const scoreHistory = pgTable(
  "score_history",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    score: integer("score").notNull(),
    healthScore: integer("health_score"),
    ecoScore: integer("eco_score"),
    econScore: integer("econ_score"),
    impactSummary: text("impact_summary"),
    // US-1.1: levels, reasoning, raw response, anomaly
    healthLevel: text("health_level"),
    ecoLevel: text("eco_level"),
    econLevel: text("econ_level"),
    healthReasoning: text("health_reasoning"),
    ecoReasoning: text("eco_reasoning"),
    econReasoning: text("econ_reasoning"),
    overallSummary: text("overall_summary"),
    rawLlmResponse: jsonb("raw_llm_response"),
    anomalyDetected: boolean("anomaly_detected").default(false),
    recordedAt: date("recorded_at").defaultNow(),
  },
  (table) => [
    index("idx_score_history_topic").on(table.topicId),
    index("idx_score_history_date").on(table.recordedAt),
  ]
);

// ─── Topic Keywords ────────────────────────────────────
export const topicKeywords = pgTable(
  "topic_keywords",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    keyword: text("keyword").notNull(),
  },
  (table) => [index("idx_topic_keywords_topic").on(table.topicId)]
);

// ─── Audit Logs ────────────────────────────────────────
// GDPR: ip_address is truncated before storage (last octet zeroed).
//        user_agent removed (PII, not needed).
//        Auto-purged after 90 days (data minimization).
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    timestamp: timestamp("timestamp").defaultNow(),
    ipAddress: text("ip_address"), // GDPR: stored truncated (e.g., "192.168.1.0")
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    action: text("action").notNull(),
    success: boolean("success").default(true),
    errorMessage: text("error_message"),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_timestamp").on(table.timestamp),
    index("idx_audit_logs_action").on(table.action),
  ]
);

// ─── Tracked Keywords (US-4.1) ─────────────────────────
export const trackedKeywords = pgTable("tracked_keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  active: boolean("active").default(true),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  lastSearchedAt: timestamp("last_searched_at"),
  resultCount: integer("result_count").default(0),
});

// ─── Topic Views (US-8.1) ──────────────────────────────
export const topicViews = pgTable(
  "topic_views",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    date: date("date").notNull(),
    viewCount: integer("view_count").default(0),
  },
  (table) => [uniqueIndex("idx_topic_views_unique").on(table.topicId, table.date)]
);

// ─── Score Feedback (US-10.1) ──────────────────────────
// GDPR: ip_address is truncated before storage (same as audit_logs).
export const scoreFeedback = pgTable(
  "score_feedback",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    scoreHistoryId: integer("score_history_id").references(() => scoreHistory.id),
    dimension: text("dimension").notNull(),
    direction: text("direction").notNull(),
    comment: text("comment"),
    ipAddress: text("ip_address"), // GDPR: stored truncated (e.g., "192.168.1.0")
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_score_feedback_topic").on(table.topicId)]
);

// ─── Relations ─────────────────────────────────────────

export const topicsRelations = relations(topics, ({ many }) => ({
  articles: many(articles),
  scoreHistory: many(scoreHistory),
  keywords: many(topicKeywords),
  views: many(topicViews),
  feedback: many(scoreFeedback),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  topic: one(topics, {
    fields: [articles.topicId],
    references: [topics.id],
  }),
}));

export const scoreHistoryRelations = relations(scoreHistory, ({ one, many }) => ({
  topic: one(topics, {
    fields: [scoreHistory.topicId],
    references: [topics.id],
  }),
  feedback: many(scoreFeedback),
}));

export const topicKeywordsRelations = relations(topicKeywords, ({ one }) => ({
  topic: one(topics, {
    fields: [topicKeywords.topicId],
    references: [topics.id],
  }),
}));

export const scoreFeedbackRelations = relations(scoreFeedback, ({ one }) => ({
  topic: one(topics, {
    fields: [scoreFeedback.topicId],
    references: [topics.id],
  }),
  scoreHistoryEntry: one(scoreHistory, {
    fields: [scoreFeedback.scoreHistoryId],
    references: [scoreHistory.id],
  }),
}));

export const topicViewsRelations = relations(topicViews, ({ one }) => ({
  topic: one(topics, {
    fields: [topicViews.topicId],
    references: [topics.id],
  }),
}));
