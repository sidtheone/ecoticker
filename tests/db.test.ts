/**
 * Database Schema Tests
 *
 * Tests Drizzle schema type exports and basic query patterns.
 * Schema constraints are enforced at PostgreSQL level, not tested here.
 */

import { db } from "../src/db";
import {
  topics,
  articles,
  scoreHistory,
  topicKeywords,
  auditLogs,
  trackedKeywords,
  topicViews,
  scoreFeedback,
} from "../src/db/schema";
import { mockDb, mockDbInstance } from "./helpers/mock-db";

// Mock the database module
jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: {
      end: jest.fn(),
    },
  };
});

describe("Database Schema", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("Schema Type Exports", () => {
    test("exports all 8 table schemas", () => {
      expect(topics).toBeDefined();
      expect(articles).toBeDefined();
      expect(scoreHistory).toBeDefined();
      expect(topicKeywords).toBeDefined();
      expect(auditLogs).toBeDefined();
      expect(trackedKeywords).toBeDefined();
      expect(topicViews).toBeDefined();
      expect(scoreFeedback).toBeDefined();
    });

    test("topics schema has v2 columns", () => {
      // Verify schema includes v2 fields (compile-time check)
      const columns = topics;
      expect(columns.healthScore).toBeDefined();
      expect(columns.ecoScore).toBeDefined();
      expect(columns.econScore).toBeDefined();
      expect(columns.scoreReasoning).toBeDefined();
      expect(columns.hidden).toBeDefined();
    });

    test("scoreHistory schema has v2 columns", () => {
      const columns = scoreHistory;
      expect(columns.healthLevel).toBeDefined();
      expect(columns.ecoLevel).toBeDefined();
      expect(columns.econLevel).toBeDefined();
      expect(columns.healthReasoning).toBeDefined();
      expect(columns.ecoReasoning).toBeDefined();
      expect(columns.econReasoning).toBeDefined();
      expect(columns.overallSummary).toBeDefined();
      expect(columns.rawLlmResponse).toBeDefined();
      expect(columns.anomalyDetected).toBeDefined();
    });

    test("articles schema has v2 columns", () => {
      const columns = articles;
      expect(columns.sourceType).toBeDefined();
    });
  });

  describe("Query Builder Patterns", () => {
    test("SELECT query chain", async () => {
      const mockTopics = [
        { id: 1, name: "Climate Change", slug: "climate-change", currentScore: 75 },
        { id: 2, name: "Ocean Acidification", slug: "ocean-acidification", currentScore: 60 },
      ];

      mockDb.mockSelect(mockTopics);

      const result = await db.select().from(topics).where({}).orderBy({}).limit(10);

      expect(mockDb.chain.select).toHaveBeenCalled();
      expect(mockDb.chain.from).toHaveBeenCalled();
      expect(result).toEqual(mockTopics);
    });

    test("INSERT query chain", async () => {
      const mockResult = [{ id: 1, name: "New Topic", slug: "new-topic" }];

      mockDb.mockInsert(mockResult);

      const result = await db
        .insert(topics)
        .values({ name: "New Topic", slug: "new-topic" })
        .returning();

      expect(mockDb.chain.insert).toHaveBeenCalled();
      expect(mockDb.chain.values).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    test("UPDATE query chain", async () => {
      const mockResult = [{ id: 1, currentScore: 80 }];

      mockDb.mockUpdate(mockResult);

      const result = await db
        .update(topics)
        .set({ currentScore: 80 })
        .where({})
        .returning();

      expect(mockDb.chain.update).toHaveBeenCalled();
      expect(mockDb.chain.set).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    test("DELETE query chain", async () => {
      const mockResult = [{ id: 1 }];

      mockDb.mockDelete(mockResult);

      const result = await db.delete(topics).where({}).returning();

      expect(mockDb.chain.delete).toHaveBeenCalled();
      expect(mockDb.chain.where).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    test("relational query with findFirst", async () => {
      const mockTopic = {
        id: 1,
        name: "Climate Change",
        slug: "climate-change",
        articles: [
          { id: 1, title: "Article 1", url: "https://example.com/1" },
          { id: 2, title: "Article 2", url: "https://example.com/2" },
        ],
        scoreHistory: [
          { id: 1, score: 75, recordedAt: new Date("2026-01-01") },
          { id: 2, score: 80, recordedAt: new Date("2026-01-02") },
        ],
      };

      mockDb.mockFindFirst("topics", mockTopic);

      const result = await db.query.topics.findFirst({
        where: {},
        with: { articles: true, scoreHistory: true },
      });

      expect(mockDb.query.topics.findFirst).toHaveBeenCalled();
      expect(result).toEqual(mockTopic);
    });

    test("relational query with findMany", async () => {
      const mockTopics = [
        { id: 1, name: "Topic 1", slug: "topic-1" },
        { id: 2, name: "Topic 2", slug: "topic-2" },
      ];

      mockDb.mockFindMany("topics", mockTopics);

      const result = await db.query.topics.findMany({ where: {} });

      expect(mockDb.query.topics.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockTopics);
    });
  });

  describe("Upsert Patterns", () => {
    test("INSERT with onConflictDoUpdate (topic upsert)", async () => {
      const mockResult = [
        { id: 1, slug: "climate", currentScore: 80, previousScore: 75 },
      ];

      mockDb.mockInsert(mockResult);

      const result = await db
        .insert(topics)
        .values({ slug: "climate", currentScore: 80 })
        .onConflictDoUpdate({
          target: topics.slug,
          set: { currentScore: 80 },
        });

      expect(mockDb.chain.insert).toHaveBeenCalled();
      expect(mockDb.chain.onConflictDoUpdate).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    test("INSERT with onConflictDoNothing (article dedup)", async () => {
      const mockResult: any[] = []; // Empty array = conflict, nothing inserted

      mockDb.mockInsert(mockResult);

      const result = await db
        .insert(articles)
        .values({ url: "https://example.com/dupe", title: "Dupe" })
        .onConflictDoNothing({ target: articles.url });

      expect(mockDb.chain.insert).toHaveBeenCalled();
      expect(mockDb.chain.onConflictDoNothing).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe("PostgreSQL-Specific Features", () => {
    test("JSONB field on score_history.rawLlmResponse", () => {
      // Verify schema includes JSONB type (compile-time)
      const jsonbField = scoreHistory.rawLlmResponse;
      expect(jsonbField).toBeDefined();
      // Runtime: Drizzle handles JSONB serialization automatically
    });

    test("BOOLEAN fields", () => {
      // Verify boolean fields exist (compile-time)
      expect(topics.hidden).toBeDefined();
      expect(scoreHistory.anomalyDetected).toBeDefined();
      expect(auditLogs.success).toBeDefined();
      expect(trackedKeywords.active).toBeDefined();
    });

    test("TIMESTAMP vs DATE types", () => {
      // Verify timestamp fields for datetime
      expect(topics.createdAt).toBeDefined();
      expect(topics.updatedAt).toBeDefined();
      expect(auditLogs.timestamp).toBeDefined();

      // Verify date field for date-only
      expect(scoreHistory.recordedAt).toBeDefined();
      expect(topicViews.date).toBeDefined();
    });
  });

  describe("Mock DB Helper", () => {
    test("mockDb.reset() clears all mocks", () => {
      mockDb.chain.select.mockReturnValue("test");
      mockDb.reset();

      expect(mockDb.chain.select).not.toHaveBeenCalled();
      expect(jest.isMockFunction(mockDb.chain.select)).toBe(true);
    });

    test("mockDb.mockSelect configures SELECT chain", async () => {
      const data = [{ id: 1 }];
      mockDb.mockSelect(data);

      const result = await db.select().from(topics).where({});

      expect(result).toEqual(data);
    });

    test("mockDb.mockInsert configures INSERT chain", async () => {
      const data = [{ id: 1 }];
      mockDb.mockInsert(data);

      const result = await db.insert(topics).values({}).returning();

      expect(result).toEqual(data);
    });

    test("mockDb.mockFindFirst configures relational query", async () => {
      const data = { id: 1, name: "Test" };
      mockDb.mockFindFirst("topics", data);

      const result = await db.query.topics.findFirst({ where: {} });

      expect(result).toEqual(data);
    });
  });
});
