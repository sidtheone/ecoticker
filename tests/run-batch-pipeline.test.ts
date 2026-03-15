/**
 * Tests for runBatchPipeline() — the unified batch orchestrator.
 *
 * Covers:
 * - daily mode: fetch + classify + score + persist
 * - backfill-full mode: GNews with date range, no RSS
 * - backfill-rescore mode: load from DB, re-classify + re-score
 * - early exit when no articles found
 * - per-topic error resilience (try/catch)
 * - GDPR audit log purge
 * - classification fallback to "Environmental News"
 * - clamping warning threshold
 * - ghost scoring prevention (all-dupe skip, partial-dupe count, articlesAdded accuracy)
 */

// Set env vars BEFORE any module load
process.env.GNEWS_API_KEY = "test-gnews-key";
process.env.OPENROUTER_API_KEY = "test-openrouter-key";
process.env.BATCH_KEYWORDS = "climate change";
process.env.DATABASE_URL = "postgresql://localhost/test";

import {
  runBatchPipeline,
  type BatchPipelineOptions,
  type BatchPipelineResult,
} from "@/lib/batch-pipeline";
import { articles as articlesTable, topics as topicsTable } from "@/db/schema";

// Mock rss-parser before batch-pipeline imports it
jest.mock("rss-parser", () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn().mockResolvedValue({ title: "Mock Feed", items: [] }),
  }));
});

// ─── Mock DB Builder ──────────────────────────────────────────────

interface MockForDailyOptions {
  existingTopics?: any[];
  existingArticleUrls?: string[];
}

function createMockDb() {
  const insertedValues: any[] = [];
  const deletedTables: string[] = [];

  const chain: any = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "from",
    "where",
    "orderBy",
    "limit",
    "offset",
    "values",
    "set",
    "onConflictDoUpdate",
    "onConflictDoNothing",
    "returning",
    "leftJoin",
    "groupBy",
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }

  // Make chain thenable (resolves to empty array by default)
  chain.then = (resolve: any) => Promise.resolve([]).then(resolve);

  // Track insert values
  chain.values.mockImplementation((vals: any) => {
    insertedValues.push(vals);
    return chain;
  });

  // returning() resolves to [{ id: 1 }] for topic upserts
  chain.returning.mockResolvedValue([{ id: 1 }]);

  // delete resolves with rowCount
  chain.delete.mockImplementation(() => {
    const deleteChain = { ...chain };
    deleteChain.where = jest.fn().mockResolvedValue({ rowCount: 0 });
    return deleteChain;
  });

  return {
    chain,
    insertedValues,
    /**
     * Configure the mock to return specific data for SELECT queries.
     * Discriminates by table reference passed to from():
     * - from(topics) on first call → existingTopics
     * - from(articles) with where (URL pre-query) → matching existing URLs
     * - COUNT queries (topics/articles) → [{ count: 5 }]
     */
    mockForDaily({
      existingTopics = [],
      existingArticleUrls = [],
    }: MockForDailyOptions = {}) {
      let topicsSelectDone = false;
      chain.select.mockImplementation(() => {
        const selectChain = { ...chain };

        // from() captures the table reference to decide what to return
        selectChain.from = jest.fn().mockImplementation((tableRef: any) => {
          // URL pre-query: SELECT url FROM articles WHERE url IN (...)
          // Identified by from(articles) when articles have a url column
          if (tableRef === articlesTable) {
            selectChain.where = jest.fn().mockReturnValue(selectChain);
            selectChain.then = (resolve: any) => {
              // Return only the URLs that match our "existing" set
              const matchingUrls = existingArticleUrls.map((url) => ({ url }));
              return Promise.resolve(matchingUrls).then(resolve);
            };
            return selectChain;
          }

          // Topics query (first call with topics table or groupBy/leftJoin)
          if (tableRef === topicsTable && !topicsSelectDone) {
            topicsSelectDone = true;
            selectChain.leftJoin = jest.fn().mockReturnValue(selectChain);
            selectChain.groupBy = jest.fn().mockReturnValue(selectChain);
            selectChain.where = jest.fn().mockReturnValue(selectChain);
            selectChain.then = (resolve: any) => {
              return Promise.resolve(existingTopics).then(resolve);
            };
            return selectChain;
          }

          // All other selects: COUNT queries → [{ count: 5 }]
          selectChain.where = jest.fn().mockReturnValue(selectChain);
          selectChain.leftJoin = jest.fn().mockReturnValue(selectChain);
          selectChain.groupBy = jest.fn().mockReturnValue(selectChain);
          selectChain.then = (resolve: any) => {
            return Promise.resolve([{ count: 5 }]).then(resolve);
          };
          return selectChain;
        });

        selectChain.leftJoin = jest.fn().mockReturnValue(selectChain);
        selectChain.groupBy = jest.fn().mockReturnValue(selectChain);
        selectChain.where = jest.fn().mockReturnValue(selectChain);
        return selectChain;
      });
    },
    /**
     * Configure for backfill-rescore: first SELECT returns articles from DB.
     */
    mockForRescore(dbArticles: any[]) {
      let selectCallCount = 0;
      chain.select.mockImplementation(() => {
        selectCallCount++;
        const selectChain = { ...chain };
        selectChain.then = (resolve: any) => {
          if (selectCallCount === 1) {
            return Promise.resolve(dbArticles).then(resolve);
          }
          if (selectCallCount === 2) {
            // existing topics for classify
            return Promise.resolve([]).then(resolve);
          }
          return Promise.resolve([{ count: 3 }]).then(resolve);
        };
        selectChain.from = jest.fn().mockReturnValue(selectChain);
        selectChain.leftJoin = jest.fn().mockReturnValue(selectChain);
        selectChain.groupBy = jest.fn().mockReturnValue(selectChain);
        selectChain.where = jest.fn().mockReturnValue(selectChain);
        return selectChain;
      });
    },
  };
}

