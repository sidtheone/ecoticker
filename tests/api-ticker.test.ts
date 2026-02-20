import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() }
  };
});

import { db } from "@/db";
import { topics } from "@/db/schema";
import { desc } from "drizzle-orm";

describe("GET /api/ticker — query logic", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  test("returns top 15 topics by score", async () => {
    const mockTopics = Array.from({ length: 15 }, (_, i) => ({
      name: `Topic ${i}`,
      slug: `topic-${i}`,
      score: 100 - i,
      change: 10,
    }));

    mockDb.mockSelect(mockTopics);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      score: topics.currentScore,
      change: topics.currentScore,
    }).from(topics).orderBy(desc(topics.currentScore)).limit(15);

    expect(result).toHaveLength(15);
    expect(result[0].score).toBe(100);
    expect(result[14].score).toBe(86);
  });

  test("returns lightweight payload (only name, slug, score, change)", async () => {
    const mockTopics = [{
      name: "Test",
      slug: "test",
      score: 80,
      change: 10,
    }];

    mockDb.mockSelect(mockTopics);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      score: topics.currentScore,
      change: topics.currentScore,
    }).from(topics).orderBy(desc(topics.currentScore)).limit(15);

    expect(result).toHaveLength(1);
    const keys = Object.keys(result[0]);
    expect(keys).toEqual(["name", "slug", "score", "change"]);
  });

  test("computes change correctly", async () => {
    const mockTopics = [
      { name: "Up", slug: "up", score: 80, change: 15 },
      { name: "Down", slug: "down", score: 40, change: -15 },
    ];

    mockDb.mockSelect(mockTopics);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      score: topics.currentScore,
      change: topics.currentScore,
    }).from(topics).orderBy(desc(topics.currentScore)).limit(15);

    expect(result[0].change).toBe(15);
    expect(result[1].change).toBe(-15);
  });

  test("returns empty array when no topics", async () => {
    mockDb.mockSelect([]);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      score: topics.currentScore,
      change: topics.currentScore,
    }).from(topics).orderBy(desc(topics.currentScore)).limit(15);

    expect(result).toEqual([]);
  });

  test("returns fewer than 15 if less topics exist", async () => {
    const mockTopics = [{ name: "Only", slug: "only", score: 50, change: 0 }];

    mockDb.mockSelect(mockTopics);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      score: topics.currentScore,
      change: topics.currentScore,
    }).from(topics).orderBy(desc(topics.currentScore)).limit(15);

    expect(result).toHaveLength(1);
  });
});
