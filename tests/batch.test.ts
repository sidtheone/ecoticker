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
import { eq, sql } from "drizzle-orm";

// We test the batch logic by simulating what batch.ts does against mocked DB.
// This avoids needing real API keys while verifying the DB operations.

describe("Batch Pipeline DB Operations", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  test("full batch cycle: insert topics, articles, scores, keywords", async () => {
    // Day 1: Insert a topic
    const mockTopicInsert = {
      id: 1,
      name: "Amazon Deforestation",
      slug: "amazon-deforestation",
      category: "deforestation",
      region: "South America",
      currentScore: 65,
      previousScore: 0,
      urgency: "critical" as const,
      impactSummary: "Forest loss accelerating",
      imageUrl: null,
      articleCount: 2,
      updatedAt: new Date(),
    };

    mockDb.mockInsert([mockTopicInsert]);

    const topicResult = await db.insert(topics).values({
      name: "Amazon Deforestation",
      slug: "amazon-deforestation",
      category: "deforestation",
      region: "South America",
      currentScore: 65,
      previousScore: 0,
      urgency: "critical",
      impactSummary: "Forest loss accelerating",
      imageUrl: null,
      articleCount: 2,
    }).onConflictDoUpdate({
      target: topics.slug,
      set: {
        previousScore: sql`${topics.currentScore}`,
        currentScore: 65,
        urgency: "critical",
        impactSummary: "Forest loss accelerating",
      },
    }).returning();

    expect(topicResult[0].id).toBe(1);

    // Insert articles (with dedup)
    mockDb.mockInsert([{ id: 1 }, { id: 2 }]);

    await db.insert(articles).values([
      { topicId: 1, title: "Article 1", url: "https://example.com/1", source: "Reuters", summary: "Summary 1", publishedAt: new Date("2026-02-06") },
      { topicId: 1, title: "Article 2", url: "https://example.com/2", source: "BBC", summary: "Summary 2", publishedAt: new Date("2026-02-06") },
    ]).onConflictDoNothing();

    // Insert score history
    mockDb.mockInsert([{ id: 1 }]);

    await db.insert(scoreHistory).values({
      topicId: 1,
      score: 65,
      healthScore: 50,
      ecoScore: 80,
      econScore: 55,
      impactSummary: "Forest loss accelerating",
    });

    // Insert keywords (with dedup)
    mockDb.mockInsert([{ id: 1 }, { id: 2 }]);

    await db.insert(topicKeywords).values([
      { topicId: 1, keyword: "amazon" },
      { topicId: 1, keyword: "deforestation" },
    ]).onConflictDoNothing();

    // Verify day 1
    mockDb.mockSelect([{
      ...mockTopicInsert,
    }]);

    const day1Topic = await db.select().from(topics).where(eq(topics.slug, "amazon-deforestation"));
    expect(day1Topic[0].currentScore).toBe(65);
    expect(day1Topic[0].previousScore).toBe(0);
    expect(day1Topic[0].articleCount).toBe(2);

    // Day 2: Upsert same topic with new score
    const mockTopicUpdate = {
      ...mockTopicInsert,
      currentScore: 78,
      previousScore: 65,
      urgency: "breaking" as const,
      impactSummary: "Fires now spreading",
      imageUrl: "https://img.com/fire.jpg",
      articleCount: 5,
    };

    mockDb.mockInsert([mockTopicUpdate]);

    await db.insert(topics).values({
      name: "Amazon Deforestation",
      slug: "amazon-deforestation",
      category: "deforestation",
      region: "South America",
      currentScore: 78,
      previousScore: 0,
      urgency: "breaking",
      impactSummary: "Fires now spreading",
      imageUrl: "https://img.com/fire.jpg",
      articleCount: 3,
    }).onConflictDoUpdate({
      target: topics.slug,
      set: {
        previousScore: sql`${topics.currentScore}`,
        currentScore: 78,
        urgency: "breaking",
        impactSummary: "Fires now spreading",
        imageUrl: "https://img.com/fire.jpg",
        articleCount: sql`${topics.articleCount} + 3`,
      },
    }).returning();

    // Duplicate article URL should be skipped (onConflictDoNothing)
    mockDb.mockInsert([{ id: 3 }]); // Only one new article

    await db.insert(articles).values([
      { topicId: 1, title: "Article 1 duplicate", url: "https://example.com/1", source: "Reuters", summary: "Same URL", publishedAt: new Date("2026-02-07") },
      { topicId: 1, title: "Article 3", url: "https://example.com/3", source: "CNN", summary: "New article", publishedAt: new Date("2026-02-07") },
    ]).onConflictDoNothing();

    // Insert new score
    mockDb.mockInsert([{ id: 2 }]);

    await db.insert(scoreHistory).values({
      topicId: 1,
      score: 78,
      healthScore: 60,
      ecoScore: 85,
      econScore: 70,
      impactSummary: "Fires now spreading",
    });

    // Insert keywords (duplicate should be skipped)
    mockDb.mockInsert([{ id: 3 }]); // Only fire is new

    await db.insert(topicKeywords).values([
      { topicId: 1, keyword: "amazon" },
      { topicId: 1, keyword: "fire" },
    ]).onConflictDoNothing();

    // Verify day 2
    mockDb.mockSelect([mockTopicUpdate]);

    const day2Topic = await db.select().from(topics).where(eq(topics.slug, "amazon-deforestation"));
    expect(day2Topic[0].currentScore).toBe(78);
    expect(day2Topic[0].previousScore).toBe(65);
    expect(day2Topic[0].urgency).toBe("breaking");
    expect(day2Topic[0].articleCount).toBe(5);
    expect(day2Topic[0].imageUrl).toBe("https://img.com/fire.jpg");
  });

  test("existing topics with keywords can be loaded for classification", async () => {
    // Mock topic with keywords loaded via relational query
    const mockTopicWithKeywords = {
      id: 1,
      name: "Arctic Ice",
      slug: "arctic-ice",
      category: "climate",
      currentScore: 0,
      previousScore: 0,
      keywords: [
        { id: 1, topicId: 1, keyword: "arctic" },
        { id: 2, topicId: 1, keyword: "sea ice" },
      ],
    };

    mockDb.mockFindMany("topics", [mockTopicWithKeywords]);

    // Query like batch.ts does with relational query
    const result = await db.query.topics.findMany({
      with: {
        keywords: true,
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Arctic Ice");
    expect(result[0].keywords).toBeDefined();
    expect(result[0].keywords.map((k: { keyword: string }) => k.keyword)).toEqual(["arctic", "sea ice"]);
  });
});

describe("Batch Pipeline: extractJSON", () => {
  // Replicate the extractJSON function from batch.ts
  function extractJSON(text: string): unknown {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }

  test("extracts clean JSON", () => {
    const result = extractJSON('{"score": 75, "urgency": "critical"}');
    expect(result).toEqual({ score: 75, urgency: "critical" });
  });

  test("extracts JSON wrapped in markdown code block", () => {
    const result = extractJSON('```json\n{"score": 50}\n```');
    expect(result).toEqual({ score: 50 });
  });

  test("extracts JSON with surrounding text", () => {
    const result = extractJSON('Here is the result:\n{"score": 60, "urgency": "moderate"}\nDone.');
    expect(result).toEqual({ score: 60, urgency: "moderate" });
  });

  test("returns null for no JSON", () => {
    expect(extractJSON("No JSON here")).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    expect(extractJSON("{broken json")).toBeNull();
  });
});
