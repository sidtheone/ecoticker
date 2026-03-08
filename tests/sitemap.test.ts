/**
 * Tests for src/app/sitemap.ts — generates dynamic sitemap from DB
 *
 * Covers:
 * - Always includes static routes (/, /scoring, /data-policy) even when DB is empty
 * - Includes topic URLs from DB for non-hidden topics
 * - Does NOT include hidden topics (hidden=false filter in query)
 * - Handles DB failure gracefully (returns static routes only)
 * - Each topic URL uses correct format: https://ecoticker.sidsinsights.com/topic/{slug}
 * - Priority values: homepage 1.0, topics 0.8, scoring 0.5, data-policy 0.3
 */

import { mockDb, mockDbInstance } from './helpers/mock-db';

jest.mock('@/db', () => {
  const { mockDbInstance } = jest.requireActual('./helpers/mock-db');
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

import sitemap from '@/app/sitemap';

const BASE = 'https://ecoticker.sidsinsights.com';

describe('sitemap.ts', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  // ─── Static routes ──────────────────────────────────────────────────────────

  it('always includes static routes even when DB returns empty', async () => {
    mockDb.mockSelect([]);

    const result = await sitemap();

    const urls = result.map((entry) => entry.url);
    expect(urls).toContain(BASE);
    expect(urls).toContain(`${BASE}/scoring`);
    expect(urls).toContain(`${BASE}/data-policy`);
  });

  it('returns at least 3 entries (static routes) when DB is empty', async () => {
    mockDb.mockSelect([]);

    const result = await sitemap();

    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  // ─── Priority values ───────────────────────────────────────────────────────

  it('sets homepage priority to 1.0', async () => {
    mockDb.mockSelect([]);

    const result = await sitemap();
    const homepage = result.find((entry) => entry.url === BASE);

    expect(homepage).toBeDefined();
    expect(homepage!.priority).toBe(1.0);
  });

  it('sets scoring page priority to 0.5', async () => {
    mockDb.mockSelect([]);

    const result = await sitemap();
    const scoring = result.find((entry) => entry.url === `${BASE}/scoring`);

    expect(scoring).toBeDefined();
    expect(scoring!.priority).toBe(0.5);
  });

  it('sets data-policy page priority to 0.3', async () => {
    mockDb.mockSelect([]);

    const result = await sitemap();
    const dataPolicy = result.find((entry) => entry.url === `${BASE}/data-policy`);

    expect(dataPolicy).toBeDefined();
    expect(dataPolicy!.priority).toBe(0.3);
  });

  // ─── Topic URLs from DB ─────────────────────────────────────────────────────

  it('includes topic URLs from DB with correct format', async () => {
    const mockTopics = [
      { slug: 'amazon-deforestation', updatedAt: new Date('2026-03-01') },
      { slug: 'arctic-ice-melt', updatedAt: new Date('2026-03-02') },
    ];
    mockDb.mockSelect(mockTopics);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain(`${BASE}/topic/amazon-deforestation`);
    expect(urls).toContain(`${BASE}/topic/arctic-ice-melt`);
  });

  it('sets topic priority to 0.8', async () => {
    mockDb.mockSelect([
      { slug: 'ocean-acidification', updatedAt: new Date('2026-03-01') },
    ]);

    const result = await sitemap();
    const topicEntry = result.find(
      (entry) => entry.url === `${BASE}/topic/ocean-acidification`
    );

    expect(topicEntry).toBeDefined();
    expect(topicEntry!.priority).toBe(0.8);
  });

  it('sets topic changeFrequency to daily', async () => {
    mockDb.mockSelect([
      { slug: 'coral-bleaching', updatedAt: new Date('2026-03-01') },
    ]);

    const result = await sitemap();
    const topicEntry = result.find(
      (entry) => entry.url === `${BASE}/topic/coral-bleaching`
    );

    expect(topicEntry).toBeDefined();
    expect(topicEntry!.changeFrequency).toBe('daily');
  });

  it('uses updatedAt from DB as lastModified for topics', async () => {
    const updatedAt = new Date('2026-03-05T12:00:00Z');
    mockDb.mockSelect([{ slug: 'wildfire-season', updatedAt }]);

    const result = await sitemap();
    const topicEntry = result.find(
      (entry) => entry.url === `${BASE}/topic/wildfire-season`
    );

    expect(topicEntry).toBeDefined();
    expect(topicEntry!.lastModified).toEqual(updatedAt);
  });

  it('falls back to current date when updatedAt is null', async () => {
    const before = new Date();
    mockDb.mockSelect([{ slug: 'no-update-date', updatedAt: null }]);

    const result = await sitemap();
    const topicEntry = result.find(
      (entry) => entry.url === `${BASE}/topic/no-update-date`
    );
    const after = new Date();

    expect(topicEntry).toBeDefined();
    const lastMod = topicEntry!.lastModified as Date;
    expect(lastMod.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(lastMod.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  // ─── Hidden topics exclusion ────────────────────────────────────────────────

  it('does NOT include hidden topics (query filters hidden=false)', async () => {
    // The sitemap.ts uses .where(eq(topics.hidden, false)) so only non-hidden
    // topics are returned from DB. We verify by checking that the mock DB's
    // where method was called (the filtering happens at query level).
    mockDb.mockSelect([
      { slug: 'visible-topic', updatedAt: new Date() },
    ]);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    // Only the visible topic should appear (hidden ones are filtered by DB query)
    expect(urls).toContain(`${BASE}/topic/visible-topic`);
    // Verify .where() was called on the chain (filter was applied)
    expect(mockDb.chain.where).toHaveBeenCalled();
  });

  // ─── DB failure graceful fallback ───────────────────────────────────────────

  it('handles DB failure gracefully — returns static routes only', async () => {
    // Simulate DB crash by making the chain reject when awaited
    mockDb.chain.select.mockReturnValue(mockDb.chain);
    mockDb.chain.from.mockReturnValue(mockDb.chain);
    mockDb.chain.where.mockImplementation(() => {
      throw new Error('DB connection refused');
    });

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    // Static routes still present
    expect(urls).toContain(BASE);
    expect(urls).toContain(`${BASE}/scoring`);
    expect(urls).toContain(`${BASE}/data-policy`);

    // No topic URLs (DB failed)
    expect(result.length).toBe(3);
  });

  it('returns exactly static routes when DB throws — no topic URLs leak', async () => {
    // Alternative failure mode: the chain resolves but then rejects
    (mockDb.chain as any).then = function (_resolve: any, reject: any) {
      return Promise.reject(new Error('connection timeout')).catch(reject);
    };
    mockDb.chain.select.mockReturnValue(mockDb.chain);
    mockDb.chain.from.mockReturnValue(mockDb.chain);
    mockDb.chain.where.mockReturnValue(mockDb.chain);

    const result = await sitemap();

    expect(result.length).toBe(3);
    const topicUrls = result.filter((entry) => entry.url.includes('/topic/'));
    expect(topicUrls).toHaveLength(0);
  });

  // ─── Combined: static + dynamic ────────────────────────────────────────────

  it('returns static routes + topic URLs in correct order (static first)', async () => {
    mockDb.mockSelect([
      { slug: 'topic-a', updatedAt: new Date() },
      { slug: 'topic-b', updatedAt: new Date() },
    ]);

    const result = await sitemap();

    // Static routes come first (indices 0, 1, 2)
    expect(result[0].url).toBe(BASE);
    expect(result[1].url).toBe(`${BASE}/scoring`);
    expect(result[2].url).toBe(`${BASE}/data-policy`);

    // Topic URLs follow
    expect(result[3].url).toBe(`${BASE}/topic/topic-a`);
    expect(result[4].url).toBe(`${BASE}/topic/topic-b`);

    // Total count
    expect(result).toHaveLength(5);
  });
});