// ─── Mock LLM + GNews Responses ───────────────────────────────────

const GNEWS_ARTICLE = {
  title: "Climate crisis intensifies in 2026",
  url: "https://reuters.com/climate-2026",
  source: { name: "Reuters", url: "https://reuters.com" },
  description: "Global temperatures continue to rise.",
  image: "https://cdn.reuters.com/climate.jpg",
  publishedAt: "2026-03-08T10:00:00Z",
};

const CLASSIFICATION_RESPONSE = {
  classifications: [
    { articleIndex: 0, topicName: "Climate Crisis", isNew: true },
  ],
  rejected: [],
  rejectionReasons: [],
};

const SCORING_RESPONSE = {
  healthReasoning: "Rising temperatures affect public health.",
  healthLevel: "MODERATE",
  healthScore: 40,
  ecoReasoning: "Ecosystem disruption from warming.",
  ecoLevel: "SIGNIFICANT",
  ecoScore: 65,
  econReasoning: "Economic costs of climate adaptation.",
  econLevel: "MODERATE",
  econScore: 35,
  overallSummary: "Climate crisis intensifying with broad impacts.",
  category: "climate",
  region: "Global",
  keywords: ["climate", "warming"],
};

function makeGNewsResponse(articles: any[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ totalArticles: articles.length, articles }),
  };
}

