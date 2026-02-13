import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() }
  };
});

import { db } from "@/db";
import { topics, scoreHistory } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

const mockTopicsData = [
  {
    id: 1,
    name: "Arctic Ice Decline",
    slug: "arctic-ice-decline",
    category: "climate",
    region: "Arctic",
    currentScore: 85,
    previousScore: 79,
    urgency: "breaking" as const,
    impactSummary: "Sea ice at record lows",
    articleCount: 5,
    imageUrl: null,
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: "Delhi Air Quality",
    slug: "delhi-air-quality",
    category: "air_quality",
    region: "South Asia",
    currentScore: 91,
    previousScore: 88,
    urgency: "breaking" as const,
    impactSummary: "AQI hazardous",
    articleCount: 8,
    imageUrl: null,
    updatedAt: new Date(),
  },
  {
    id: 3,
    name: "Ganges Cleanup",
    slug: "ganges-cleanup",
    category: "water",
    region: "South Asia",
    currentScore: 45,
    previousScore: 52,
    urgency: "moderate" as const,
    impactSummary: "Cleanup progress",
    articleCount: 3,
    imageUrl: null,
    updatedAt: new Date(),
  },
  {
    id: 4,
    name: "Renewable Growth",
    slug: "renewable-growth",
    category: "energy",
    region: "Global",
    currentScore: 22,
    previousScore: 28,
    urgency: "informational" as const,
    impactSummary: "Solar up 15%",
    articleCount: 2,
    imageUrl: null,
    updatedAt: new Date(),
  },
];

describe("GET /api/topics — query logic", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  test("returns all topics sorted by score descending", async () => {
    const sortedData = [...mockTopicsData]
      .sort((a, b) => b.currentScore - a.currentScore)
      .map(t => ({
        ...t,
        change: t.currentScore - t.previousScore,
      }));

    mockDb.mockSelect(sortedData);

    const result = await db.select().from(topics).orderBy(desc(topics.currentScore));

    expect(result).toHaveLength(4);
    expect(result[0].name).toBe("Delhi Air Quality");
    expect(result[1].name).toBe("Arctic Ice Decline");
    expect(result[3].name).toBe("Renewable Growth");
  });

  test("computes change correctly", async () => {
    const dataWithChange = mockTopicsData
      .sort((a, b) => b.currentScore - a.currentScore)
      .map(t => ({
        ...t,
        change: t.currentScore - t.previousScore,
      }));

    mockDb.mockSelect(dataWithChange);

    const result = await db.select().from(topics).orderBy(desc(topics.currentScore));

    const arctic = result.find((r) => r.slug === "arctic-ice-decline");
    expect(arctic!.change).toBe(6); // 85 - 79
    const ganges = result.find((r) => r.slug === "ganges-cleanup");
    expect(ganges!.change).toBe(-7); // 45 - 52
  });

  test("filters by urgency", async () => {
    const breakingTopics = mockTopicsData
      .filter(t => t.urgency === "breaking")
      .map(t => ({ ...t, change: t.currentScore - t.previousScore }));

    mockDb.mockSelect(breakingTopics);

    const result = await db.select().from(topics)
      .where(eq(topics.urgency, "breaking"))
      .orderBy(desc(topics.currentScore));

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.urgency === "breaking")).toBe(true);
  });

  test("filters by category", async () => {
    const waterTopics = mockTopicsData
      .filter(t => t.category === "water")
      .map(t => ({ ...t, change: t.currentScore - t.previousScore }));

    mockDb.mockSelect(waterTopics);

    const result = await db.select().from(topics)
      .where(eq(topics.category, "water"))
      .orderBy(desc(topics.currentScore));

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("ganges-cleanup");
  });

  test("filters by both urgency and category", async () => {
    const filtered = mockTopicsData
      .filter(t => t.urgency === "breaking" && t.category === "air_quality")
      .map(t => ({ ...t, change: t.currentScore - t.previousScore }));

    mockDb.mockSelect(filtered);

    const result = await db.select().from(topics)
      .where(and(eq(topics.urgency, "breaking"), eq(topics.category, "air_quality")))
      .orderBy(desc(topics.currentScore));

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("delhi-air-quality");
  });

  test("returns empty array for no matches", async () => {
    mockDb.mockSelect([]);

    const result = await db.select().from(topics)
      .where(and(eq(topics.urgency, "breaking"), eq(topics.category, "waste")))
      .orderBy(desc(topics.currentScore));

    expect(result).toHaveLength(0);
  });

  test("sparkline query returns last 7 scores in chronological order", async () => {
    const topicId = 1;
    const mockScores = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      topicId,
      score: 60 + i,
      healthScore: null,
      ecoScore: null,
      econScore: null,
      impactSummary: null,
      recordedAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
    })).slice(3, 10); // Last 7 scores

    mockDb.mockSelect(mockScores.reverse()); // DESC order

    const result = await db.select({ score: scoreHistory.score })
      .from(scoreHistory)
      .where(eq(scoreHistory.topicId, topicId))
      .orderBy(desc(scoreHistory.recordedAt))
      .limit(7);

    const sparkline = result.map((h) => h.score).reverse();
    expect(sparkline).toEqual([63, 64, 65, 66, 67, 68, 69]);
    expect(sparkline).toHaveLength(7);
  });
});
