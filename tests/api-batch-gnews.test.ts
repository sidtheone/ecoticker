/**
 * Batch route tests — covers GNews handling and US-1.0 scoring alignment
 *
 * NOTE: This file name says "gnews" but has become the general batch route test suite.
 * Flag for rename to api-batch-route.test.ts in a follow-up cleanup story.
 *
 * Covers:
 * - GNews 401/429 error responses handled gracefully
 * - GNews `image` field mapped to `urlToImage` in NewsArticle interface
 * - US-1.0: callLLM temperature 0 + response_format json_object + few-shot examples
 * - US-1.0: clamping dimension scores to level ranges
 * - US-1.0: server-side overall score computation (not LLM-returned)
 * - US-1.0: server-side urgency derivation (not LLM-returned)
 * - US-1.0: anomaly detection when previous scores exist
 * - US-1.0: INSUFFICIENT_DATA excluded from weighted average
 * - US-1.0: scoreHistory insert includes reasoning + raw LLM response
 * - US-1.0: graceful fallback when LLM returns non-JSON
 */

// Set env vars BEFORE the module is imported so module-level constants are populated.
// BATCH_KEYWORDS is captured at module load time — use a single keyword to get exactly
// 1 GNews fetch call per batch run, simplifying mock ordering.
process.env.GNEWS_API_KEY = 'test-gnews-key';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.BATCH_KEYWORDS = 'amazon deforestation';

import { mockDb, mockDbInstance } from './helpers/mock-db';

jest.mock('@/db', () => {
  const { mockDbInstance } = jest.requireActual('./helpers/mock-db');
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

jest.mock('@/lib/audit-log', () => ({
  logSuccess: jest.fn().mockResolvedValue(undefined),
  logFailure: jest.fn().mockResolvedValue(undefined),
}));

// rss-parser mock must be set up BEFORE route.ts is imported.
// route.ts creates `const rssParser = new Parser(...)` at module level —
// mockImplementation must be set before that require() runs.
import Parser from 'rss-parser';
jest.mock('rss-parser');
const mockParseURL = jest.fn();
(Parser as unknown as jest.Mock).mockImplementation(() => ({
  parseURL: mockParseURL,
}));

import { POST } from '@/app/api/batch/route';
import { NextRequest } from 'next/server';

// Default RSS behavior: all feeds return empty articles.
// Individual tests override with mockResolvedValueOnce for RSS scenarios.
beforeEach(() => {
  mockParseURL.mockReset();
  mockParseURL.mockResolvedValue({ title: 'Default Feed', items: [] });
});

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const AMAZON_ARTICLE = {
  title: 'Amazon deforestation accelerating',
  url: 'https://reuters.com/env/amazon-1',
  source: { name: 'Reuters', url: 'https://reuters.com' },
  description: 'Deforestation in Amazon at record levels',
  image: 'https://cdn.reuters.com/amazon.jpg',
  publishedAt: '2026-02-21T10:00:00Z',
};

const AMAZON_CLASSIFICATION = [
  { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },
];

// Standard rubric-format scoring response (all dimensions valid, in-range)
const RUBRIC_SCORE = {
  healthReasoning: 'Amazon deforestation impacts respiratory health of local communities.',
  healthLevel: 'MODERATE',
  healthScore: 35,
  ecoReasoning: 'Widespread deforestation destroys critical Amazon biodiversity.',
  ecoLevel: 'SEVERE',
  ecoScore: 80,
  econReasoning: 'Loss of ecosystem services has significant economic consequences.',
  econLevel: 'MODERATE',
  econScore: 40,
  overallSummary: 'Amazon deforestation accelerating with severe ecological impact.',
  category: 'deforestation',
  region: 'South America',
  keywords: ['amazon', 'deforestation'],
};

// ─── Mock fetch builder helpers ───────────────────────────────────────────────

function makeGNewsResponse(articles: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ totalArticles: articles.length, articles }),
  };
}