function makeLLMResponse(data: object) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(data) } }],
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("runBatchPipeline", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("daily mode", () => {
    it("fetches, classifies, scores, and persists articles", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE])) // GNews
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE)) // classify
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE)); // score

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      expect(result.topicsProcessed).toBe(1);
      expect(result.articlesAdded).toBe(1);
      expect(result.scoresRecorded).toBe(1);
      expect(result.gnewsArticles).toBe(1);

      // Verify topic was inserted
      const topicInsert = mock.insertedValues.find(
        (v) => v.name === "Climate Crisis"
      );
      expect(topicInsert).toBeDefined();
      expect(topicInsert.currentScore).toBeGreaterThan(0);

      // Verify article was inserted
      const articleInsert = mock.insertedValues.find(
        (v) => v.url === GNEWS_ARTICLE.url
      );
      expect(articleInsert).toBeDefined();
      expect(articleInsert.sourceType).toBe("gnews");
    });

    it("returns zeros when no articles found", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      // GNews returns empty
      global.fetch = jest.fn().mockResolvedValueOnce(
        makeGNewsResponse([])
      );

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      expect(result.topicsProcessed).toBe(0);
      expect(result.articlesAdded).toBe(0);
      expect(result.scoresRecorded).toBe(0);
    });

    it("falls back to 'Environmental News' when classification returns empty", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
        .mockResolvedValueOnce(
          makeLLMResponse({ classifications: [], rejected: [0], rejectionReasons: ["junk"] })
        )
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      // Fallback kicks in — article classified under "Environmental News"
      expect(result.topicsProcessed).toBe(1);
      const topicInsert = mock.insertedValues.find(
        (v) => v.name === "Environmental News"
      );
      expect(topicInsert).toBeDefined();
    });

    it("continues processing other topics when one topic fails", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      const twoArticleClassification = {
        classifications: [
          { articleIndex: 0, topicName: "Topic A", isNew: true },
          { articleIndex: 1, topicName: "Topic B", isNew: true },
        ],
        rejected: [],
      };

      const secondArticle = {
        ...GNEWS_ARTICLE,
        title: "Second article",
        url: "https://reuters.com/second",
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(
          makeGNewsResponse([GNEWS_ARTICLE, secondArticle])
        )
        .mockResolvedValueOnce(makeLLMResponse(twoArticleClassification))
        // First topic scoring fails
        .mockRejectedValueOnce(new Error("LLM timeout"))
        // Second topic scoring succeeds
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      // Topic B succeeded despite Topic A failing
      expect(result.topicsProcessed).toBe(1);
      expect(result.scoresRecorded).toBe(1);
    });

    it("uses previous scores for anomaly detection on existing topics", async () => {
      const mock = createMockDb();
      mock.mockForDaily({
        existingTopics: [
          {
            id: 1,
            name: "Climate Crisis",
            currentScore: 50,
            healthScore: 40,
            ecoScore: 60,
            econScore: 30,
            keywords: "climate,warming",
          },
        ],
      });

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      expect(result.topicsProcessed).toBe(1);
    });

    it("uses onConflictDoUpdate when inserting score_history", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      // onConflictDoUpdate is called once for the topic upsert (existing).
      // It must also be called for the score_history insert (idempotency).
      // So the total must be >= 2: at least one topic upsert + one score_history.
      expect(mock.chain.onConflictDoUpdate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Ghost scoring prevention (lens: stateful) ──────────────────

  describe("ghost scoring prevention", () => {
    it("skips topic entirely when all fetched articles are duplicates", async () => {
      const mock = createMockDb();
      // The fetched URL already exists in the articles table
      mock.mockForDaily({
        existingArticleUrls: [GNEWS_ARTICLE.url],
      });

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE])) // GNews
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE)) // classify
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE)); // score (should NOT be called)

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      // Topic must be skipped — no scoring, no inserts, no score history
      expect(result.topicsProcessed).toBe(0);
      expect(result.articlesAdded).toBe(0);
      expect(result.scoresRecorded).toBe(0);
      // Verify no topic or article inserts were made
      expect(mock.insertedValues).toHaveLength(0);

      // Finding 2: Verify the scoring LLM call was NOT made.
      // fetch should be called exactly 2 times: GNews + classify. NOT 3 (no scoring).
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Finding 4: AC-1 requires console log with "skipped" and "duplicates"
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("skipped")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("duplicates")
      );
    });

    it("increments articleCount only by genuinely new articles when some are duplicates", async () => {
      const mock = createMockDb();
      const secondArticle = {
        ...GNEWS_ARTICLE,
        title: "Second article — new",
        url: "https://reuters.com/new-article",
      };
      // First URL already exists, second is new
      mock.mockForDaily({
        existingArticleUrls: [GNEWS_ARTICLE.url],
      });

      const twoArticleClassification = {
        classifications: [
          { articleIndex: 0, topicName: "Climate Crisis", isNew: true },
          { articleIndex: 1, topicName: "Climate Crisis", isNew: true },
        ],
        rejected: [],
        rejectionReasons: [],
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE, secondArticle]))
        .mockResolvedValueOnce(makeLLMResponse(twoArticleClassification))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      // The topic upsert's articleCount should use newArticles.length (1),
      // not topicArticles.length (2)
      const topicInsert = mock.insertedValues.find(
        (v) => v.name === "Climate Crisis"
      );
      expect(topicInsert).toBeDefined();
      expect(topicInsert.articleCount).toBe(1);

      // Finding 3: Verify the onConflictDoUpdate SET clause also uses
      // newArticles.length (1), not topicArticles.length (2).
      // The SET clause is passed as an argument to onConflictDoUpdate().
      // For the conflict path, the articleCount increment must reflect
      // only genuinely new articles.
      expect(mock.chain.onConflictDoUpdate).toHaveBeenCalled();
      const conflictCalls = mock.chain.onConflictDoUpdate.mock.calls;
      // Find the topic upsert's onConflictDoUpdate call (has set.articleCount)
      const topicConflictCall = conflictCalls.find(
        ([arg]: [any]) => arg?.set?.articleCount !== undefined
      );
      expect(topicConflictCall).toBeDefined();
      // The SQL template for articleCount should reference newArticles.length (1).
      // Drizzle's sql`` stores params in queryChunks. The numeric value (1 or 2)
      // appears as a raw element in the chunks array.
      const articleCountSql = topicConflictCall[0].set.articleCount;
      expect(articleCountSql).toBeDefined();
      // Extract numeric values from the SQL object's queryChunks
      const numericChunks = articleCountSql.queryChunks.filter(
        (chunk: any) => typeof chunk === "number"
      );
      // Must contain 1 (newArticles.length), must NOT contain 2 (topicArticles.length)
      expect(numericChunks).toContain(1);
      expect(numericChunks).not.toContain(2);
    });

    it("articlesAdded reflects actual DB inserts, not fetched count", async () => {
      const mock = createMockDb();
      const secondArticle = {
        ...GNEWS_ARTICLE,
        title: "Second article — new",
        url: "https://reuters.com/new-article",
      };
      // First URL already exists, second is new
      mock.mockForDaily({
        existingArticleUrls: [GNEWS_ARTICLE.url],
      });

      const twoArticleClassification = {
        classifications: [
          { articleIndex: 0, topicName: "Climate Crisis", isNew: true },
          { articleIndex: 1, topicName: "Climate Crisis", isNew: true },
        ],
        rejected: [],
        rejectionReasons: [],
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE, secondArticle]))
        .mockResolvedValueOnce(makeLLMResponse(twoArticleClassification))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      // 2 fetched, 1 is a dupe → only 1 actually inserted
      expect(result.articlesAdded).toBe(1);
    });
  });

  describe("backfill-full mode", () => {
    it("passes date range to fetchNews and skips RSS", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      const from = new Date("2026-01-01");
      const to = new Date("2026-02-01");

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      const result = await runBatchPipeline({
        mode: "backfill-full",
        db: mock.chain as any,
        from,
        to,
      });

      expect(result.topicsProcessed).toBe(1);
      expect(result.rssArticles).toBe(0); // RSS skipped in backfill-full

      // Verify GNews was called with date params
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const gnewsCall = fetchCalls.find(([url]: [string]) =>
        url.includes("gnews.io")
      );
      expect(gnewsCall).toBeDefined();
      expect(gnewsCall[0]).toContain("from=2026-01-01");
      expect(gnewsCall[0]).toContain("to=2026-02-01");
    });

    it("returns early when no articles in date range", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      global.fetch = jest.fn().mockResolvedValueOnce(makeGNewsResponse([]));

      const result = await runBatchPipeline({
        mode: "backfill-full",
        db: mock.chain as any,
        from: new Date("2025-01-01"),
        to: new Date("2025-01-02"),
      });

      expect(result.topicsProcessed).toBe(0);
    });
  });

  describe("backfill-rescore mode", () => {
    it("loads articles from DB and re-scores them", async () => {
      const mock = createMockDb();
      mock.mockForRescore([
        {
          title: "Existing article",
          url: "https://example.com/existing",
          source: "TestSource",
          summary: "An existing article summary.",
          imageUrl: null,
          publishedAt: new Date("2026-03-01"),
          topicId: 1,
        },
      ]);

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      const result = await runBatchPipeline({
        mode: "backfill-rescore",
        db: mock.chain as any,
      });

      expect(result.topicsProcessed).toBe(1);
      expect(result.gnewsArticles).toBe(0); // No fetching in rescore
      expect(result.rssArticles).toBe(0);

      // No external fetch calls for GNews/RSS
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const gnewsCalls = fetchCalls.filter(([url]: [string]) =>
        url.includes("gnews.io")
      );
      expect(gnewsCalls).toHaveLength(0);
    });

    it("returns early when DB has no articles", async () => {
      const mock = createMockDb();
      mock.mockForRescore([]);

      const result = await runBatchPipeline({
        mode: "backfill-rescore",
        db: mock.chain as any,
      });

      expect(result.topicsProcessed).toBe(0);
      expect(result.articlesAdded).toBe(0);
    });
  });

  describe("GDPR audit log purge", () => {
    it("purges audit logs older than 90 days", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      // Override delete to return purge count
      mock.chain.delete.mockImplementation(() => {
        const deleteChain = { ...mock.chain };
        deleteChain.where = jest.fn().mockResolvedValue({ rowCount: 42 });
        return deleteChain;
      });

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      expect(result.auditLogsPurged).toBe(42);
    });
  });

  describe("result shape", () => {
    it("returns all expected fields in BatchPipelineResult", async () => {
      const mock = createMockDb();
      mock.mockForDaily();

      global.fetch = jest.fn()
        .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
        .mockResolvedValueOnce(makeLLMResponse(CLASSIFICATION_RESPONSE))
        .mockResolvedValueOnce(makeLLMResponse(SCORING_RESPONSE));

      const result = await runBatchPipeline({
        mode: "daily",
        db: mock.chain as any,
      });

      expect(result).toEqual(
        expect.objectContaining({
          topicsProcessed: expect.any(Number),
          articlesAdded: expect.any(Number),
          scoresRecorded: expect.any(Number),
          totalTopics: expect.any(Number),
          totalArticles: expect.any(Number),
          gnewsArticles: expect.any(Number),
          rssArticles: expect.any(Number),
          auditLogsPurged: expect.any(Number),
        })
      );
    });
  });
});
