/**
 * Tests for src/lib/batch-pipeline.ts (Story 8-1)
 *
 * AC coverage:
 *   AC-1: Shared module exports (types, constants, pure functions, async functions)
 *   AC-2: Zero SYNC comments — manual verification via grep (noted below)
 *   AC-3: No regressions — integration-style tests that call each export the same
 *          way route.ts and batch.ts call them
 *   AC-4: RSS consolidation — fetchRssFeeds, FeedHealth, feedHostname from shared module
 *   AC-5: Parser singleton — single module-scoped Parser instance
 *
 * Run: npx jest tests/batch-pipeline.test.ts
 */

// ─── Env vars MUST be set before any import that reads them at module load ─────
// The shared module wraps env reads in getter functions (Dev Notes requirement),
// but process.env must still be populated before the module is first imported.
process.env.GNEWS_API_KEY = "test-gnews-key";
process.env.OPENROUTER_API_KEY = "test-openrouter-key";
process.env.BATCH_KEYWORDS = "amazon deforestation";
process.env.RSS_FEEDS = "https://www.theguardian.com/uk/environment/rss";

// ─── rss-parser mock — must be hoisted before the shared module is imported ────
// The shared module instantiates `new Parser(...)` at module scope (AC-5).
// jest.mock() is hoisted by babel/ts-jest, so this runs before the require().
import Parser from "rss-parser";
jest.mock("rss-parser");
const mockParseURL = jest.fn();
(Parser as unknown as jest.Mock).mockImplementation(() => ({
  parseURL: mockParseURL,
}));

// ─── Import the shared module under test ───────────────────────────────────────
import {
  // Constants
  BLOCKED_DOMAINS,
  FEW_SHOT_EXAMPLES,
  DEFAULT_FEEDS,

  // Pure functions
  isBlockedDomain,
  feedHostname,
  extractJSON,
  safeJsonb,
  processScoreResult,

  // Prompt builders
  buildClassificationPrompt,
  buildScoringPrompt,

  // Async functions
  fetchNews,
  fetchRssFeeds,
  callLLM,
  classifyArticles,
  scoreTopic,

  // Merge/dedup helper
  mergeAndDedup,

  // Feed health logger
  logFeedHealth,

  // Types (imported as type to verify they are exported)
  type NewsArticle,
  type GNewsArticle,
  type Classification,
  type LLMScoreResponse,
  type TopicScore,
  type FeedHealth,
} from "@/lib/batch-pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const AMAZON_ARTICLE: NewsArticle = {
  title: "Amazon deforestation accelerating",
  url: "https://reuters.com/env/amazon-1",
  source: { name: "Reuters" },
  description: "Deforestation in Amazon at record levels",
  urlToImage: "https://cdn.reuters.com/amazon.jpg",
  publishedAt: "2026-02-21T10:00:00Z",
};

const RUBRIC_LLM_RESPONSE: LLMScoreResponse = {
  healthReasoning: "Amazon deforestation impacts respiratory health of local communities.",
  healthLevel: "MODERATE",
  healthScore: 35,
  ecoReasoning: "Widespread deforestation destroys critical Amazon biodiversity.",
  ecoLevel: "SEVERE",
  ecoScore: 80,
  econReasoning: "Loss of ecosystem services has significant economic consequences.",
  econLevel: "MODERATE",
  econScore: 40,
  overallSummary: "Amazon deforestation accelerating with severe ecological impact.",
  category: "deforestation",
  region: "South America",
  keywords: ["amazon", "deforestation"],
};

// Helper: make a successful OpenRouter API response
function makeOpenRouterResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: Shared module exports — constants
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: BLOCKED_DOMAINS", () => {
  it("is exported as a non-empty array of strings", () => {
    expect(Array.isArray(BLOCKED_DOMAINS)).toBe(true);
    expect(BLOCKED_DOMAINS.length).toBeGreaterThan(0);
    BLOCKED_DOMAINS.forEach((d) => expect(typeof d).toBe("string"));
  });

  it("contains the known junk domains", () => {
    expect(BLOCKED_DOMAINS).toContain("lifesciencesworld.com");
    expect(BLOCKED_DOMAINS).toContain("alltoc.com");
  });
});

describe("AC-1: FEW_SHOT_EXAMPLES", () => {
  it("is exported as a non-empty string", () => {
    expect(typeof FEW_SHOT_EXAMPLES).toBe("string");
    expect(FEW_SHOT_EXAMPLES.length).toBeGreaterThan(0);
  });

  it("contains all four canonical example topic names", () => {
    expect(FEW_SHOT_EXAMPLES).toContain("Community Recycling Initiative Launch");
    expect(FEW_SHOT_EXAMPLES).toContain("Delhi Air Quality Alert");
    expect(FEW_SHOT_EXAMPLES).toContain("Great Barrier Reef Coral Bleaching");
    expect(FEW_SHOT_EXAMPLES).toContain("Fukushima Wastewater Release");
  });

  it("contains EXAMPLE 1 marker (used by scoring prompt test in api-batch-route.test.ts)", () => {
    expect(FEW_SHOT_EXAMPLES).toContain("EXAMPLE 1");
  });
});