function makeClassificationResponse(classifications: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            classifications,
            rejected: [],
            rejectionReasons: [],
          }),
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

// ─── GNews error handling ─────────────────────────────────────────────────────

describe('/api/batch — GNews error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.reset();
  });

  function makeRequest() {
    return new NextRequest('http://localhost:3000/api/batch', {
      method: 'POST',
      headers: { 'x-api-key': 'test-admin-key' },
    });
  }

  it('handles GNews auth failure (401) gracefully — returns success with 0 articles', async () => {
    // When GNews returns 401, fetchNews() logs the error and skips the query
    // All keyword groups fail → allArticles = [] → batch returns "No new articles found"
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ errors: ['The API token is invalid or has been deactivated.'] }),
    });

    const req = makeRequest();
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('No new articles found');
  });

  it('handles GNews rate limit (429) gracefully — returns success with 0 articles', async () => {
    // When GNews returns 429, fetchNews() logs the rate limit error and skips the query
    // All keyword groups fail → allArticles = [] → batch returns "No new articles found"
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ errors: ['Rate limit exceeded. Please wait before making another request.'] }),
    });

    const req = makeRequest();
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('No new articles found');
  });

  it('maps GNews image field to urlToImage in article insert', async () => {
    // BATCH_KEYWORDS is set to 'amazon deforestation' at module level (1 keyword → 1 GNews call)
    // Mock order: 1 GNews call + 1 classification LLM call + 1 scoring LLM call
    global.fetch = jest.fn()
      // GNews fetch — returns article with `image` field to test urlToImage mapping
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      // LLM classification — classify article into a topic
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      // LLM scoring — rubric-format response
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));

    // SELECT existing topics → empty; INSERT topic → returns topic ID
    mockDb.mockSelect([]);
    mockDb.mockInsert([{ id: 1 }]);

    // Spy on `values` to capture what's inserted for articles
    const valuesSpy = jest.spyOn(mockDb.chain, 'values');

    const req = makeRequest();
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Find the article insert call — identified by `sourceType: "gnews"` field
    // The DB schema uses `imageUrl` (not `urlToImage`) — the mapping is:
    //   GNews `image` → NewsArticle `urlToImage` → articles.imageUrl
    const allCallArgs = valuesSpy.mock.calls.map((c) => c[0]);
    const articleInsert = allCallArgs.find(
      (v) => v && typeof v === 'object' && 'sourceType' in v
    );

    expect(articleInsert).toBeDefined();
    // Verify GNews `image` field was mapped through urlToImage → imageUrl
    expect(articleInsert.imageUrl).toBe('https://cdn.reuters.com/amazon.jpg');
    expect(articleInsert.url).toBe('https://reuters.com/env/amazon-1');
    expect(articleInsert.sourceType).toBe('gnews');
  });
});

// ─── US-1.0 Scoring Pipeline ──────────────────────────────────────────────────

