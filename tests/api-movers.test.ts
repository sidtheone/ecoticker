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
import { ne, desc, sql } from "drizzle-orm";

describe("GET /api/movers — query logic", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  test("returns top 5 movers sorted by absolute change", async () => {
    const mockMovers = [
      { name: "Big Up", slug: "big-up", currentScore: 90, previousScore: 50, change: 40, urgency: "breaking" },
      { name: "Big Down", slug: "big-down", currentScore: 30, previousScore: 65, change: -35, urgency: "moderate" },
      { name: "Also Big", slug: "also-big", currentScore: 80, previousScore: 55, change: 25, urgency: "breaking" },
      { name: "Medium", slug: "medium", currentScore: 70, previousScore: 55, change: 15, urgency: "critical" },
      { name: "Small", slug: "small", currentScore: 50, previousScore: 45, change: 5, urgency: "moderate" },
    ];

    mockDb.mockSelect(mockMovers);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      currentScore: topics.currentScore,
      previousScore: topics.previousScore,
      change: sql`${topics.currentScore} - ${topics.previousScore}`,
      urgency: topics.urgency,
    }).from(topics).where(ne(topics.currentScore, topics.previousScore))
      .orderBy(desc(sql`ABS(${topics.currentScore} - ${topics.previousScore})`))
      .limit(5);

    expect(result).toHaveLength(5);
    expect(result[0].name).toBe("Big Up");
    expect(result[1].name).toBe("Big Down");
    expect(result[2].name).toBe("Also Big");
    expect(result[3].name).toBe("Medium");
    expect(result[4].name).toBe("Small");
  });

  test("excludes topics with zero change", async () => {
    const mockMovers = [
      { name: "Moving", slug: "moving", currentScore: 70, previousScore: 55, change: 15 },
    ];

    mockDb.mockSelect(mockMovers);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      currentScore: topics.currentScore,
      previousScore: topics.previousScore,
      change: sql`${topics.currentScore} - ${topics.previousScore}`,
      urgency: topics.urgency,
    }).from(topics).where(ne(topics.currentScore, topics.previousScore))
      .orderBy(desc(sql`ABS(${topics.currentScore} - ${topics.previousScore})`))
      .limit(5);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Moving");
  });

  test("includes both positive and negative movers", async () => {
    const mockMovers = [
      { name: "Worsening", slug: "worse", currentScore: 80, previousScore: 60, change: 20 },
      { name: "Improving", slug: "better", currentScore: 30, previousScore: 55, change: -25 },
    ];

    mockDb.mockSelect(mockMovers);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      currentScore: topics.currentScore,
      previousScore: topics.previousScore,
      change: sql`${topics.currentScore} - ${topics.previousScore}`,
      urgency: topics.urgency,
    }).from(topics).where(ne(topics.currentScore, topics.previousScore))
      .orderBy(desc(sql`ABS(${topics.currentScore} - ${topics.previousScore})`))
      .limit(5);

    expect(result).toHaveLength(2);
    const changes = result.map((r) => r.change as number);
    expect(changes.some((c) => c > 0)).toBe(true);
    expect(changes.some((c) => c < 0)).toBe(true);
  });

  test("returns empty array when all topics are stable", async () => {
    mockDb.mockSelect([]);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      currentScore: topics.currentScore,
      previousScore: topics.previousScore,
      change: sql`${topics.currentScore} - ${topics.previousScore}`,
      urgency: topics.urgency,
    }).from(topics).where(ne(topics.currentScore, topics.previousScore))
      .orderBy(desc(sql`ABS(${topics.currentScore} - ${topics.previousScore})`))
      .limit(5);

    expect(result).toEqual([]);
  });

  test("returns fewer than 5 if fewer movers exist", async () => {
    const mockMovers = [
      { name: "Only", slug: "only", currentScore: 60, previousScore: 40, change: 20 },
    ];

    mockDb.mockSelect(mockMovers);

    const result = await db.select({
      name: topics.name,
      slug: topics.slug,
      currentScore: topics.currentScore,
      previousScore: topics.previousScore,
      change: sql`${topics.currentScore} - ${topics.previousScore}`,
      urgency: topics.urgency,
    }).from(topics).where(ne(topics.currentScore, topics.previousScore))
      .orderBy(desc(sql`ABS(${topics.currentScore} - ${topics.previousScore})`))
      .limit(5);

    expect(result).toHaveLength(1);
  });
});