describe("AC-1 / AC-4: DEFAULT_FEEDS", () => {
  it("is exported as a non-empty array of URL strings", () => {
    expect(Array.isArray(DEFAULT_FEEDS)).toBe(true);
    expect(DEFAULT_FEEDS.length).toBeGreaterThanOrEqual(10);
    DEFAULT_FEEDS.forEach((url) => {
      expect(typeof url).toBe("string");
      expect(() => new URL(url)).not.toThrow();
    });
  });

  it("contains the Guardian environment RSS feed", () => {
    expect(DEFAULT_FEEDS).toContain("https://www.theguardian.com/uk/environment/rss");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: Shared module exports — pure functions
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: isBlockedDomain()", () => {
  it("is exported as a function", () => {
    expect(typeof isBlockedDomain).toBe("function");
  });

  it("returns true for a known blocked domain", () => {
    expect(isBlockedDomain("https://lifesciencesworld.com/article")).toBe(true);
    expect(isBlockedDomain("https://alltoc.com/post/123")).toBe(true);
  });

  it("returns true for subdomains of blocked domains", () => {
    expect(isBlockedDomain("https://sub.lifesciencesworld.com/page")).toBe(true);
  });

  it("returns false for legitimate news domains", () => {
    expect(isBlockedDomain("https://reuters.com/env/article-1")).toBe(false);
    expect(isBlockedDomain("https://theguardian.com/environment/story")).toBe(false);
  });

  it("returns false for an invalid URL without throwing", () => {
    expect(isBlockedDomain("not-a-url")).toBe(false);
    expect(isBlockedDomain("")).toBe(false);
  });
});

describe("AC-1 / AC-4: feedHostname()", () => {
  it("is exported as a function", () => {
    expect(typeof feedHostname).toBe("function");
  });

  it("strips www. prefix from hostname", () => {
    expect(feedHostname("https://www.theguardian.com/uk/environment/rss")).toBe("theguardian.com");
  });

  it("returns hostname without www for non-www URLs", () => {
    expect(feedHostname("https://grist.org/feed/")).toBe("grist.org");
  });

  it("returns original string for invalid URL without throwing", () => {
    expect(feedHostname("not-a-url")).toBe("not-a-url");
  });
});

describe("AC-1: extractJSON()", () => {
  it("is exported as a function", () => {
    expect(typeof extractJSON).toBe("function");
  });

  it("extracts valid JSON object from plain text", () => {
    const result = extractJSON('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON embedded in prose (LLM preamble)", () => {
    const result = extractJSON('Here is the JSON response:\n{"score": 42}');
    expect(result).toEqual({ score: 42 });
  });

  it("returns null for non-JSON text (graceful fallback for bad LLM responses)", () => {
    expect(extractJSON("I cannot process this request.")).toBeNull();
    expect(extractJSON("")).toBeNull();
  });

  it("returns null for malformed JSON without throwing", () => {
    expect(extractJSON("{invalid json")).toBeNull();
  });
});

describe("AC-1: safeJsonb()", () => {
  it("is exported as a function", () => {
    expect(typeof safeJsonb).toBe("function");
  });

  it("returns a JSON string for an object", () => {
    const result = safeJsonb({ score: 42 });
    expect(typeof result).toBe("string");
    expect(JSON.parse(result as string)).toEqual({ score: 42 });
  });

  it("returns a JSON string for a string input", () => {
    const raw = '{"healthScore": 35}';
    const result = safeJsonb(raw);
    expect(typeof result).toBe("string");
  });

  it("does not throw for null or undefined inputs", () => {
    expect(() => safeJsonb(null)).not.toThrow();
    expect(() => safeJsonb(undefined)).not.toThrow();
  });
});

describe("AC-1: processScoreResult()", () => {
  it("is exported as a function", () => {
    expect(typeof processScoreResult).toBe("function");
  });

  it("clamps healthScore to MINIMAL level range (0-25) when LLM returns out-of-range value", () => {
    const outOfRange: LLMScoreResponse = {
      ...RUBRIC_LLM_RESPONSE,
      healthLevel: "MINIMAL",
      healthScore: 90, // must be clamped to 25
    };
    const result = processScoreResult(outOfRange, JSON.stringify(outOfRange), null, "Test Topic");
    expect(result.healthScore).toBeLessThanOrEqual(25);
    expect(result.clampedDimensions).toContain("health");
  });

  it("computes overall score as weighted average of health×0.35, eco×0.4, econ×0.25", () => {
    // health=35, eco=80, econ=40
    // round(35×0.35 + 80×0.4 + 40×0.25) = round(12.25 + 32 + 10) = round(54.25) = 54
    const result = processScoreResult(RUBRIC_LLM_RESPONSE, JSON.stringify(RUBRIC_LLM_RESPONSE), null, "Amazon");
    expect(result.overallScore).toBe(54);
  });

  it("derives urgency from overall score (80+ → breaking, 60-79 → critical, 30-59 → moderate, <30 → informational)", () => {
    const severeResponse: LLMScoreResponse = {
      ...RUBRIC_LLM_RESPONSE,
      healthLevel: "SEVERE",
      healthScore: 80,
      ecoLevel: "SEVERE",
      ecoScore: 85,
      econLevel: "SEVERE",
      econScore: 77,
    };
    const result = processScoreResult(severeResponse, JSON.stringify(severeResponse), null, "Test");
    expect(result.urgency).toBe("breaking");
  });

  it("detects anomaly when previous scores differ by more than 25 points", () => {
    const lowResponse: LLMScoreResponse = {
      ...RUBRIC_LLM_RESPONSE,
      healthLevel: "MINIMAL",
      healthScore: 5,
      ecoLevel: "MINIMAL",
      ecoScore: 10,
      econLevel: "MINIMAL",
      econScore: 8,
    };
    const previousScores = { health: 80, eco: 70, econ: 65 };
    const result = processScoreResult(lowResponse, JSON.stringify(lowResponse), previousScores, "Amazon");
    expect(result.anomalyDetected).toBe(true);
  });

  it("does not detect anomaly when previous scores differ by 25 points or less", () => {
    const closeResponse: LLMScoreResponse = {
      ...RUBRIC_LLM_RESPONSE,
      healthLevel: "MODERATE",
      healthScore: 35,
      ecoLevel: "SEVERE",
      ecoScore: 80,
      econLevel: "MODERATE",
      econScore: 40,
    };
    const previousScores = { health: 40, eco: 75, econ: 45 }; // all within 25
    const result = processScoreResult(closeResponse, JSON.stringify(closeResponse), previousScores, "Amazon");
    expect(result.anomalyDetected).toBe(false);
  });

  it("excludes INSUFFICIENT_DATA dimension from weighted average (renormalizes weights)", () => {
    const insufficientEcon: LLMScoreResponse = {
      ...RUBRIC_LLM_RESPONSE,
      healthLevel: "MODERATE",
      healthScore: 40,
      ecoLevel: "SIGNIFICANT",
      ecoScore: 55,
      econLevel: "INSUFFICIENT_DATA",
      econScore: -1,
    };
    // Overall = (40×0.35 + 55×0.4) / (0.35 + 0.4) = (14 + 22) / 0.75 = 48
    const result = processScoreResult(insufficientEcon, JSON.stringify(insufficientEcon), null, "Test");
    expect(result.overallScore).toBe(48);
    expect(result.econLevel).toBe("INSUFFICIENT_DATA");
    expect(result.econScore).toBe(-1);
  });

  it("uses || '' fallback for all string fields from LLM (null-safety)", () => {
    const withNulls = {
      ...RUBRIC_LLM_RESPONSE,
      healthReasoning: undefined as unknown as string,
      ecoReasoning: null as unknown as string,
      econReasoning: undefined as unknown as string,
      overallSummary: null as unknown as string,
    };
    const result = processScoreResult(withNulls, "", null, "Test");
    expect(typeof result.healthReasoning).toBe("string");
    expect(typeof result.ecoReasoning).toBe("string");
    expect(typeof result.econReasoning).toBe("string");
    expect(typeof result.overallSummary).toBe("string");
  });

  it("uses Array.isArray guard for keywords from LLM (null-safety)", () => {
    const withBadKeywords = {
      ...RUBRIC_LLM_RESPONSE,
      keywords: null as unknown as string[],
    };
    const result = processScoreResult(withBadKeywords, "", null, "Test");
    expect(Array.isArray(result.keywords)).toBe(true);
  });

  it("sets anomalyDetected to false when no previousScores are provided", () => {
    const result = processScoreResult(RUBRIC_LLM_RESPONSE, JSON.stringify(RUBRIC_LLM_RESPONSE), null, "Test");
    expect(result.anomalyDetected).toBe(false);
  });

  it("includes clampedDimensions in result (empty when no clamping needed)", () => {
    const result = processScoreResult(RUBRIC_LLM_RESPONSE, JSON.stringify(RUBRIC_LLM_RESPONSE), null, "Test");
    expect(Array.isArray(result.clampedDimensions)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: buildClassificationPrompt()", () => {
  it("is exported as a function", () => {
    expect(typeof buildClassificationPrompt).toBe("function");
  });

  it("includes article titles in the prompt", () => {
    const prompt = buildClassificationPrompt([AMAZON_ARTICLE], []);
    expect(prompt).toContain("Amazon deforestation accelerating");
  });

  it("includes existing topic names in the prompt", () => {
    const existingTopics = [{ name: "Climate Crisis", keywords: ["climate", "warming"] }];
    const prompt = buildClassificationPrompt([AMAZON_ARTICLE], existingTopics);
    expect(prompt).toContain("Climate Crisis");
  });

  it("contains NEWSWORTHINESS TEST section (Story 4.6 alignment)", () => {
    const prompt = buildClassificationPrompt([AMAZON_ARTICLE], []);
    expect(prompt).toContain("NEWSWORTHINESS TEST");
  });

  it("contains Q&A rejection criteria (Story 4.6 alignment)", () => {
    const prompt = buildClassificationPrompt([AMAZON_ARTICLE], []);
    expect(prompt).toContain("Q&A");
    expect(prompt).toContain("question");
  });

  it("contains rejection JSON fields in schema (Story 4.6 alignment)", () => {
    const prompt = buildClassificationPrompt([AMAZON_ARTICLE], []);
    expect(prompt).toContain('"rejected"');
    expect(prompt).toContain('"rejectionReasons"');
  });

  it("shows (none yet) when no existing topics provided", () => {
    const prompt = buildClassificationPrompt([AMAZON_ARTICLE], []);
    expect(prompt).toContain("(none yet)");
  });
});

describe("AC-1: buildScoringPrompt()", () => {
  it("is exported as a function", () => {
    expect(typeof buildScoringPrompt).toBe("function");
  });

  it("includes topic name in the prompt", () => {
    const prompt = buildScoringPrompt("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(prompt).toContain("Amazon Deforestation");
  });

  it("includes article titles in the prompt", () => {
    const prompt = buildScoringPrompt("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(prompt).toContain("Amazon deforestation accelerating");
  });

  it("embeds FEW_SHOT_EXAMPLES (EXAMPLE 1 marker present)", () => {
    const prompt = buildScoringPrompt("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(prompt).toContain("EXAMPLE 1");
    expect(prompt).toContain("Community Recycling Initiative Launch");
  });

  it("contains all four scoring rubric levels", () => {
    const prompt = buildScoringPrompt("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(prompt).toContain("MINIMAL");
    expect(prompt).toContain("MODERATE");
    expect(prompt).toContain("SIGNIFICANT");
    expect(prompt).toContain("SEVERE");
  });

  it("instructs LLM NOT to include overall score (server-side computation)", () => {
    const prompt = buildScoringPrompt("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(prompt).toContain("server-side");
  });

  it("instructs LLM to use INSUFFICIENT_DATA when evidence is lacking", () => {
    const prompt = buildScoringPrompt("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(prompt).toContain("INSUFFICIENT_DATA");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: mergeAndDedup()
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: mergeAndDedup()", () => {
  it("is exported as a function", () => {
    expect(typeof mergeAndDedup).toBe("function");
  });

  it("merges RSS and GNews articles into a single deduplicated list", () => {
    const rssArticle: NewsArticle = {
      ...AMAZON_ARTICLE,
      url: "https://guardian.com/env/rss-1",
    };
    const gnewsArticle: NewsArticle = {
      ...AMAZON_ARTICLE,
      url: "https://reuters.com/env/gnews-1",
    };
    const { articles, sourceMap } = mergeAndDedup([rssArticle], [gnewsArticle]);
    expect(articles).toHaveLength(2);
    expect(sourceMap.get(rssArticle.url)).toBe("rss");
    expect(sourceMap.get(gnewsArticle.url)).toBe("gnews");
  });

  it("RSS wins over GNews on cross-source URL duplicates", () => {
    const sharedUrl = "https://reuters.com/env/shared-1";
    const rssVersion: NewsArticle = { ...AMAZON_ARTICLE, url: sharedUrl };
    const gnewsVersion: NewsArticle = { ...AMAZON_ARTICLE, url: sharedUrl };

    const { articles, sourceMap } = mergeAndDedup([rssVersion], [gnewsVersion]);
    expect(articles).toHaveLength(1);
    expect(sourceMap.get(sharedUrl)).toBe("rss");
  });

  it("removes articles from blocked domains during merge", () => {
    const blockedArticle: NewsArticle = {
      ...AMAZON_ARTICLE,
      url: "https://lifesciencesworld.com/article-1",
    };
    const { articles } = mergeAndDedup([], [blockedArticle]);
    expect(articles).toHaveLength(0);
  });

  it("deduplicates GNews-only duplicates", () => {
    const duplicate: NewsArticle = { ...AMAZON_ARTICLE };
    const { articles } = mergeAndDedup([], [AMAZON_ARTICLE, duplicate]);
    expect(articles).toHaveLength(1);
  });

  it("handles empty inputs gracefully", () => {
    const { articles, sourceMap } = mergeAndDedup([], []);
    expect(articles).toHaveLength(0);
    expect(sourceMap.size).toBe(0);
  });

  it("returns gnewsCount and rssCount for stats reporting (AC #9 from batch route)", () => {
    const rssArticle: NewsArticle = { ...AMAZON_ARTICLE, url: "https://guardian.com/rss-1" };
    const gnewsArticle: NewsArticle = { ...AMAZON_ARTICLE, url: "https://reuters.com/gnews-1" };
    const result = mergeAndDedup([rssArticle], [gnewsArticle]);
    expect(typeof result.rssCount).toBe("number");
    expect(typeof result.gnewsCount).toBe("number");
    expect(result.rssCount).toBe(1);
    expect(result.gnewsCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: logFeedHealth()
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: logFeedHealth()", () => {
  it("is exported as a function", () => {
    expect(typeof logFeedHealth).toBe("function");
  });

  it("logs healthy feed with article count and duration", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const health: FeedHealth[] = [
      {
        name: "Guardian Environment",
        url: "https://www.theguardian.com/uk/environment/rss",
        status: "ok",
        articleCount: 5,
        durationMs: 200,
      },
    ];
    logFeedHealth(health);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Guardian Environment"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("5"));
    consoleSpy.mockRestore();
  });

  it("logs failed feed with error message", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const health: FeedHealth[] = [
      {
        name: "theguardian.com",
        url: "https://www.theguardian.com/uk/environment/rss",
        status: "error",
        articleCount: 0,
        durationMs: 15000,
        error: "Request timed out",
      },
    ];
    logFeedHealth(health);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("FAILED"));
    consoleSpy.mockRestore();
  });

  it("logs overall healthy/failed summary line", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const health: FeedHealth[] = [
      { name: "Feed A", url: "https://feeda.com/rss", status: "ok", articleCount: 3, durationMs: 100 },
      { name: "feeda.com", url: "https://feedb.com/rss", status: "error", articleCount: 0, durationMs: 500, error: "timeout" },
    ];
    logFeedHealth(health);
    const logCalls = consoleSpy.mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("1/2"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("does not log anything when feedHealth is empty", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    logFeedHealth([]);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1 / AC-4: fetchRssFeeds() — exported from shared module
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1 / AC-4: fetchRssFeeds() from shared module", () => {
  beforeEach(() => {
    mockParseURL.mockReset();
  });

  it("is exported as a function that returns articles and feedHealth", async () => {
    expect(typeof fetchRssFeeds).toBe("function");
    mockParseURL.mockResolvedValue({ title: "Default Feed", items: [] });

    const result = await fetchRssFeeds();
    expect(result).toHaveProperty("articles");
    expect(result).toHaveProperty("feedHealth");
    expect(Array.isArray(result.articles)).toBe(true);
    expect(Array.isArray(result.feedHealth)).toBe(true);
  });

  it("parses a valid RSS feed item into a NewsArticle", async () => {
    mockParseURL.mockResolvedValueOnce({
      title: "Guardian Environment",
      items: [
        {
          title: "Climate report released",
          link: "https://example.com/article-1",
          isoDate: "2026-02-20T10:00:00Z",
          contentSnippet: "New climate data released today.",
        },
      ],
    });

    const { articles, feedHealth } = await fetchRssFeeds();
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Climate report released");
    expect(articles[0].url).toBe("https://example.com/article-1");
    expect(articles[0].publishedAt).toBe("2026-02-20T10:00:00Z");
    expect(feedHealth[0].status).toBe("ok");
    expect(feedHealth[0].articleCount).toBe(1);
  });

  it("handles RSS fetch failure gracefully (feed status becomes error)", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockParseURL.mockRejectedValue(new Error("Request timed out"));

    const { articles, feedHealth } = await fetchRssFeeds();
    expect(articles).toEqual([]);
    expect(feedHealth.every((f) => f.status === "error")).toBe(true);
    consoleSpy.mockRestore();
  });

  it("skips articles without title or link", async () => {
    mockParseURL.mockResolvedValueOnce({
      title: "Test Feed",
      items: [
        { title: null, link: "https://example.com/no-title" },
        { title: "No link article", link: undefined },
        { title: "Valid", link: "https://example.com/valid", isoDate: "2026-02-20T10:00:00Z" },
      ],
    });

    const { articles } = await fetchRssFeeds();
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Valid");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-5: Parser singleton
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-5: Parser singleton — module-scoped, not per-call", () => {
  it("Parser constructor is called exactly once at module load (not per fetchRssFeeds call)", async () => {
    // The mock was set up at module load time (before the import).
    // If the shared module creates a singleton, the constructor runs once.
    // We can verify by checking that the mock constructor was called at most once
    // per test run (not once per fetchRssFeeds invocation).
    const constructorCallCount = (Parser as unknown as jest.Mock).mock.calls.length;
    // Should be exactly 1 — the module-level `new Parser(...)` in batch-pipeline.ts
    expect(constructorCallCount).toBe(1);
  });

  it("multiple fetchRssFeeds calls reuse the same Parser instance (no additional constructor calls)", async () => {
    mockParseURL.mockResolvedValue({ title: "Feed", items: [] });
    const callsBefore = (Parser as unknown as jest.Mock).mock.calls.length;

    await fetchRssFeeds();
    await fetchRssFeeds();

    const callsAfter = (Parser as unknown as jest.Mock).mock.calls.length;
    // No new constructor calls — singleton reused
    expect(callsAfter).toBe(callsBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: callLLM()
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: callLLM()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is exported as a function", () => {
    expect(typeof callLLM).toBe("function");
  });

  it("sends request to OpenRouter with temperature 0", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse('{"key": "value"}')
    );

    await callLLM("test prompt");

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(options.body);
    expect(body.temperature).toBe(0);
  });

  it("includes Authorization Bearer header with OPENROUTER_API_KEY", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse('{"key": "value"}')
    );

    await callLLM("test prompt");

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test-openrouter-key");
  });

  it("accepts optional jsonMode parameter defaulting to true", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse('{"key": "value"}')
    );

    // Default (jsonMode: true)
    await callLLM("test prompt");
    const body1 = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body1.response_format).toEqual({ type: "json_object" });

    // Explicit jsonMode: false
    (global.fetch as jest.Mock).mockResolvedValue(
      makeOpenRouterResponse("plain text response")
    );
    await callLLM("test prompt", { jsonMode: false });
    const body2 = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body2.response_format).toBeUndefined();
  });

  it("returns the content string from LLM response", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse('{"healthScore": 35}')
    );

    const result = await callLLM("test prompt");
    expect(result).toBe('{"healthScore": 35}');
  });

  it("returns empty string when choices array is missing", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    });

    const result = await callLLM("test prompt");
    expect(result).toBe("");
  });

  it("throws an error when OpenRouter returns a non-ok HTTP status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => '{"error": "Model overloaded"}',
    });

    await expect(callLLM("test prompt")).rejects.toThrow("OpenRouter API error: 500");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: fetchNews()
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: fetchNews()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is exported as a function", () => {
    expect(typeof fetchNews).toBe("function");
  });

  it("returns articles from GNews API as NewsArticle array", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        totalArticles: 1,
        articles: [
          {
            title: "Amazon deforestation accelerating",
            url: "https://reuters.com/env/amazon-1",
            source: { name: "Reuters", url: "https://reuters.com" },
            description: "Deforestation at record levels",
            image: "https://cdn.reuters.com/amazon.jpg",
            publishedAt: "2026-02-21T10:00:00Z",
          },
        ],
      }),
    });

    const articles = await fetchNews();
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Amazon deforestation accelerating");
    // GNews `image` → NewsArticle `urlToImage` mapping
    expect(articles[0].urlToImage).toBe("https://cdn.reuters.com/amazon.jpg");
    expect(articles[0].url).toBe("https://reuters.com/env/amazon-1");
  });

  it("handles GNews 401 error gracefully and returns empty array", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ errors: ["The API token is invalid or has been deactivated."] }),
    });

    const articles = await fetchNews();
    expect(articles).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("auth failure"));
    consoleSpy.mockRestore();
  });

  it("handles GNews 429 rate limit gracefully and returns empty array", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ errors: ["Rate limit exceeded."] }),
    });

    const articles = await fetchNews();
    expect(articles).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("rate limit"));
    consoleSpy.mockRestore();
  });

  it("filters out articles from blocked domains", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        totalArticles: 1,
        articles: [
          {
            title: "What is deforestation?",
            url: "https://lifesciencesworld.com/deforestation",
            source: { name: "Life Sciences World", url: "https://lifesciencesworld.com" },
            description: "Educational article about deforestation",
            image: null,
            publishedAt: "2026-02-21T10:00:00Z",
          },
        ],
      }),
    });

    const articles = await fetchNews();
    expect(articles).toHaveLength(0);
  });

  it("deduplicates articles with the same URL", async () => {
    // When BATCH_KEYWORDS has multiple groups, same URL can appear twice
    // Process.env.BATCH_KEYWORDS = "amazon deforestation" → 1 keyword → 1 group
    // But we simulate dedup by returning same URL twice in articles array
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        articles: [
          {
            title: "Article A",
            url: "https://reuters.com/env/dup-1",
            source: { name: "Reuters", url: "https://reuters.com" },
            description: "desc",
            image: null,
            publishedAt: "2026-02-21T10:00:00Z",
          },
          {
            title: "Article A duplicate",
            url: "https://reuters.com/env/dup-1", // same URL
            source: { name: "Reuters", url: "https://reuters.com" },
            description: "desc",
            image: null,
            publishedAt: "2026-02-21T10:00:00Z",
          },
        ],
      }),
    });

    const articles = await fetchNews();
    expect(articles).toHaveLength(1);
  });

  it("filters out auction/junk source names", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        articles: [
          {
            title: "EV auction results",
            url: "https://bringatrailer.com/ev-1",
            source: { name: "Bring a Trailer", url: "https://bringatrailer.com" },
            description: "Auction",
            image: null,
            publishedAt: "2026-02-21T10:00:00Z",
          },
        ],
      }),
    });

    const articles = await fetchNews();
    expect(articles).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: classifyArticles()
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: classifyArticles()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is exported as a function", () => {
    expect(typeof classifyArticles).toBe("function");
  });

  it("returns Classification[] from successful LLM response", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse(JSON.stringify({
        classifications: [
          { articleIndex: 0, topicName: "Amazon Deforestation", isNew: true },
        ],
        rejected: [],
        rejectionReasons: [],
      }))
    );

    const result = await classifyArticles([AMAZON_ARTICLE], []);
    expect(result).toHaveLength(1);
    expect(result[0].topicName).toBe("Amazon Deforestation");
    expect(result[0].articleIndex).toBe(0);
    expect(typeof result[0].isNew).toBe("boolean");
  });

  it("returns [] when LLM returns non-JSON (divergence decision: return [], not fallback grouping)", async () => {
    // Story 8-1 divergence resolution #3: return [] on failure (not "Environmental News" fallback)
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse("I cannot process this request.")
    );

    const result = await classifyArticles([AMAZON_ARTICLE], []);
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("logs rejection stats when LLM returns rejected array", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse(JSON.stringify({
        classifications: [
          { articleIndex: 0, topicName: "Amazon Deforestation", isNew: true },
        ],
        rejected: [1],
        rejectionReasons: ["Q&A content"],
      }))
    );

    const articles = [
      AMAZON_ARTICLE,
      { ...AMAZON_ARTICLE, title: "What is deforestation?", url: "https://example.com/qa" },
    ];
    await classifyArticles(articles, []);

    const logCalls = consoleSpy.mock.calls.map((c) => c.join(" "));
    expect(logCalls.some((c) => c.includes("Q&A content"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("handles missing rejected array gracefully (no crash)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse(JSON.stringify({
        classifications: [
          { articleIndex: 0, topicName: "Amazon Deforestation", isNew: true },
        ],
        // No rejected or rejectionReasons fields
      }))
    );

    const result = await classifyArticles([AMAZON_ARTICLE], []);
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: scoreTopic()
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: scoreTopic()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is exported as a function", () => {
    expect(typeof scoreTopic).toBe("function");
  });

  it("returns a TopicScore with all required fields from a valid LLM response", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse(JSON.stringify(RUBRIC_LLM_RESPONSE))
    );

    const result = await scoreTopic("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(typeof result.overallScore).toBe("number");
    expect(typeof result.urgency).toBe("string");
    expect(typeof result.anomalyDetected).toBe("boolean");
    expect(Array.isArray(result.keywords)).toBe(true);
    expect(Array.isArray(result.clampedDimensions)).toBe(true);
    expect(result.rawLlmResponse).toBeDefined();
  });

  it("accepts optional previousScores parameter for anomaly detection", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse(JSON.stringify({
        ...RUBRIC_LLM_RESPONSE,
        healthLevel: "MINIMAL",
        healthScore: 5,
        ecoLevel: "MINIMAL",
        ecoScore: 10,
        econLevel: "MINIMAL",
        econScore: 8,
      }))
    );

    const previousScores = { health: 80, eco: 70, econ: 65 };
    const result = await scoreTopic("Amazon Deforestation", [AMAZON_ARTICLE], previousScores);
    expect(result.anomalyDetected).toBe(true);
  });

  it("returns default score 50 gracefully when LLM returns non-JSON", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse("I cannot process this request in the required format.")
    );

    const result = await scoreTopic("Amazon Deforestation", [AMAZON_ARTICLE]);
    expect(result.overallScore).toBe(50);
    expect(result.healthScore).toBe(50);
    expect(result.ecoScore).toBe(50);
    expect(result.econScore).toBe(50);
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-2: Zero SYNC comments — verified by grepping the source tree
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-2: SYNC comments eliminated", () => {
  it("finds no '// SYNC' comments in src/ or scripts/", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require("child_process") as { execSync: (cmd: string, opts: object) => string };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as { resolve: (...args: string[]) => string };
    const repoRoot = path.resolve(__dirname, "..");
    // `grep -r "// SYNC" ... || true` always exits 0; presence of output = failure.
    const output = execSync(
      `grep -r "// SYNC" "${repoRoot}/src" "${repoRoot}/scripts" || true`,
      { encoding: "utf-8" }
    );
    expect(output.trim()).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-3: No regressions — integration-style tests
// These verify that the shared module can be called the same way route.ts
// and batch.ts call it, and produces the same results.
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-3: Integration-style — route.ts call pattern", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseURL.mockReset();
    mockParseURL.mockResolvedValue({ title: "Default Feed", items: [] });
  });

  it("full classification → scoring pipeline produces expected overallScore", async () => {
    // Simulate: 1 article → classify → score → processScoreResult
    global.fetch = jest.fn()
      // LLM classification call
      .mockResolvedValueOnce(
        makeOpenRouterResponse(JSON.stringify({
          classifications: [{ articleIndex: 0, topicName: "Amazon Deforestation", isNew: true }],
          rejected: [],
          rejectionReasons: [],
        }))
      )
      // LLM scoring call
      .mockResolvedValueOnce(
        makeOpenRouterResponse(JSON.stringify(RUBRIC_LLM_RESPONSE))
      );

    const classifications = await classifyArticles([AMAZON_ARTICLE], []);
    expect(classifications).toHaveLength(1);

    const score = await scoreTopic("Amazon Deforestation", [AMAZON_ARTICLE]);
    // health=35×0.35 + eco=80×0.4 + econ=40×0.25 = 54
    expect(score.overallScore).toBe(54);
    expect(score.urgency).toBe("moderate"); // 54 is in 30-59 range
  });

  it("mergeAndDedup produces the sourceMap consumed by article inserts in route.ts", () => {
    const rssArticle: NewsArticle = {
      ...AMAZON_ARTICLE,
      url: "https://guardian.com/env/rss-only",
    };
    const { sourceMap } = mergeAndDedup([rssArticle], [AMAZON_ARTICLE]);

    // Route.ts uses: sourceMap.get(a.url) ?? "gnews"
    expect(sourceMap.get(rssArticle.url)).toBe("rss");
    expect(sourceMap.get(AMAZON_ARTICLE.url)).toBe("gnews");
    // Missing URL fallback
    expect(sourceMap.get("https://unknown.com/article") ?? "gnews").toBe("gnews");
  });
});

