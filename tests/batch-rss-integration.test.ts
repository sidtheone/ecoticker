/**
 * Integration tests: scripts/batch.ts RSS integration (Story 4.2)
 *
 * Tests the parallel GNews + RSS fetch pipeline.
 * Covers AC #11 scenarios: both succeed, each-fails-other-succeeds,
 * both fail (graceful exit), sourceType attribution, cross-source URL dedup.
 *
 * DB mock strategy: scripts/batch.ts creates its own standalone Drizzle connection
 * (NOT via @/db). Mock drizzle-orm/node-postgres + pg at jest module level.
 */

// Set env vars BEFORE any module load — module-level constants capture these at import time.
// BATCH_KEYWORDS = 1 keyword → 1 GNews API call per run, simplifying mock ordering.
process.env.GNEWS_API_KEY = 'test-gnews-key';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.BATCH_KEYWORDS = 'amazon deforestation';
process.env.DATABASE_URL = 'postgresql://localhost/test';

import Parser from 'rss-parser';

// Hoist mocks above imports
jest.mock('rss-parser');
jest.mock('dotenv/config', () => ({})); // Prevent .env loading in tests
jest.mock('drizzle-orm/node-postgres', () => {
  const { mockDbInstance } = jest.requireActual('./helpers/mock-db');
  return { drizzle: jest.fn(() => mockDbInstance) };
});
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({ end: jest.fn() })),
}));

// Set up rss-parser mock implementation BEFORE scripts/batch is imported.
// scripts/rss.ts creates `const parser = new Parser(...)` at module level —
// the mockImplementation must be set before that require() runs.
const mockParseURL = jest.fn();
(Parser as unknown as jest.Mock).mockImplementation(() => ({
  parseURL: mockParseURL,
}));

import { main } from '../scripts/batch';
import { mockDb } from './helpers/mock-db';

// ─── Shared Fixtures ─────────────────────────────────────────────────────────

const GNEWS_ARTICLE = {
  title: 'Amazon deforestation accelerating',
  url: 'https://reuters.com/env/amazon-gnews',
  source: { name: 'Reuters', url: 'https://reuters.com' },
  description: 'Deforestation in Amazon at record levels',
  image: 'https://cdn.reuters.com/amazon.jpg',
  publishedAt: '2026-02-21T10:00:00Z',
};

const RSS_ARTICLE_ITEM = {
  title: 'Climate crisis deepens in 2026',
  link: 'https://guardian.com/env/rss-article-1',
  isoDate: '2026-02-21T08:00:00Z',
  contentSnippet: 'Rising temperatures are accelerating climate impacts worldwide.',
};

const RUBRIC_SCORE = {
  healthReasoning: 'Amazon deforestation impacts respiratory health.',
  healthLevel: 'MODERATE',
  healthScore: 35,
  ecoReasoning: 'Widespread deforestation destroys critical biodiversity.',
  ecoLevel: 'SEVERE',
  ecoScore: 80,
  econReasoning: 'Loss of ecosystem services has economic consequences.',
  econLevel: 'MODERATE',
  econScore: 40,
  overallSummary: 'Amazon deforestation accelerating with severe ecological impact.',
  category: 'deforestation',
  region: 'South America',
  keywords: ['amazon', 'deforestation'],
};

// ─── Mock Builder Helpers ─────────────────────────────────────────────────────

function makeGNewsResponse(articles: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ totalArticles: articles.length, articles }),
  };
}

function makeGNews401Response() {
  return {
    ok: false,
    status: 401,
    json: async () => ({ errors: ['The API token is invalid or has been deactivated.'] }),
  };
}

function makeClassificationResponse(classifications: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({ classifications, rejected: [], rejectionReasons: [] }),
        },
      }],
    }),
  };
}

function makeScoringResponse(scoreData: object) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(scoreData) } }],
    }),
  };
}

/** RSS mock: first feed returns items, remaining 9 feeds are empty */
function setupRssWithArticles(items: object[]) {
  mockParseURL.mockResolvedValueOnce({ title: 'Guardian Environment', items });
  for (let i = 1; i < 10; i++) {
    mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });
  }
}

/** RSS mock: all 10 feeds return empty (simulates zero RSS articles) */
function setupRssEmpty() {
  for (let i = 0; i < 10; i++) {
    mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });
  }
}

/**
 * Set up DB mock for scripts/batch.ts.
 * MUST be called first — mockDb.reset() calls jest.clearAllMocks() which
 * would wipe any global.fetch or RSS mocks set before it.
 */