describe('/api/batch — US-1.0 scoring pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.reset();
  });

  function makeRequest() {
    return new NextRequest('http://localhost:3000/api/batch', {
      method: 'POST',
      headers: { 'x-api-key': 'test-admin-key' },
    });
  }

  /** Setup fetch mocks: 1 GNews call + 1 classification LLM + 1 scoring LLM */
  function setupFetch(scoringData: object) {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      .mockResolvedValueOnce(makeScoringResponse(scoringData));
  }

  /** Setup mock DB with no existing topics and a working insert */
  function setupDb(existingTopics: unknown[] = []) {
    mockDb.mockSelect(existingTopics);
    // Set up returning directly without overwriting `then` (mockInsert would overwrite)
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);
  }

  /** Find the scoreHistory insert call by checking for the `healthLevel` field */
  function findScoreHistoryInsert(valuesSpy: jest.SpyInstance) {
    return valuesSpy.mock.calls
      .map((c) => c[0])
      .find((v) => v && typeof v === 'object' && 'healthLevel' in v);
  }

  it('clamps dimension scores to their level ranges', async () => {
    // LLM returns healthScore: 90 but healthLevel: "MINIMAL" (MINIMAL range is 0-25)
    // Server must clamp 90 → 25
    setupFetch({
      healthReasoning: 'Minor local recycling effort.',
      healthLevel: 'MINIMAL',
      healthScore: 90, // OUT OF RANGE for MINIMAL — must clamp to 25
      ecoReasoning: 'Localized eco impact.',
      ecoLevel: 'MODERATE',
      ecoScore: 35,
      econReasoning: 'Small economic effect.',
      econLevel: 'MODERATE',
      econScore: 40,
      overallSummary: 'Minor environmental event.',
      category: 'climate',
      region: 'Global',
      keywords: ['amazon'],
    });
    setupDb();

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const warnSpy = jest.spyOn(console, 'warn');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    const sh = findScoreHistoryInsert(valuesSpy);
    expect(sh).toBeDefined();
    // Health score clamped from 90 to 25 (max of MINIMAL range)
    expect(sh.healthScore).toBe(25);
    expect(sh.healthLevel).toBe('MINIMAL');
    // Eco and econ scores unchanged (within range)
    expect(sh.ecoScore).toBe(35);
    expect(sh.econScore).toBe(40);

    // AC #10: batch-level clamping warning logged when >30% dimensions clamped
    // 1 topic × 3 dimensions = 3 total, 1 clamped = 33.3% > 30% threshold
    const clampingWarning = warnSpy.mock.calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('dimension scores were clamped')
    );
    expect(clampingWarning).toBeDefined();
    warnSpy.mockRestore();
  });

  it('computes overall score server-side using weighted average (not LLM-returned)', async () => {
    // healthScore: 35 (MODERATE), ecoScore: 80 (SEVERE), econScore: 40 (MODERATE)
    // Server-side: round(35×0.35 + 80×0.4 + 40×0.25) = round(12.25 + 32 + 10) = round(54.25) = 54
    // LLM does NOT return overall score in rubric format — server must compute it
    setupFetch(RUBRIC_SCORE);
    setupDb();

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    const sh = findScoreHistoryInsert(valuesSpy);
    expect(sh).toBeDefined();
    expect(sh.score).toBe(54); // server-side weighted average
  });

  it('derives urgency from overall score server-side (not LLM-returned)', async () => {
    // healthScore: 80 (SEVERE), ecoScore: 85 (SEVERE), econScore: 77 (SEVERE)
    // Overall = round(80×0.35 + 85×0.4 + 77×0.25) = round(28 + 34 + 19.25) = round(81.25) = 81
    // deriveUrgency(81) = "breaking" (≥ 80)
    setupFetch({
      healthReasoning: 'Mass casualties from toxic spill.',
      healthLevel: 'SEVERE',
      healthScore: 80,
      ecoReasoning: 'Ecosystem collapse across wide area.',
      ecoLevel: 'SEVERE',
      ecoScore: 85,
      econReasoning: 'Economy-wide disruption.',
      econLevel: 'SEVERE',
      econScore: 77,
      overallSummary: 'Catastrophic multi-dimensional environmental event.',
      category: 'pollution',
      region: 'Global',
      keywords: ['toxic', 'spill'],
    });
    setupDb();

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    // Find topic upsert — identified by `urgency` field (not `healthLevel`)
    const topicUpsert = valuesSpy.mock.calls
      .map((c) => c[0])
      .find((v) => v && typeof v === 'object' && 'urgency' in v && !('healthLevel' in v));
    expect(topicUpsert).toBeDefined();
    expect(topicUpsert.urgency).toBe('breaking');
  });

  it('detects anomaly when previous scores differ by more than 25 points', async () => {
    // Existing topic: healthScore=80, ecoScore=70, econScore=65
    // New LLM scores: health=5, eco=10, econ=8 (all MINIMAL)
    // Delta health: |5-80| = 75 > 25 → anomaly detected
    setupFetch({
      healthReasoning: 'Minor local environmental concern.',
      healthLevel: 'MINIMAL',
      healthScore: 5,
      ecoReasoning: 'Negligible ecosystem effect.',
      ecoLevel: 'MINIMAL',
      ecoScore: 10,
      econReasoning: 'Trivial economic impact.',
      econLevel: 'MINIMAL',
      econScore: 8,
      overallSummary: 'Minor environmental event.',
      category: 'climate',
      region: 'South America',
      keywords: ['amazon'],
    });
    // Existing topic with high previous scores — triggers anomaly detection
    setupDb([{
      id: 1,
      name: 'Amazon Deforestation',
      currentScore: 75,
      healthScore: 80,
      ecoScore: 70,
      econScore: 65,
      keywords: null,
    }]);

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    const sh = findScoreHistoryInsert(valuesSpy);
    expect(sh).toBeDefined();
    expect(sh.anomalyDetected).toBe(true);
  });

  it('excludes INSUFFICIENT_DATA dimension from weighted average', async () => {
    // econLevel: "INSUFFICIENT_DATA", econScore: -1 → excluded from average
    // Overall = (healthScore×0.35 + ecoScore×0.4) / (0.35 + 0.4)
    //         = (40×0.35 + 55×0.4) / 0.75
    //         = (14 + 22) / 0.75 = 36/0.75 = 48 (rounded)
    // Compare to all-included: (40×0.35 + 55×0.4 + 40×0.25) / 1.0 = 14+22+10 = 46
    // Proves econ was excluded: 48 ≠ 46
    setupFetch({
      healthReasoning: 'Moderate health impact observed.',
      healthLevel: 'MODERATE',
      healthScore: 40,
      ecoReasoning: 'Significant ecological damage.',
      ecoLevel: 'SIGNIFICANT',
      ecoScore: 55,
      econReasoning: 'Insufficient data to assess economic dimension.',
      econLevel: 'INSUFFICIENT_DATA',
      econScore: -1,
      overallSummary: 'Significant ecological event with unclear economic effects.',
      category: 'deforestation',
      region: 'South America',
      keywords: ['amazon'],
    });
    setupDb();

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    const sh = findScoreHistoryInsert(valuesSpy);
    expect(sh).toBeDefined();
    // 48 (econ excluded) not 46 (econ=40 included), proving renormalization
    expect(sh.score).toBe(48);
    expect(sh.econLevel).toBe('INSUFFICIENT_DATA');
    expect(sh.econScore).toBe(-1);
  });

  it('includes reasoning fields and raw LLM response in scoreHistory insert', async () => {
    setupFetch(RUBRIC_SCORE);
    setupDb();

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    const sh = findScoreHistoryInsert(valuesSpy);
    expect(sh).toBeDefined();
    // Reasoning fields
    expect(sh.healthReasoning).toBe(RUBRIC_SCORE.healthReasoning);
    expect(sh.ecoReasoning).toBe(RUBRIC_SCORE.ecoReasoning);
    expect(sh.econReasoning).toBe(RUBRIC_SCORE.econReasoning);
    // Level fields
    expect(sh.healthLevel).toBe('MODERATE');
    expect(sh.ecoLevel).toBe('SEVERE');
    expect(sh.econLevel).toBe('MODERATE');
    // Raw LLM response stored for audit trail
    expect(sh.rawLlmResponse).toBeDefined();
    expect(sh.rawLlmResponse).toBeTruthy();
  });

  it('uses temperature 0, response_format json_object, and includes few-shot examples in scoring prompt', async () => {
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    global.fetch = fetchSpy;
    setupDb();

    await POST(makeRequest());

    // Find all OpenRouter calls (classification + scoring)
    const openRouterCalls = fetchSpy.mock.calls.filter(
      ([url]: [string]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(openRouterCalls.length).toBeGreaterThanOrEqual(1);

    // All OpenRouter calls must use temperature 0
    for (const [, options] of openRouterCalls) {
      const body = JSON.parse(options.body);
      expect(body.temperature).toBe(0);
    }

    // Only the scoring call (last) should have response_format (AC #2: scoring calls only)
    const classificationCall = openRouterCalls[0];
    const classificationBody = JSON.parse(classificationCall[1].body);
    expect(classificationBody.response_format).toBeUndefined();

    const scoringCall = openRouterCalls[openRouterCalls.length - 1];
    const scoringBody = JSON.parse(scoringCall[1].body);
    expect(scoringBody.response_format).toEqual({ type: 'json_object' });
    const prompt = scoringBody.messages[0].content;
    // Few-shot examples are identified by the canonical EXAMPLE 1 marker
    expect(prompt).toContain('EXAMPLE 1');
    expect(prompt).toContain('Community Recycling Initiative Launch');
  });

  it('falls back to default score 50 gracefully when LLM returns non-JSON', async () => {
    // OpenRouter proxies to multiple models; not all honor `response_format`
    // When LLM returns plain text, extractJSON() returns null → fallback to defaults
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      // Scoring LLM returns plain text (not JSON)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'I cannot process this request in the required format.' } }],
        }),
      });
    setupDb();

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    const data = await res.json();

    // Batch must succeed (no crash) even with non-JSON LLM response
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.scoresRecorded).toBe(1);

    // Fallback score is 50 for all dimensions
    const sh = findScoreHistoryInsert(valuesSpy);
    expect(sh).toBeDefined();
    expect(sh.score).toBe(50);
    expect(sh.healthScore).toBe(50);
    expect(sh.ecoScore).toBe(50);
    expect(sh.econScore).toBe(50);
  });
});

