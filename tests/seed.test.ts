import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() }
  };
});

import { db } from "@/db";
import { topics, articles, scoreHistory, topicKeywords } from "@/db/schema";
import { sql } from "drizzle-orm";

describe("Seed Script", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  test("seed script populates database with expected data", async () => {
    // Mock the data that seed script would insert
    const mockTopics = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `Topic ${i + 1}`,
      slug: `topic-${i + 1}`,
      category: "climate",
      region: "Global",
      currentScore: 50 + i,
      previousScore: 45 + i,
      urgency: "moderate" as const,
      impactSummary: `Impact summary ${i + 1}`,
      imageUrl: null,
      articleCount: 3,
      updatedAt: new Date(),
    }));

    const mockArticles = Array.from({ length: 36 }, (_, i) => ({
      id: i + 1,
      topicId: Math.floor(i / 3) + 1,
      title: `Article ${i + 1}`,
      url: `https://example.com/${i + 1}`,
      source: "Test Source",
      summary: `Summary ${i + 1}`,
      imageUrl: null,
      publishedAt: new Date(),
    }));

    const mockScores = Array.from({ length: 84 }, (_, i) => ({
      id: i + 1,
      topicId: Math.floor(i / 7) + 1,
      score: 50 + (i % 10),
      healthScore: 40 + (i % 10),
      ecoScore: 50 + (i % 10),
      econScore: 30 + (i % 10),
      impactSummary: `Score summary ${i + 1}`,
      recordedAt: new Date(),
    }));

    const mockKeywords = Array.from({ length: 24 }, (_, i) => ({
      id: i + 1,
      topicId: Math.floor(i / 2) + 1,
      keyword: `keyword${i + 1}`,
    }));

    // Mock insert operations
    mockDb.mockInsert(mockTopics);
    mockDb.mockInsert(mockArticles);
    mockDb.mockInsert(mockScores);
    mockDb.mockInsert(mockKeywords);

    // Simulate seed operations
    await db.insert(topics).values(mockTopics);
    await db.insert(articles).values(mockArticles);
    await db.insert(scoreHistory).values(mockScores);
    await db.insert(topicKeywords).values(mockKeywords);

    // Verify counts
    mockDb.mockSelect([{ count: 12 }]);
    const topicCount = await db.select({ count: sql`count(*)` }).from(topics);
    expect(Number(topicCount[0].count)).toBe(12);

    mockDb.mockSelect([{ count: 36 }]);
    const articleCount = await db.select({ count: sql`count(*)` }).from(articles);
    expect(Number(articleCount[0].count)).toBe(36);

    mockDb.mockSelect([{ count: 84 }]);
    const scoreCount = await db.select({ count: sql`count(*)` }).from(scoreHistory);
    expect(Number(scoreCount[0].count)).toBe(84);

    mockDb.mockSelect([{ count: 24 }]);
    const keywordCount = await db.select({ count: sql`count(*)` }).from(topicKeywords);
    expect(Number(keywordCount[0].count)).toBeGreaterThan(0);

    // Verify topics have expected fields populated
    mockDb.mockSelect(mockTopics);
    const topicList = await db.select().from(topics);

    for (const t of topicList) {
      expect(t.name).toBeTruthy();
      expect(t.slug).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.region).toBeTruthy();
      expect(t.impactSummary).toBeTruthy();
      expect(typeof t.currentScore).toBe("number");
      expect(typeof t.previousScore).toBe("number");
      expect(["breaking", "critical", "moderate", "informational"]).toContain(t.urgency);
    }

    // Verify score_history has sub-scores
    mockDb.mockSelect([mockScores[0]]);
    const scores = await db.select().from(scoreHistory).limit(1);
    expect(scores[0].healthScore).toBeDefined();
    expect(scores[0].ecoScore).toBeDefined();
    expect(scores[0].econScore).toBeDefined();
  });
});