function setupDb(existingTopics: unknown[] = []) {
  mockDb.reset();
  mockDb.mockSelect(existingTopics);
  // Topic ID SELECT uses .limit(1) — override to return a topic ID
  mockDb.chain.limit.mockResolvedValue([{ id: 1 }]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('scripts/batch.ts — RSS integration', () => {
  beforeEach(() => {
    // Restore rss-parser mock implementation (clearAllMocks resets it)
    (Parser as unknown as jest.Mock).mockImplementation(() => ({
      parseURL: mockParseURL,
    }));
  });

  it('merges articles from both GNews and RSS into a single article pool', async () => {
    // GNews: 1 article; RSS: 1 different article
    // After merge: [RSS_ARTICLE (idx 0), GNEWS_ARTICLE (idx 1)] — RSS goes first
    setupDb();
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse([
        { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },  // RSS article
        { articleIndex: 1, topicName: 'Amazon Deforestation', isNew: false }, // GNews article
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    setupRssWithArticles([RSS_ARTICLE_ITEM]);

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    await main();

    // Both articles inserted with correct sourceTypes
    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);

    expect(articleInserts).toHaveLength(2);
    const gnewsInsert = articleInserts.find((a) => a.url === GNEWS_ARTICLE.url);
    const rssInsert = articleInserts.find((a) => a.url === RSS_ARTICLE_ITEM.link);
    expect(gnewsInsert?.sourceType).toBe('gnews');
    expect(rssInsert?.sourceType).toBe('rss');
  });

  it('RSS articles proceed to scoring when GNews returns 0 articles (AC #3)', async () => {
    // GNews 401 → fetchNews() returns [] (error caught internally)
    // RSS: 1 article → pipeline continues with RSS-only pool
    setupDb();
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNews401Response())
      .mockResolvedValueOnce(makeClassificationResponse([
        { articleIndex: 0, topicName: 'Climate News', isNew: true },
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    setupRssWithArticles([RSS_ARTICLE_ITEM]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    await main();

    // AC #10: source health warning when GNews is empty but RSS is healthy
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GNews returned 0 articles')
    );

    // RSS article inserted with sourceType "rss"
    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);
    expect(articleInserts).toHaveLength(1);
    expect(articleInserts[0].sourceType).toBe('rss');
    expect(articleInserts[0].url).toBe(RSS_ARTICLE_ITEM.link);

    warnSpy.mockRestore();
  });

  it('GNews articles proceed to scoring when RSS returns 0 articles (AC #4)', async () => {
    // GNews: 1 article; RSS: all feeds empty
    setupDb();
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse([
        { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    setupRssEmpty();

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    await main();

    // AC #10: source health warning when RSS is empty but GNews is healthy
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('RSS returned 0 articles')
    );

    // GNews article inserted with sourceType "gnews"
    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);
    expect(articleInserts).toHaveLength(1);
    expect(articleInserts[0].sourceType).toBe('gnews');
    expect(articleInserts[0].url).toBe(GNEWS_ARTICLE.url);

    warnSpy.mockRestore();
  });

  it('exits gracefully when both sources produce 0 articles — no scoring runs (AC #5)', async () => {
    // GNews: 401 → []; RSS: all empty → []
    // Combined articles = 0 → pipeline exits before LLM calls
    setupDb();
    global.fetch = jest.fn().mockResolvedValue(makeGNews401Response());
    setupRssEmpty();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await expect(main()).resolves.toBeUndefined();

    // No classification or scoring calls — only the GNews API call was made
    // Assert BEFORE restore (retro lesson: mockRestore clears mock.calls)
    const openRouterCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]: [string]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(openRouterCalls).toHaveLength(0);
    logSpy.mockRestore();
  });

  it('handles RSS rejected promise (crash) — GNews articles still proceed (AC #3)', async () => {
    // Rare path: fetchRssFeeds() throws (e.g., rss-parser import failure)
    // Promise.allSettled captures this as a rejected result
    setupDb();
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([GNEWS_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse([
        { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    // Make ALL rss-parser parseURL calls reject (simulates module-level crash)
    mockParseURL.mockRejectedValue(new Error('rss-parser module crash'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    await main();

    // GNews article still inserted despite RSS crash
    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);
    expect(articleInserts).toHaveLength(1);
    expect(articleInserts[0].sourceType).toBe('gnews');

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('cross-source URL dedup: RSS wins attribution when same URL appears in both (AC #11)', async () => {
    const SHARED_URL = 'https://reuters.com/env/shared-article';
    const gnewsArticleShared = { ...GNEWS_ARTICLE, url: SHARED_URL };
    const rssItemShared = {
      title: 'Shared article from both sources',
      link: SHARED_URL,
      isoDate: '2026-02-21T08:00:00Z',
      contentSnippet: 'This article appears in both GNews and RSS.',
    };

    setupDb();
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([gnewsArticleShared]))
      .mockResolvedValueOnce(makeClassificationResponse([
        { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    // RSS also returns the same URL
    setupRssWithArticles([rssItemShared]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    await main();
    warnSpy.mockRestore();

    // Dedup: only ONE article inserted for SHARED_URL
    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);
    expect(articleInserts).toHaveLength(1);
    // RSS wins dedup (RSS-first merge order → first-write-wins sourceMap)
    expect(articleInserts[0].sourceType).toBe('rss');
    expect(articleInserts[0].url).toBe(SHARED_URL);
  });
});