// ─── RSS Integration (Story 4.2) ──────────────────────────────────────────────

describe('/api/batch — RSS integration (Story 4.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.reset();
    // Re-apply default RSS mock after clearAllMocks resets implementations
    mockParseURL.mockResolvedValue({ title: 'Default Feed', items: [] });
  });

  function makeRequest() {
    return new NextRequest('http://localhost:3000/api/batch', {
      method: 'POST',
      headers: { 'x-api-key': 'test-admin-key' },
    });
  }

  const RSS_ARTICLE_ITEM = {
    title: 'Guardian climate article',
    link: 'https://guardian.com/env/rss-1',
    isoDate: '2026-02-21T08:00:00Z',
    contentSnippet: 'Climate article from RSS feed.',
  };

  it('response includes gnewsArticles and rssArticles counts in stats (AC #9)', async () => {
    // GNews: 1 article; RSS: 1 article (different URL)
    // After merge: 2 unique articles → stats should report raw pre-dedup counts
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    // RSS returns 1 article on the first feed; remaining 9 are default (empty)
    mockParseURL.mockResolvedValueOnce({
      title: 'Guardian Environment',
      items: [RSS_ARTICLE_ITEM],
    });

    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // AC #9: raw counts before dedup
    expect(data.stats.gnewsArticles).toBe(1);
    expect(data.stats.rssArticles).toBe(1);
  });

  it('sets sourceType dynamically: "gnews" for GNews, "rss" for RSS articles', async () => {
    // GNews: 1 article; RSS: 1 article
    // After merge: [RSS_ARTICLE (idx 0), GNEWS_ARTICLE (idx 1)] — RSS first
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse([
        { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },  // RSS article
        { articleIndex: 1, topicName: 'Amazon Deforestation', isNew: false }, // GNews article
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    mockParseURL.mockResolvedValueOnce({
      title: 'Guardian Environment',
      items: [RSS_ARTICLE_ITEM],
    });

    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);

    expect(articleInserts).toHaveLength(2);
    const gnewsInsert = articleInserts.find((a) => a.url === AMAZON_ARTICLE.url);
    const rssInsert = articleInserts.find((a) => a.url === RSS_ARTICLE_ITEM.link);
    expect(gnewsInsert?.sourceType).toBe('gnews');
    expect(rssInsert?.sourceType).toBe('rss');
  });

  it('cross-source URL dedup: RSS wins when same URL appears in GNews and RSS', async () => {
    const SHARED_URL = 'https://reuters.com/env/shared-article';
    const gnewsArticleShared = { ...AMAZON_ARTICLE, url: SHARED_URL };
    const rssItemShared = {
      title: 'Shared article',
      link: SHARED_URL,
      isoDate: '2026-02-21T08:00:00Z',
      contentSnippet: 'This article appears in both GNews and RSS.',
    };

    // GNews returns shared URL; RSS also returns shared URL
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([gnewsArticleShared]))
      .mockResolvedValueOnce(makeClassificationResponse([
        // After merge [RSS (idx 0), GNews (idx 1)], dedup removes GNews.
        // Only RSS article at idx 0 survives
        { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    mockParseURL.mockResolvedValueOnce({
      title: 'Guardian Environment',
      items: [rssItemShared],
    });

    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    expect((await res.json()).success).toBe(true);

    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);

    // Only ONE article insert — deduped
    expect(articleInserts).toHaveLength(1);
    // RSS wins: sourceType must be "rss"
    expect(articleInserts[0].sourceType).toBe('rss');
    expect(articleInserts[0].url).toBe(SHARED_URL);
  });

  it('handles RSS rejected promise (crash) — GNews articles still proceed', async () => {
    // Rare path: fetchRssFeeds() throws internally (rss-parser module crash)
    // Promise.allSettled captures this as a rejected result; GNews articles proceed
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    // Make rss-parser reject — simulates module-level crash
    mockParseURL.mockRejectedValue(new Error('rss-parser module crash'));

    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const valuesSpy = jest.spyOn(mockDb.chain, 'values');
    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // GNews article still processed
    expect(data.stats.gnewsArticles).toBe(1);

    // GNews article inserted with correct sourceType
    const articleInserts = valuesSpy.mock.calls
      .map((c) => c[0])
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object' && 'sourceType' in v);
    expect(articleInserts).toHaveLength(1);
    expect(articleInserts[0].sourceType).toBe('gnews');

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('logs source health warning when GNews returns 0 and RSS is healthy', async () => {
    // GNews: 401 → [] ; RSS: 1 article → pipeline continues (AC #10)
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ errors: ['The API token is invalid.'] }),
      })
      .mockResolvedValueOnce(makeClassificationResponse([
        { articleIndex: 0, topicName: 'Climate News', isNew: true },
      ]))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    mockParseURL.mockResolvedValueOnce({
      title: 'Guardian Environment',
      items: [RSS_ARTICLE_ITEM],
    });

    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    // Assert BEFORE restore — mockRestore() calls mockReset() which clears mock.calls
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GNews returned 0 articles')
    );
    warnSpy.mockRestore();
  });

  it('logs source health warning when RSS returns 0 and GNews is healthy', async () => {
    // RSS: all empty; GNews: 1 article → warning logged (AC #10)
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    // mockParseURL already set to return empty by beforeEach

    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await POST(makeRequest());

    // Assert BEFORE restore — mockRestore() calls mockReset() which clears mock.calls
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('RSS returned 0 articles')
    );
    warnSpy.mockRestore();
  });
});

