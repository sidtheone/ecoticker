/**
 * @jest-environment node
 */
import { generateMetadata } from "@/app/topic/[slug]/layout";

const mockQueryResult = jest.fn();

jest.mock("@/db", () => {
  const chain = () => new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => prop === "limit" ? mockQueryResult : chain,
  });
  return { db: { select: chain } };
});

beforeEach(() => jest.clearAllMocks());

describe("generateMetadata", () => {
  test("returns correct OG tags for existing topic", async () => {
    mockQueryResult.mockResolvedValue([
      {
        name: "Amazon Deforestation",
        currentScore: 72,
        urgency: "critical",
        impactSummary: "Deforestation rates at 15-year high across the Amazon basin.",
        scoreReasoning: null,
      },
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "amazon-deforestation" }),
    });

    expect(metadata.title).toBe("Amazon Deforestation — Score: 72 (critical) | EcoTicker");
    expect(metadata.description).toBe("Deforestation rates at 15-year high across the Amazon basin.");
    expect(metadata.openGraph?.title).toBe("Amazon Deforestation — Score: 72 (critical) | EcoTicker");
    expect(metadata.openGraph?.images).toEqual([{ url: "/og-default.png", width: 1200, height: 630 }]);
    const twitter = metadata.twitter as Record<string, unknown>;
    expect(twitter?.card).toBe("summary_large_image");
    expect(twitter?.title).toBe("Amazon Deforestation — Score: 72 (critical) | EcoTicker");
    expect(twitter?.images).toEqual(["/og-default.png"]);
  });

  test("uses scoreReasoning as fallback when impactSummary is null", async () => {
    mockQueryResult.mockResolvedValue([
      {
        name: "Oil Spill",
        currentScore: 90,
        urgency: "breaking",
        impactSummary: null,
        scoreReasoning: "Major spill affecting coastal ecosystems.",
      },
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "oil-spill" }),
    });

    expect(metadata.description).toBe("Major spill affecting coastal ecosystems.");
  });

  test("truncates description to 200 characters", async () => {
    const longText = "A".repeat(300);
    mockQueryResult.mockResolvedValue([
      {
        name: "Test",
        currentScore: 50,
        urgency: "moderate",
        impactSummary: longText,
        scoreReasoning: null,
      },
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "test" }),
    });

    expect(metadata.description).toHaveLength(200);
  });

  test("returns fallback metadata for missing topic", async () => {
    mockQueryResult.mockResolvedValue([]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "nonexistent" }),
    });

    expect(metadata.title).toBe("Topic Not Found — EcoTicker");
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });

  test("returns empty description when both impactSummary and scoreReasoning are null", async () => {
    mockQueryResult.mockResolvedValue([
      {
        name: "Empty Topic",
        currentScore: 10,
        urgency: "informational",
        impactSummary: null,
        scoreReasoning: null,
      },
    ]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "empty-topic" }),
    });

    expect(metadata.description).toBe("");
  });
});
