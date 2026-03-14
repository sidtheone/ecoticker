/**
 * Tests for fixArticleCounts() — one-time correction script.
 *
 * Contracts:
 * 1. No mismatches → { topicsFixed: 0, mismatches: [] }, no update called
 * 2. Inflated counts (stored > actual) → detected and fixed
 * 3. Deflated counts (stored < actual) → detected and fixed
 * 4. Zero-article orphan topics (stored > 0, 0 actual articles) → detected and fixed
 * 5. Dry-run → reports mismatches without calling update
 * 6. Live mode → calls update for each mismatch, with correct arguments
 */

import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("../src/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

import {
  fixArticleCounts,
  type FixArticleCountsResult,
} from "../scripts/fix-article-counts";
import { db } from "../src/db";
import { articles as articlesTable, topics as topicsTable } from "../src/db/schema";

/**
 * Configures the mock for fixArticleCounts' two sequential SELECTs:
 *   1. SELECT topic_id, COUNT(*) FROM articles GROUP BY topic_id → articleCounts
 *   2. SELECT id, name, article_count FROM topics → topicRows
 *
 * Uses table discrimination (from(articlesTable) vs from(topicsTable))
 * to return different data for each query, matching the pattern from
 * run-batch-pipeline.test.ts's mockForDaily.
 */
function mockTwoSelects(
  articleCounts: { topicId: number; actualCount: number }[],
  topicRows: { id: number; name: string; articleCount: number }[]
) {
  mockDb.chain.select.mockImplementation(() => {
    const selectChain: any = { ...mockDb.chain };

    selectChain.from = jest.fn().mockImplementation((tableRef: any) => {
      if (tableRef === articlesTable) {
        // Query 1: SELECT topic_id, COUNT(*) FROM articles GROUP BY topic_id
        selectChain.groupBy = jest.fn().mockReturnValue(selectChain);
        selectChain.where = jest.fn().mockReturnValue(selectChain);
        selectChain.then = (resolve: any) => {
          return Promise.resolve(articleCounts).then(resolve);
        };
        return selectChain;
      }

      if (tableRef === topicsTable) {
        // Query 2: SELECT id, name, article_count FROM topics
        selectChain.where = jest.fn().mockReturnValue(selectChain);
        selectChain.then = (resolve: any) => {
          return Promise.resolve(topicRows).then(resolve);
        };
        return selectChain;
      }

      // Fallback — should not be reached
      selectChain.then = (resolve: any) => Promise.resolve([]).then(resolve);
      return selectChain;
    });

    selectChain.groupBy = jest.fn().mockReturnValue(selectChain);
    selectChain.where = jest.fn().mockReturnValue(selectChain);
    return selectChain;
  });
}

describe("fixArticleCounts", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  // ── Contract 1: No mismatches ─────────────────────────────────

  it("returns zero fixes when all counts match", async () => {
    mockTwoSelects(
      // Query 1: actual article counts per topic
      [
        { topicId: 1, actualCount: 3 },
        { topicId: 2, actualCount: 5 },
      ],
      // Query 2: stored topic rows
      [
        { id: 1, name: "Climate Crisis", articleCount: 3 },
        { id: 2, name: "Deforestation", articleCount: 5 },
      ]
    );

    const result = await fixArticleCounts(db, false);

    expect(result).toEqual({ topicsFixed: 0, mismatches: [] });
    expect(mockDb.chain.update).not.toHaveBeenCalled();
  });

  // ── Contract 2: Inflated counts (stored > actual) ─────────────

  it("detects and fixes inflated article counts (stored > actual)", async () => {
    mockTwoSelects(
      [
        { topicId: 1, actualCount: 3 },
        { topicId: 2, actualCount: 5 },
      ],
      [
        { id: 1, name: "Climate Crisis", articleCount: 10 },
        { id: 2, name: "Deforestation", articleCount: 5 },
      ]
    );
    mockDb.mockUpdate(undefined);

    const result = await fixArticleCounts(db, false);

    expect(result.topicsFixed).toBe(1);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toEqual({
      topicId: 1,
      topicName: "Climate Crisis",
      storedCount: 10,
      actualCount: 3,
    });
  });

  // ── Contract 3: Deflated counts (stored < actual) ─────────────

  it("detects and fixes deflated article counts (stored < actual)", async () => {
    mockTwoSelects(
      [{ topicId: 1, actualCount: 7 }],
      [{ id: 1, name: "Ocean Acidification", articleCount: 2 }]
    );
    mockDb.mockUpdate(undefined);

    const result = await fixArticleCounts(db, false);

    expect(result.topicsFixed).toBe(1);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toEqual({
      topicId: 1,
      topicName: "Ocean Acidification",
      storedCount: 2,
      actualCount: 7,
    });
  });

  // ── Contract 4: Zero-article orphan topics ────────────────────

  it("detects zero-article orphan topics (stored > 0, 0 actual articles)", async () => {
    // Topic 1 has 0 actual articles (not in articleCounts result at all)
    mockTwoSelects(
      [], // No articles in DB for any topic
      [{ id: 1, name: "Ghost Topic", articleCount: 8 }]
    );
    mockDb.mockUpdate(undefined);

    const result = await fixArticleCounts(db, false);

    expect(result.topicsFixed).toBe(1);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toEqual({
      topicId: 1,
      topicName: "Ghost Topic",
      storedCount: 8,
      actualCount: 0,
    });
  });

  // ── Contract 5: Dry-run does NOT update ───────────────────────

  it("dry-run reports mismatches without calling update", async () => {
    mockTwoSelects(
      [{ topicId: 1, actualCount: 3 }],
      [{ id: 1, name: "Climate Crisis", articleCount: 10 }]
    );

    const result = await fixArticleCounts(db, true);

    expect(mockDb.chain.update).not.toHaveBeenCalled();
    // Still reports the mismatch
    expect(result.topicsFixed).toBe(1);
    expect(result.mismatches).toHaveLength(1);
  });

  // ── Contract 6: Live mode calls update with correct arguments ─

  it("live mode calls update for each mismatch with correct values", async () => {
    mockTwoSelects(
      [
        { topicId: 1, actualCount: 3 },
        { topicId: 2, actualCount: 5 },
        // Topic 3 has no articles → absent from GROUP BY result
      ],
      [
        { id: 1, name: "Climate Crisis", articleCount: 10 },
        { id: 2, name: "Deforestation", articleCount: 5 },
        { id: 3, name: "Ghost Topic", articleCount: 8 },
      ]
    );
    mockDb.mockUpdate(undefined);

    await fixArticleCounts(db, false);

    // 2 mismatches (topics 1 and 3), topic 2 matches → 2 update calls
    expect(mockDb.chain.update).toHaveBeenCalledTimes(2);

    // Finding 5: Verify update was called with correct articleCount values.
    // The set() calls should include the actual count for each mismatched topic.
    expect(mockDb.chain.set).toHaveBeenCalledTimes(2);
    const setCalls = mockDb.chain.set.mock.calls;
    const setArgs = setCalls.map(([arg]: [any]) => arg);
    // One call should set articleCount to 3 (topic 1: stored 10, actual 3)
    expect(setArgs).toContainEqual(
      expect.objectContaining({ articleCount: 3 })
    );
    // One call should set articleCount to 0 (topic 3: stored 8, actual 0)
    expect(setArgs).toContainEqual(
      expect.objectContaining({ articleCount: 0 })
    );
  });
});
