# Test Redundancy Report

**Suite size:** 685 tests across 45 files
**Redundant:** ~74 tests (11%)
**Clean target:** ~611 tests with zero meaningful coverage loss

---

## Exact Duplicates (delete now, zero risk)

### 1. `severityColor.test.ts` is a full copy of `utils.test.ts`

**Files:** `tests/severityColor.test.ts` vs `tests/utils.test.ts` (lines 1–108)

The `describe("severityColor", ...)` block in `utils.test.ts` is character-for-character identical to the entire `severityColor.test.ts` file. Every test, every assertion, every boundary check, every describe label. 108 lines of tests exist twice.

**Tests wasted:** 14
**Fix:** Delete `severityColor.test.ts`. `utils.test.ts` already covers it alongside the other utility functions.

---

### 2. `batch.test.ts` reimplements functions instead of importing them

**Files:** `tests/batch.test.ts` (lines 209–294) vs `tests/batch-pipeline.test.ts` (lines 167–231)

`batch.test.ts` defines local copies of `isBlockedDomain` and `extractJSON` as closures — pasted from the source code. `batch-pipeline.test.ts` imports and tests the real exported functions.

Test cases are functionally identical:
- Both test blocked domains (`lifesciencesworld.com`, `alltoc.com`)
- Both test legitimate domains (`reuters.com`, `bbc.co.uk`)
- Both test invalid URLs and empty strings
- Both test clean JSON, embedded JSON, and null-returning cases

The `batch.test.ts` copies are a false safety net — they'll silently pass even if the real implementation is deleted.

**Tests wasted:** 10
**Fix:** Delete the `"Domain Blocking"` and `"extractJSON"` describe blocks from `batch.test.ts`.

---

### 3. `batch.test.ts` DB Operations block mirrors `run-batch-pipeline.test.ts`

**Files:** `tests/batch.test.ts` (lines 18–207) vs `tests/run-batch-pipeline.test.ts`

`batch.test.ts` hand-simulates the pipeline by calling raw Drizzle mock methods directly (insert topic → insert articles → insert score → insert keywords → re-insert with score rotation). `run-batch-pipeline.test.ts` calls the actual `runBatchPipeline()` function which does the same operations.

The `batch.test.ts` version tests that you can call mock methods and get mock data back — circular. `run-batch-pipeline.test.ts` provides strictly higher-fidelity coverage.

**Tests wasted:** ~3
**Fix:** Delete the DB Operations describe block from `batch.test.ts`.

---

## Significant Overlap (merge, moderate effort)

### 4. Two TopicDetail test files with ~12 identical assertions

**Files:** `tests/TopicDetail.test.tsx` (31 tests) vs `tests/TopicDetail-7-5.test.tsx` (36 tests)

Both test `TopicDetailPage` with identical fixtures (`mockScoreEntry()`, same slug, same scores, same `setupFetch()` helper). Duplicated behaviors:

- `score-hero` present in DOM
- `insight-lede` present
- `detail-score` has `font-mono` class, is NOT `text-4xl`
- `detail-score` inline style is `rgb(220, 38, 38)` for score 85
- `ScoreInfoIcon` absent
- Share button copies URL to clipboard + shows "Link copied!"
- Share button reverts after 2 seconds
- Back-link href is `"/"`
- `sub-score-breakdown` exists, no `grid-cols-3`

`TopicDetail-7-5.test.tsx` adds unique value: DOM position ordering (AC1), mobile `line-clamp-2` (AC2), source citation dates and "Date unknown" (AC5), accessibility headings (AC7), network error state. `TopicDetail.test.tsx` adds unique value: article count copy, INSUFFICIENT_DATA sub-score states.

**Tests wasted:** ~12
**Fix:** Merge into one file. Keep all unique assertions from both, deduplicate the shared ones.

---

### 5. RSS integration tested from two entry points with identical scenarios

**Files:** `tests/batch-rss-integration.test.ts` (7 tests) vs `tests/api-batch-route.test.ts` (21 tests, RSS section)

Both test the same RSS behaviors through different callers (`scripts/batch.ts` via `main()` vs `POST /api/batch` via the route handler). 5 of 7 scenarios appear in both:

- GNews succeeds + RSS succeeds → `sourceType` attribution
- GNews fails (401) + RSS succeeds → RSS proceeds
- GNews succeeds + RSS empty → GNews proceeds + warning
- RSS crash → GNews still proceeds
- Cross-source URL dedup (RSS wins)

Near-identical fixtures: `GNEWS_ARTICLE`, `RUBRIC_SCORE`, `makeClassificationResponse`, `makeScoringResponse`, `makeGNewsResponse`.

Unique value in `batch-rss-integration.test.ts`: the `logs per-feed health status` test (console.log format for Story 4.4 ACs).

**Tests wasted:** ~10
**Fix:** Consolidate RSS tests into one file. Keep the feed health logging test from `batch-rss-integration.test.ts`, delete the rest.

---

### 6. Two files test the same pipeline through thin entry-point difference

**Files:** `tests/batch-rss-integration.test.ts` vs `tests/run-batch-pipeline.test.ts`

`batch-rss-integration.test.ts` mocks `drizzle-orm/node-postgres` and `pg`, then calls `main()` from `scripts/batch.ts`. `run-batch-pipeline.test.ts` passes a mock `db` directly to `runBatchPipeline()`. Since `main()` is essentially a one-liner that calls `runBatchPipeline()`, both exercise the same code path.

Shared behaviors: ghost scoring prevention, classification fallback, daily mode fetch+classify+score.