// ─── Story 4.6: Classification Pipeline Alignment ──────────────────────────────

describe('/api/batch — classification pipeline alignment (Story 4.6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.reset();
    mockParseURL.mockResolvedValue({ title: 'Default Feed', items: [] });
  });

  function makeRequest() {
    return new NextRequest('http://localhost:3000/api/batch', {
      method: 'POST',
      headers: { 'x-api-key': 'test-admin-key' },
    });
  }

  it('classification prompt includes newsworthiness test, Q&A rejection, and rejection fields', async () => {
    const fetchSpy = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce(makeClassificationResponse(AMAZON_CLASSIFICATION))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    global.fetch = fetchSpy;
    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    await POST(makeRequest());

    // Find the classification LLM call (first OpenRouter call)
    const openRouterCalls = fetchSpy.mock.calls.filter(
      ([url]: [string]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(openRouterCalls.length).toBeGreaterThanOrEqual(1);

    const classificationBody = JSON.parse(openRouterCalls[0][1].body);
    const prompt = classificationBody.messages[0].content;

    // AC #1: Newsworthiness test present
    expect(prompt).toContain('NEWSWORTHINESS TEST');
    // AC #2: Q&A and listicle rejection
    expect(prompt).toContain('Q&A');
    expect(prompt).toContain('Listicles');
    expect(prompt).toContain('question');
    // AC #3: Rejection fields in JSON schema
    expect(prompt).toContain('"rejected"');
    expect(prompt).toContain('"rejectionReasons"');
  });

  it('logs rejected articles with titles and reasons', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([
        AMAZON_ARTICLE,
        { ...AMAZON_ARTICLE, title: 'What is deforestation?', url: 'https://example.com/qa-1' },
        { ...AMAZON_ARTICLE, title: 'Amazon fires worsen', url: 'https://example.com/fires-1' },
      ]))
      // Classification returns 1 rejected article
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                classifications: [
                  { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },
                  { articleIndex: 2, topicName: 'Amazon Fires', isNew: true },
                ],
                rejected: [1],
                rejectionReasons: ['Q&A content'],
              }),
            },
          }],
        }),
      })
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await POST(makeRequest());

    const logCalls = logSpy.mock.calls.map((c) => c.join(' '));
    // AC #4: rejected article logged with title and reason
    expect(logCalls.some((c) => c.includes('❌') && c.includes('Q&A content'))).toBe(true);
    expect(logCalls.some((c) => c.includes('Filtered 1 irrelevant'))).toBe(true);
    // AC #5: relevance rate logged
    expect(logCalls.some((c) => c.includes('Relevance rate:') && c.includes('66.7%'))).toBe(true);
    logSpy.mockRestore();
  });

  it('handles missing rejected array gracefully (no crash, no rejection logging)', async () => {
    // LLM returns old response shape without rejected/rejectionReasons
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([AMAZON_ARTICLE]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                classifications: AMAZON_CLASSIFICATION,
                // No rejected or rejectionReasons fields
              }),
            },
          }],
        }),
      })
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const logCalls = logSpy.mock.calls.map((c) => c.join(' '));
    // No rejection logging should appear
    expect(logCalls.some((c) => c.includes('❌'))).toBe(false);
    expect(logCalls.some((c) => c.includes('Filtered'))).toBe(false);
    logSpy.mockRestore();
  });

  it('logs correct relevance rate calculation', async () => {
    // 3 articles, 1 rejected → 66.7%
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeGNewsResponse([
        AMAZON_ARTICLE,
        { ...AMAZON_ARTICLE, title: 'Pet care tips', url: 'https://example.com/pet-1' },
        { ...AMAZON_ARTICLE, title: 'Amazon fires continue', url: 'https://example.com/fires-2' },
      ]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                classifications: [
                  { articleIndex: 0, topicName: 'Amazon Deforestation', isNew: true },
                  { articleIndex: 2, topicName: 'Amazon Fires', isNew: true },
                ],
                rejected: [1],
                rejectionReasons: ['Pet care'],
              }),
            },
          }],
        }),
      })
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE))
      .mockResolvedValueOnce(makeScoringResponse(RUBRIC_SCORE));
    mockDb.mockSelect([]);
    mockDb.chain.returning.mockResolvedValue([{ id: 1 }]);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await POST(makeRequest());

    const logCalls = logSpy.mock.calls.map((c) => c.join(' '));
    // 2/3 articles passed = 66.7%
    expect(logCalls.some((c) => c.includes('66.7%') && c.includes('2/3'))).toBe(true);
    logSpy.mockRestore();
  });
});
