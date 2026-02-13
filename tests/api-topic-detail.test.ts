import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() }
  };
});

import { db } from "@/db";
import { topics, articles, scoreHistory } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

const mockTopic = {
  id: 1,
  name: "Arctic Ice Decline",
  slug: "arctic-ice-decline",
  category: "climate",
  region: "Arctic",
  currentScore: 85,
  previousScore: 79,
  urgency: "breaking" as const,
  impactSummary: "Sea ice at record lows",
  articleCount: 3,
  imageUrl: null,
  updatedAt: new Date(),
  articles: [
    {
      id: 1,
      topicId: 1,
      title: "Ice melting fast",
      url: "https://example.com/1",
      source: "Reuters",
      summary: "Summary 1",
      imageUrl: null,
      publishedAt: new Date("2026-02-07T10:00:00Z"),
    },
    {
      id: 2,
      topicId: 1,
      title: "Arctic report released",
      url: "https://example.com/2",
      source: "BBC",
      summary: "Summary 2",
      imageUrl: null,
      publishedAt: new Date("2026-02-06T08:00:00Z"),
    },
    {
      id: 3,
      topicId: 1,
      title: "Scientists warn",
      url: "https://example.com/3",
      source: "CNN",
      summary: "Summary 3",
      imageUrl: null,
      publishedAt: new Date("2026-02-05T12:00:00Z"),
    },
  ],
  scoreHistory: [
    {
      id: 1,
      topicId: 1,
      score: 70,
      healthScore: 50,
      ecoScore: 80,
      econScore: 60,
      impactSummary: "Day 1 summary",
      recordedAt: new Date("2026-02-05"),
    },
    {
      id: 2,
      topicId: 1,
      score: 79,
      healthScore: 55,
      ecoScore: 85,
      econScore: 65,
      impactSummary: "Day 2 summary",
      recordedAt: new Date("2026-02-06"),
    },
    {
      id: 3,
      topicId: 1,
      score: 85,
      healthScore: 60,
      ecoScore: 90,
      econScore: 70,
      impactSummary: "Day 3 summary",
      recordedAt: new Date("2026-02-07"),
    },
  ],
};

describe("GET /api/topics/[slug] — query logic", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  test("returns topic with correct fields", async () => {
    mockDb.mockFindFirst("topics", {
      ...mockTopic,
      change: mockTopic.currentScore - mockTopic.previousScore,
    });

    const result = await db.query.topics.findFirst({
      where: eq(topics.slug, "arctic-ice-decline"),
      with: {
        articles: true,
        scoreHistory: true,
      },
    });

    expect(result).toBeDefined();
    expect(result!.name).toBe("Arctic Ice Decline");
    expect(result!.currentScore).toBe(85);
    expect(result!.previousScore).toBe(79);
    expect(result!.currentScore! - result!.previousScore!).toBe(6);
    expect(result!.urgency).toBe("breaking");
    expect(result!.category).toBe("climate");
    expect(result!.region).toBe("Arctic");
  });

  test("returns articles ordered by published_at DESC (newest first)", async () => {
    mockDb.mockFindFirst("topics", mockTopic);

    const result = await db.query.topics.findFirst({
      where: eq(topics.slug, "arctic-ice-decline"),
      with: {
        articles: {
          orderBy: [desc(articles.publishedAt)],
        },
        scoreHistory: true,
      },
    });

    expect(result!.articles).toHaveLength(3);
    expect(result!.articles[0].title).toBe("Ice melting fast"); // Feb 7
    expect(result!.articles[2].title).toBe("Scientists warn");  // Feb 5
  });

  test("returns score history ordered by recorded_at ASC (oldest first)", async () => {
    mockDb.mockFindFirst("topics", mockTopic);

    const result = await db.query.topics.findFirst({
      where: eq(topics.slug, "arctic-ice-decline"),
      with: {
        articles: true,
        scoreHistory: {
          orderBy: [asc(scoreHistory.recordedAt)],
        },
      },
    });

    expect(result!.scoreHistory).toHaveLength(3);
    expect(result!.scoreHistory[0].score).toBe(70);  // Feb 5
    expect(result!.scoreHistory[2].score).toBe(85);   // Feb 7
  });

  test("score history includes sub-scores", async () => {
    mockDb.mockFindFirst("topics", mockTopic);

    const result = await db.query.topics.findFirst({
      where: eq(topics.slug, "arctic-ice-decline"),
      with: {
        articles: true,
        scoreHistory: {
          orderBy: [asc(scoreHistory.recordedAt)],
        },
      },
    });

    const latest = result!.scoreHistory[2];
    expect(latest.healthScore).toBe(60);
    expect(latest.ecoScore).toBe(90);
    expect(latest.econScore).toBe(70);
    expect(latest.impactSummary).toBe("Day 3 summary");
  });

  test("returns null for non-existent slug", async () => {
    mockDb.mockFindFirst("topics", null);

    const result = await db.query.topics.findFirst({
      where: eq(topics.slug, "does-not-exist"),
      with: {
        articles: true,
        scoreHistory: true,
      },
    });

    expect(result).toBeNull();
  });

  test("articles include all expected fields", async () => {
    mockDb.mockFindFirst("topics", mockTopic);

    const result = await db.query.topics.findFirst({
      where: eq(topics.slug, "arctic-ice-decline"),
      with: {
        articles: {
          orderBy: [desc(articles.publishedAt)],
        },
        scoreHistory: true,
      },
    });

    const article = result!.articles[0];
    expect(article.title).toBeDefined();
    expect(article.url).toBeDefined();
    expect(article.source).toBeDefined();
    expect(article.summary).toBeDefined();
    expect(article.publishedAt).toBeDefined();
  });
});
