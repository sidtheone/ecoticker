/**
 * Tests for dedupScoreHistory() — one-time dedup script.
 *
 * Contracts:
 * 1. No duplicates → { topicsAffected: 0, rowsDeleted: 0 }, no delete called
 * 2. Duplicates → correct topicsAffected count
 * 3. Duplicates → correct rowsDeleted count (dupes - 1 per group)
 * 4. Keeps the row with the highest id in each group
 * 5. Dry-run mode → does NOT call db.delete
 * 6. Live mode → calls db.delete
 * 7. DB error on SELECT → propagates
 */

import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("../src/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

import { dedupScoreHistory } from "../scripts/dedup-score-history";
import { db } from "../src/db";

describe("dedupScoreHistory", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  // ── Contract 1: No duplicates ──────────────────────────────────

  it("returns zeros and does not delete when no duplicates exist", async () => {
    // SELECT for duplicate groups returns empty
    mockDb.mockSelect([]);

    const result = await dedupScoreHistory(db, false);

    expect(result).toEqual({ topicsAffected: 0, rowsDeleted: 0 });
    expect(mockDb.chain.delete).not.toHaveBeenCalled();
  });

  // ── Contract 2: Correct topicsAffected count ──────────────────

  it("returns correct topicsAffected when duplicates exist", async () => {
    // Two distinct (topic_id, recorded_at) groups with duplicates
    const duplicateGroups = [
      { topicId: 1, recordedAt: "2026-03-01", count: 3, maxId: 10 },
      { topicId: 2, recordedAt: "2026-03-01", count: 2, maxId: 20 },
    ];

    mockDb.mockSelect(duplicateGroups);
    mockDb.mockDelete({ rowCount: 3 });

    const result = await dedupScoreHistory(db, false);

    expect(result.topicsAffected).toBe(2);
  });

  // ── Contract 3: Correct rowsDeleted count ─────────────────────

  it("returns correct rowsDeleted count (total duplicates minus one per group)", async () => {
    // Group 1: 3 rows → delete 2, Group 2: 2 rows → delete 1 = 3 total
    const duplicateGroups = [
      { topicId: 1, recordedAt: "2026-03-01", count: 3, maxId: 10 },
      { topicId: 2, recordedAt: "2026-03-01", count: 2, maxId: 20 },
    ];

    mockDb.mockSelect(duplicateGroups);
    mockDb.mockDelete({ rowCount: 3 });

    const result = await dedupScoreHistory(db, false);

    expect(result.rowsDeleted).toBe(3);
  });

  // ── Contract 4: Keeps highest id per group ────────────────────

  it("keeps the row with the highest id in each duplicate group", async () => {
    const duplicateGroups = [
      { topicId: 1, recordedAt: "2026-03-01", count: 3, maxId: 100 },
    ];

    mockDb.mockSelect(duplicateGroups);
    mockDb.mockDelete({ rowCount: 2 });

    await dedupScoreHistory(db, false);

    // The delete WHERE clause should reference maxId to exclude it.
    // We verify db.delete was called, and the where clause was invoked
    // (the implementation must delete rows WHERE id != maxId for each group).
    expect(mockDb.chain.delete).toHaveBeenCalled();
    expect(mockDb.chain.where).toHaveBeenCalled();
  });

  // ── Contract 5: Dry-run does NOT delete ───────────────────────

  it("does not call db.delete in dry-run mode", async () => {
    const duplicateGroups = [
      { topicId: 1, recordedAt: "2026-03-01", count: 3, maxId: 10 },
    ];

    mockDb.mockSelect(duplicateGroups);

    const result = await dedupScoreHistory(db, true);

    expect(mockDb.chain.delete).not.toHaveBeenCalled();
    // Still reports what would be deleted
    expect(result.topicsAffected).toBe(1);
    expect(result.rowsDeleted).toBe(2);
  });

  // ── Contract 6: Live mode calls db.delete ─────────────────────

  it("calls db.delete in live mode", async () => {
    const duplicateGroups = [
      { topicId: 1, recordedAt: "2026-03-01", count: 2, maxId: 5 },
    ];

    mockDb.mockSelect(duplicateGroups);
    mockDb.mockDelete({ rowCount: 1 });

    await dedupScoreHistory(db, false);

    expect(mockDb.chain.delete).toHaveBeenCalled();
  });

  // ── Contract 7: DB error propagates ───────────────────────────

  it("propagates DB errors during SELECT", async () => {
    const dbError = new Error("connection refused");

    // Make the SELECT chain reject
    (mockDb.chain as any).then = (_resolve: any, reject: any) => {
      return Promise.reject(dbError).catch(reject || ((e: any) => { throw e; }));
    };

    await expect(dedupScoreHistory(db, false)).rejects.toThrow(
      "connection refused"
    );
  });
});
