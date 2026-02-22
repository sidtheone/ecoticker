# Story 4.4: RSS Feed Health Logging

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **site operator**,
I want **per-feed health reporting in the batch pipeline output**,
so that **I can monitor which RSS feeds are healthy, degraded, or failing, and quickly diagnose source outages**.

## Acceptance Criteria

1. Batch log includes per-feed status line for each RSS feed: feed name, fetch duration (ms), article count, success/failure
2. Failed feeds include error message (timeout, parse error, HTTP status code)
3. Summary line after per-feed details: `"Feed health: 8/10 healthy, 2 failed [EcoWatch: timeout, EEA: 503]"`
4. Health data appears in batch log output only — no new API endpoint, no new database table
5. Per-feed timing uses `Date.now()` before/after each `parseURL` call (millisecond precision)
6. Feed name is derived from URL (hostname extraction) for failed feeds (since `feed.title` is unavailable on failure)
7. Tests verify health logging for: all feeds healthy, mixed success/failure, all feeds failed
8. Tests verify error message content includes timeout and HTTP error differentiation
9. All existing RSS and batch tests continue to pass — zero regressions
10. Both pipelines (`scripts/rss.ts` AND `route.ts` inlined copy) get the same health logging

## Tasks / Subtasks

- [x] Task 1: Modify `fetchRssFeeds()` in `scripts/rss.ts` to return per-feed health data (AC: #1, #2, #5, #6)
  - [x] Define `FeedHealth` type: `{ name: string; url: string; status: "ok" | "error"; articleCount: number; durationMs: number; error?: string }`
  - [x] Change return type from `Promise<NewsArticle[]>` to `Promise<{ articles: NewsArticle[]; feedHealth: FeedHealth[] }>`
  - [x] Wrap each `parseURL` call with `Date.now()` timing
  - [x] On success: push `{ name: feed.title || hostname, url, status: "ok", articleCount: feed.items.length, durationMs }`
  - [x] On failure: push `{ name: hostname, url, status: "error", articleCount: 0, durationMs, error: reason.message || String(reason) }`
  - [x] Extract hostname helper: `new URL(feedUrl).hostname` (for naming failed feeds that have no `feed.title`)
- [x] Task 2: Update `scripts/batch.ts` to log feed health (AC: #1, #2, #3)
  - [x] Destructure new return shape: `const { articles: rssArticles, feedHealth } = ...`
  - [x] After the Sources log line, add per-feed health lines: `"  ✓ The Guardian (theguardian.com): 12 articles in 834ms"` / `"  ✗ EcoWatch (ecowatch.com): FAILED in 15001ms — timeout"`
  - [x] Add summary line per AC #3 format
  - [x] Handle the case where RSS itself crashes (`rssResult.status === "rejected"`) — no feedHealth available, log `"RSS feed health: unavailable (fetch crashed)"`
- [x] Task 3: Update inlined `fetchRssFeeds()` in `route.ts` with same health logging (AC: #10)
  - [x] Mirror the exact same changes from Task 1 into the inlined copy in `route.ts`
  - [x] Mirror the same batch logging from Task 2 in route.ts's POST handler
  - [x] Add `// SYNC:` comment on the `FeedHealth` type and logging block
- [x] Task 4: Update existing RSS tests for new return shape (AC: #9)
  - [x] Update `tests/rss.test.ts` — all 11 tests expect `{ articles, feedHealth }` instead of bare array
  - [x] Verify feedHealth entries match expected per-feed results
- [x] Task 5: Write health logging tests (AC: #7, #8)
  - [x] Test: all feeds healthy — feedHealth has all `status: "ok"` with positive `articleCount` and `durationMs`
  - [x] Test: mixed success/failure — feedHealth has both `"ok"` and `"error"` entries
  - [x] Test: all feeds failed — feedHealth all `"error"`, articles is `[]`
  - [x] Test: timeout error includes "timeout" in error message
  - [x] Test: HTTP error includes status code in error message
  - [x] Test: feed name falls back to hostname when `feed.title` is unavailable
- [x] Task 6: Update batch integration tests for new return shape (AC: #9)
  - [x] No direct mock shape changes needed — tests mock rss-parser at the low level, so fetchRssFeeds() runs internally with the new return shape
  - [x] batch-rss-integration.test.ts: 7/7 pass
  - [x] api-batch-gnews.test.ts: 21/21 pass
  - [x] All existing test scenarios still pass with updated return shape

## Dev Notes

### Critical: Return Type Change is a Breaking Interface Change

`fetchRssFeeds()` currently returns `Promise<NewsArticle[]>`. This story changes it to `Promise<{ articles: NewsArticle[]; feedHealth: FeedHealth[] }>`. This is a **breaking change** for all callers:

1. **`scripts/batch.ts` line 624** — currently `rssResult.value` is `NewsArticle[]`. Must destructure: `const { articles: rssArticles, feedHealth } = rssResult.value`
2. **`route.ts` inlined copy** — same change to the inlined function + caller
3. **`tests/rss.test.ts`** — all 11 tests assert on the return value. Must update to `result.articles` and add `result.feedHealth` assertions
4. **`tests/batch-rss-integration.test.ts`** — mocks `fetchRssFeeds` return. Must return new shape
5. **`tests/api-batch-gnews.test.ts`** — mocks RSS return. Must return new shape

**Order matters:** Change `scripts/rss.ts` first (Task 1), then update all callers and tests (Tasks 2-6) before running the test suite. Running tests between Task 1 and Task 4 will fail.

### FeedHealth Type Definition

```typescript
export interface FeedHealth {
  name: string;       // feed.title for success, hostname for failures
  url: string;        // original feed URL
  status: "ok" | "error";
  articleCount: number; // 0 for failures
  durationMs: number;  // milliseconds elapsed for this feed
  error?: string;      // only present when status === "error"
}
```

Define this in `scripts/rss.ts` alongside `NewsArticle`. Export it for tests.

### Per-Feed Timing Implementation

The current `fetchRssFeeds()` does `Promise.allSettled(RSS_FEEDS.map(url => parser.parseURL(url)))`. To get per-feed timing, wrap each parseURL:

```typescript
RSS_FEEDS.map(async (url) => {
  const start = Date.now();
  try {
    const feed = await parser.parseURL(url);
    return { feed, durationMs: Date.now() - start, url };
  } catch (err) {
    throw { error: err, durationMs: Date.now() - start, url };
  }
})
```

**Problem:** `Promise.allSettled` with a thrown object — the `reason` will be the thrown object, not a standard Error. Handle this in the result processing loop:

```typescript
if (result.status === "rejected") {
  const { error, durationMs, url } = result.reason as { error: unknown; durationMs: number; url: string };
  const hostname = new URL(url).hostname;
  feedHealth.push({
    name: hostname,
    url,
    status: "error",
    articleCount: 0,
    durationMs,
    error: error instanceof Error ? error.message : String(error),
  });
}
```

### Log Format

**Per-feed lines** (indented under the Sources line):
```
  ✓ The Guardian (theguardian.com): 15 articles in 834ms
  ✓ Grist (grist.org): 8 articles in 421ms
  ✗ EcoWatch (ecowatch.com): FAILED in 15001ms — timeout
  ✗ EEA Press Releases (eea.europa.eu): FAILED in 2103ms — 503
```

**Summary line** per AC #3:
```
Feed health: 8/10 healthy, 2 failed [ecowatch.com: timeout, eea.europa.eu: 503]
```

For the summary line's failure list, use hostname (short) not full feed title (long).

### Hostname Extraction Helper

```typescript
function feedHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url; // fallback: show raw URL if unparseable
  }
}
```

Keep this as a local function in `scripts/rss.ts` — not exported, not in a shared utility. KISS.

### What NOT to Change

- **No new database table** — health data is logging only (AC #4)
- **No new API endpoint** — no `/api/feed-health` (explicitly deferred per epic)
- **No changes to classification/scoring logic** — only the fetch + log layer changes
- **No changes to GNews health** — GNews already has source health warnings from Story 4-2. This story is RSS-feed-level granularity only
- **Do NOT change the `NewsArticle` interface** — keep it exactly as Story 4-1 defined it

### Pipeline Sync Warning

Both `scripts/rss.ts` AND `route.ts` (inlined copy) must get the same changes. After this story, the inlined copy in `route.ts` will have diverged further from `scripts/rss.ts`. Add a `// SYNC:` comment on the `FeedHealth` type and the health logging block in `route.ts`.

### Testing Approach

**`tests/rss.test.ts` updates (Task 4):** The 11 existing tests all do something like:
```typescript
const result = await fetchRssFeeds();
expect(result).toHaveLength(N);
```
These must change to:
```typescript
const { articles, feedHealth } = await fetchRssFeeds();
expect(articles).toHaveLength(N);
// optionally: expect(feedHealth).toHaveLength(RSS_FEEDS.length);
```

**New health logging tests (Task 5):** Add to `tests/rss.test.ts` in a new `describe("feed health")` block:
- Mock `parser.parseURL` to succeed for some URLs and reject for others
- Assert `feedHealth` entries have correct `status`, `articleCount`, `durationMs > 0`, and `error` string
- For timing tests: don't assert exact ms values — assert `durationMs >= 0` (timing is non-deterministic in tests)

**Batch integration test updates (Task 6):** Update the mock return shape in:
- `tests/batch-rss-integration.test.ts` — `fetchRssFeeds` mock returns `{ articles: [...], feedHealth: [...] }`
- `tests/api-batch-gnews.test.ts` — RSS mock returns same shape

For batch tests, the feedHealth array can be a minimal mock (empty array is fine if the test doesn't assert on logging).

### Mock Pattern for rss-parser with Timing

```typescript
// Mock parseURL to simulate timing
const mockParseURL = jest.fn()
  .mockResolvedValueOnce({ title: "The Guardian", items: [mockItem] })  // feed 1: success
  .mockRejectedValueOnce(new Error("timeout"))                          // feed 2: failure
  .mockResolvedValueOnce({ title: "Grist", items: [] });                // feed 3: success, 0 articles
```

### Previous Story Intelligence (4-2)

- `fetchRssFeeds()` is called inside `Promise.allSettled` — if the function signature changes, the allSettled result shape changes too. The fulfilled value is now `{ articles, feedHealth }` not `NewsArticle[]`.
- Both pipelines have inlined copies that must be kept in sync.
- `mockRestore()` clears `mock.calls` — always assert BEFORE calling `spy.mockRestore()`.
- `setupDb()` order matters in batch tests — set DB mock first, then fetch/RSS mocks.

### Project Structure Notes

- `scripts/rss.ts` — standalone RSS module, exports `fetchRssFeeds` + `NewsArticle` + (new) `FeedHealth`
- `src/app/api/batch/route.ts` — inlined copy of `fetchRssFeeds` (SYNC pattern from 4-2)
- No new files created. No new dependencies.
- `FeedHealth` type lives in `scripts/rss.ts` only — not in `src/lib/types.ts` (it's internal to the batch pipeline, not a UI/API type)

### References

- [Source: _bmad-output/planning-artifacts/epic-4.md — Story 4.4 AC and Dev Notes]
- [Source: scripts/rss.ts — current fetchRssFeeds() implementation (lines 48-86)]
- [Source: scripts/batch.ts — RSS integration at lines 618-665]
- [Source: src/app/api/batch/route.ts — inlined fetchRssFeeds() at lines 269-307, caller at lines 617-663]
- [Source: tests/rss.test.ts — 11 existing RSS tests]
- [Source: tests/batch-rss-integration.test.ts — 5 batch+RSS integration tests]
- [Source: tests/api-batch-gnews.test.ts — route.ts tests including RSS integration]
- [Source: _bmad-output/implementation-artifacts/4-2-integrate-rss-batch-pipeline.md — Previous story: sourceMap pattern, SYNC comments, test mock patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation.

### Completion Notes List

- Added `FeedHealth` interface and `feedHostname()` helper to scripts/rss.ts
- Changed `fetchRssFeeds()` return type from `NewsArticle[]` to `{ articles, feedHealth }` (breaking interface change)
- Wrapped each `parseURL` call with `Date.now()` timing
- Updated scripts/batch.ts: destructures new return shape, logs per-feed health lines and summary
- Updated route.ts inlined copy: same FeedHealth type + timing + health logging with SYNC comments
- Both pipelines handle rssResult.status === "rejected" (crash) with "unavailable" log message
- Updated all 11 existing tests in rss.test.ts to destructure { articles, feedHealth }
- Added 6 new feed health tests (all-healthy, mixed, all-failed, timeout, HTTP error, hostname fallback)
- No changes needed to batch integration test mocks (they mock rss-parser at low level)
- 323/323 full suite pass, zero regressions

### File List

- `scripts/rss.ts` (modified — FeedHealth type, return type change, per-feed timing, exported feedHostname)
- `scripts/batch.ts` (modified — destructure new return, health logging, imports feedHostname/types from rss.ts)
- `src/app/api/batch/route.ts` (modified — FeedHealth type, inlined fetchRssFeeds return change, health logging)
- `tests/rss.test.ts` (modified — all tests updated for new return shape, 6 new health tests)
- `tests/batch-rss-integration.test.ts` (modified — 1 new test: per-feed health log format AC #1-3)

## Senior Developer Review (AI)

**Reviewer:** Adversarial Code Review (Party Mode: Dev + QA + Architect)
**Date:** 2026-02-21
**Result:** APPROVED (after fixes)

### Issues Found: 3 Medium, 2 Low

| ID | Severity | File | Description | Resolution |
|----|----------|------|-------------|------------|
| M1 | MEDIUM | `scripts/batch.ts:644,653` | Unguarded `new URL(fh.url)` — crash risk if URL malformed. `route.ts` uses `feedHostname()` with try/catch but `batch.ts` used inline `new URL()`. | **FIXED** — imported `feedHostname` from `./rss`, replaced both inline calls |
| M2 | MEDIUM | Story File List | `tests/api-batch-gnews.test.ts` modified in git but not in File List | **NOTED** — changes are from Story 4.6 (same session), not 4.4 scope |
| M3 | MEDIUM | `tests/batch-rss-integration.test.ts` | No test for batch log output format (ACs #1-3 specify format) | **FIXED** — added log format test asserting ✓/✗ lines + summary |
| L1 | LOW | `scripts/batch.ts:641` | Missing `// SYNC:` comment on health logging block | **FIXED** — added SYNC comment |
| L2 | LOW | `scripts/batch.ts:624-625` | Inline `import("./rss").FeedHealth` type syntax instead of direct import | **FIXED** — imported types directly from `./rss` |

### Post-Fix Verification

- 325/325 tests passing (324 original + 1 new log format test)
- TypeScript clean (`npx tsc --noEmit` — zero errors)
- All 10 ACs verified against implementation
