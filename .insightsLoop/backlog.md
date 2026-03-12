# Backlog

Items deferred from engine-fixes-proposed.md. Not urgent — engine SKILL.md fixes take priority.

---

## Test Fix: Contract 1 fixture in dedup-score-history

**File:** `tests/dedup-score-history.test.ts`
**Test:** `"returns zeros and does not delete when no duplicates exist"`
**Source:** engine-fixes-proposed.md #5, sentinel-issues.md

**Current (wrong):**
```typescript
mockDb.mockSelect([]);
const result = await dedupScoreHistory(db, false);
expect(result).toEqual({ topicsAffected: 0, rowsDeleted: 0 });
```

**Fix:**
```typescript
// Mock returns a singleton group (count=1) — what the DB actually returns for non-duplicate data
mockDb.mockSelect([{ topicId: 1, recordedAt: "2026-03-01", count: 1, maxId: 5 }]);
const result = await dedupScoreHistory(db, false);
expect(result).toEqual({ topicsAffected: 0, rowsDeleted: 0 });
expect(mockDb.chain.delete).not.toHaveBeenCalled();
```

**Why:** Original fixture mocked the ideal output (empty array), not the real DB shape (all groups including singletons). The missing HAVING filter was invisible — Shipwright built without it and all 7 tests passed. Cartographer caught it at Ship.

---

## Test Fix: Strengthen onConflictDoUpdate assertion

**File:** `tests/run-batch-pipeline.test.ts`
**Test:** `"uses onConflictDoUpdate when inserting score_history"`
**Source:** engine-fixes-proposed.md #6

**Current (weak):**
```typescript
expect(mock.chain.onConflictDoUpdate.mock.calls.length).toBeGreaterThanOrEqual(2);
```

**Problem:** Passes if any two `onConflictDoUpdate` calls happen for any reason (e.g. two topic upserts). Doesn't verify the call is for score_history specifically.

**Fix:** Assert that at least one call includes `scoreHistory.topicId` and `scoreHistory.recordedAt` in its target argument.

---

## Previously identified backlog items (from run-0002)

- ScoreInfoIcon orphan cleanup
- Label divergence fix
- API pagination
- Same-day batch dedup (partially addressed in run-0003)