**Tests wasted:** ~8 (beyond Finding 5 overlap)
**Fix:** Keep unique assertions from `batch-rss-integration.test.ts` (feed health logging, entry-point wiring), delete pipeline-behavior tests that duplicate `run-batch-pipeline.test.ts`.

---

## Stale Tests (unused components)

### 7. TopicGrid and TickerBar are not rendered anywhere

**Files:** `tests/TopicGrid.test.tsx` (15 tests) + `tests/TickerBar.test.tsx` (7 tests)

Neither `TopicGrid` nor `TickerBar` is imported by any page, layout, or component in `src/app/` or `src/components/`. Confirmed by grep — zero import statements. The homepage uses `HeroSection` + `TopicList`. The ticker bar was removed from the layout in run-0001.

The tests pass (components still compile) but provide zero production assurance.

**Tests wasted:** 22 (TopicGrid: 15, TickerBar: 7)
**Fix:** If components won't return to the app, delete both test files and the components. If kept as dormant, label them explicitly.

Note: `BiggestMovers.test.tsx` (7 tests) and `ScoreInfoIcon.test.tsx` (4 tests) are in the same situation — testing components not currently imported. Total stale: 29 tests across 4 files.

---

## Architectural Debt (can't delete tests, must fix source)

### 8. Two identical functions: `deriveUrgency()` and `scoreToUrgency()`

**Files:** `tests/scoring.test.ts` vs `tests/utils.test.ts`

`scoring.ts` exports `deriveUrgency(score)`. `utils.ts` exports `scoreToUrgency(score)`. Both implement identical threshold logic: 80+ → breaking, 60-79 → critical, 30-59 → moderate, 0-29 → informational. Both are tested with the same boundary scores.

**Tests mirrored:** 8
**Fix:** Pick one canonical function. Have the other module re-export or alias it. Then delete the duplicate test block. Can't delete tests until source is consolidated — both functions have consumers.

---

### 9. Mock divergence: inline mock vs shared mock infrastructure

**Files:** `tests/dashboard-page.test.tsx` vs every other test using `tests/helpers/mock-db.ts`

`dashboard-page.test.tsx` uses a one-off inline mock:
```typescript
jest.mock("@/db", () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    }),
  },
  pool: { end: jest.fn() },
}));
```

This is a shallow 3-level chain that returns `[]` for any query regardless of shape. It has no `orderBy`, `limit`, `leftJoin`, `groupBy`, or `onConflictDoUpdate`. If the dashboard page gains a more complex query, this mock will silently pass.

**Tests at risk:** 3 (currently low risk — tests don't depend on DB data)
**Fix:** Migrate to `mockDbInstance` from `helpers/mock-db.ts`.

---

### 10. Query-pattern tests that mostly test the mock

**Files:** `tests/api-topics.test.ts` (7 tests) and `tests/api-topic-detail.test.ts` (6 tests)

Both files mock the DB, call `mockSelect()` or `mockFindFirst()` with canned data, then assert that the canned data came back. They're testing the mock round-trip, not route handler logic. The higher-value route handler tests are in `api-batch-route.test.ts` and `api-health.test.ts`, which actually invoke the route handler function.

Some tests have unique value: sparkline ordering (last 7 DESC then reverse), articles ordered by published_at, score history ordered by recorded_at. Most don't.

**Tests of marginal value:** ~5
**Fix:** Low priority. Keep the ordering/filtering tests, consider trimming pure mock-echo tests.

---

## Summary

| # | Type | Files | Tests Wasted | Effort | Risk |
|---|---|---|---|---|---|
| 1 | Exact duplicate | `severityColor.test.ts` | 14 | 1 min | None |
| 2 | Exact duplicate | `batch.test.ts` blocks | 10 | 5 min | None |
| 3 | Exact duplicate | `batch.test.ts` DB block | ~3 | 5 min | None |
| 4 | Significant overlap | TopicDetail × 2 | ~12 | 30 min | Low |
| 5 | Significant overlap | RSS integration × 2 | ~10 | 20 min | Low |
| 6 | Significant overlap | Pipeline entry points | ~8 | 15 min | Low |
| 7 | Stale components | TopicGrid + TickerBar + 2 more | 29 | 5 min | Decision needed |
| 8 | Arch debt | deriveUrgency/scoreToUrgency | 8 mirrored | 15 min | Source change needed |
| 9 | Mock divergence | dashboard-page inline mock | 0 (future risk) | 10 min | Low |
| 10 | Minor overlap | Query-pattern tests | ~5 | Low priority | Acceptable |

**Total redundant:** ~74 tests (11%)
**Safe immediate deletions (zero coverage loss):** ~27 tests (findings 1–3)
**Safe merges (moderate effort):** ~30 tests (findings 4–6)
**Decision needed:** ~29 tests (finding 7 — keep or kill dormant components)

---

## Root Cause

The redundancy has two sources:

1. **BMAD-era files not cleaned up.** `severityColor.test.ts`, `batch.test.ts` DB Operations and domain/extractJSON blocks were written early. When `utils.test.ts`, `batch-pipeline.test.ts`, and `run-batch-pipeline.test.ts` superseded them, the old files weren't pruned.

2. **InsightsLoop runs were additive.** `TopicDetail-7-5.test.tsx` (Story 7-5 TDD) was written alongside the existing `TopicDetail.test.tsx` rather than merging into it. Same for RSS tests — new run added new file instead of extending existing coverage.

Both are symptoms of TDD-first methodology: tests are written before implementation, and when the implementation evolves, earlier test files aren't revisited. The engine captures patterns for future runs (PATTERNS.md) but doesn't have a "prune old tests" step.