describe("AC-3: Integration-style — batch.ts call pattern", () => {
  it("scoreTopic with previousScores mirrors batch.ts anomaly detection flow", async () => {
    // batch.ts (post-refactor) pattern:
    //   const score = await scoreTopic(topicName, articles, previousScores);
    //   // anomalyDetected is already computed in scoreTopic
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse(JSON.stringify({
        ...RUBRIC_LLM_RESPONSE,
        healthLevel: "MINIMAL",
        healthScore: 5,
      }))
    );

    const previousScores = { health: 80, eco: 70, econ: 65 };
    const score = await scoreTopic("Amazon Deforestation", [AMAZON_ARTICLE], previousScores);

    // Anomaly detected because health delta: |5 - 80| = 75 > 25
    expect(score.anomalyDetected).toBe(true);
    // clampedDimensions includes "health" (5 is MINIMAL, max is 25, no clamp needed here
    // but if healthScore were 90 with MINIMAL, it would be clamped)
    expect(Array.isArray(score.clampedDimensions)).toBe(true);
  });

  it("classifyArticles returning [] when LLM fails matches route.ts empty-result path", async () => {
    // batch.ts wraps the empty result in its own fallback at the call site.
    // The shared classifyArticles must return [].
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue(
      makeOpenRouterResponse("not json")
    );

    const result = await classifyArticles([AMAZON_ARTICLE], []);
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-4: RSS consolidation — scripts/rss.ts exports now come from shared module
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-4: RSS exports consolidated into shared module", () => {
  it("fetchRssFeeds is a function (not undefined — confirming it moved from scripts/rss.ts)", () => {
    expect(typeof fetchRssFeeds).toBe("function");
  });

  it("feedHostname is a function (not undefined — confirming it moved from scripts/rss.ts)", () => {
    expect(typeof feedHostname).toBe("function");
  });

  it("DEFAULT_FEEDS is an array (not undefined — confirming it moved from scripts/rss.ts)", () => {
    expect(Array.isArray(DEFAULT_FEEDS)).toBe(true);
  });

  it("FeedHealth type is usable at runtime (interface exported — confirmed by type import above)", () => {
    // TypeScript interfaces are erased at runtime; the type import at the top of this file
    // would cause a compile error if FeedHealth is not exported from batch-pipeline.ts.
    // We verify the interface is structurally correct by constructing a conforming object.
    const health: FeedHealth = {
      name: "Guardian Environment",
      url: "https://www.theguardian.com/uk/environment/rss",
      status: "ok",
      articleCount: 5,
      durationMs: 200,
    };
    expect(health.status).toBe("ok");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: Type exports (compile-time verification)
//
// These tests construct objects conforming to each exported interface to confirm
// the interfaces are exported correctly. TypeScript compile errors here mean the
// interface is missing or has wrong shape.
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-1: Type exports — structural conformance", () => {
  it("NewsArticle interface is exportable and structurally correct", () => {
    const article: NewsArticle = {
      title: "Test",
      url: "https://example.com",
      source: { name: "Reuters" },
      description: null,
      urlToImage: null,
      publishedAt: "2026-02-21T10:00:00Z",
    };
    expect(article.title).toBe("Test");
  });

  it("GNewsArticle interface is exportable and structurally correct", () => {
    const gnews: GNewsArticle = {
      title: "Test",
      url: "https://example.com",
      source: { name: "Reuters", url: "https://reuters.com" },
      description: "desc",
      image: null,
      publishedAt: "2026-02-21T10:00:00Z",
    };
    expect(gnews.source.url).toBe("https://reuters.com");
  });

  it("Classification interface is exportable and structurally correct", () => {
    const c: Classification = {
      articleIndex: 0,
      topicName: "Amazon Deforestation",
      isNew: true,
    };
    expect(c.isNew).toBe(true);
  });

  it("LLMScoreResponse interface is exportable and structurally correct", () => {
    const r: LLMScoreResponse = { ...RUBRIC_LLM_RESPONSE };
    expect(r.healthScore).toBe(35);
  });

  it("TopicScore interface is exportable — rawLlmResponse type is unknown (not string)", () => {
    // Dev Notes divergence resolution #2: use `unknown` for rawLlmResponse
    const score: TopicScore = {
      healthReasoning: "r",
      healthLevel: "MODERATE",
      healthScore: 35,
      ecoReasoning: "r",
      ecoLevel: "SEVERE",
      ecoScore: 80,
      econReasoning: "r",
      econLevel: "MODERATE",
      econScore: 40,
      overallSummary: "s",
      category: "deforestation",
      region: "South America",
      keywords: ["amazon"],
      overallScore: 54,
      urgency: "moderate",
      anomalyDetected: false,
      rawLlmResponse: { raw: "object" }, // `unknown` accepts objects, strings, null, etc.
      clampedDimensions: [],
    };
    expect(score.rawLlmResponse).toBeDefined();
  });
});
