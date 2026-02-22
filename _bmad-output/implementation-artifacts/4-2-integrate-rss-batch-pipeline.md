# Story 4.2: Integrate RSS into Batch Pipeline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **site operator**,
I want **the batch pipeline to fetch articles from both GNews and RSS feeds in parallel**,
so that **EcoTicker has resilient multi-source news ingestion where one source failing doesn't stop the entire pipeline**.

## Acceptance Criteria

1. Batch pipeline fetches GNews and RSS in parallel using `Promise.allSettled`
2. Both sources contribute to the same article pool before classification
3. If GNews fails, RSS articles still proceed to scoring
4. If RSS fails, GNews articles still proceed to scoring
5. If BOTH fail, exit gracefully (no scoring with zero articles)
6. Dedup via existing UNIQUE constraint on `articles.url` (`ON CONFLICT DO NOTHING`) — no new dedup logic needed beyond the existing in-memory `Set<string>` dedup
7. Batch log indicates source breakdown: `"Sources: GNews=${n}, RSS=${m} (before dedup) → ${t} unique (after dedup)"`
8. `source_type` column set correctly on insert: `"gnews"` for GNews articles, `"rss"` for RSS articles — never rely on schema default
9. Response JSON (route.ts only) includes `gnewsArticles` and `rssArticles` counts in stats — exact field names: `stats.gnewsArticles: number` and `stats.rssArticles: number` (raw counts before dedup). Test assertion: `expect(data.stats.gnewsArticles).toBe(n)` and `expect(data.stats.rssArticles).toBe(m)`
10. Source health logged: if either source returns 0 articles while the other succeeds, log a warning (distinguishes "no new articles" from "source down")
11. Integration tests cover: both succeed, GNews fails/RSS succeeds, RSS fails/GNews succeeds, both fail, cross-source URL dedup attribution
12. All existing tests continue to pass — zero regressions

## Tasks / Subtasks

- [x] Task 1: Modify `scripts/batch.ts` to fetch RSS in parallel with GNews (AC: #1, #2, #3, #4, #5, #7, #8)
  - [x] Import `fetchRssFeeds` from `./rss` (relative import, both in `scripts/`)
  - [x] Replace single `fetchNews()` call with `Promise.allSettled([fetchNews(), fetchRssFeeds()])`
  - [x] Handle settled results: extract fulfilled arrays, log rejected sources
  - [x] Merge arrays, apply existing in-memory dedup + blocked domain filter to combined set
  - [x] Track article origin (`"gnews"` vs `"rss"`) through to DB insert
  - [x] Set `sourceType` on article insert (line ~778) — currently missing
  - [x] Log source breakdown per AC #7 format
  - [x] Exit gracefully if both sources produce 0 articles
- [x] Task 2: Modify `src/app/api/batch/route.ts` to fetch RSS in parallel with GNews (AC: #1-#9)
  - [x] **MANDATORY:** Inline `fetchRssFeeds()` directly in route.ts (do NOT import from `scripts/`) — standalone build excludes `scripts/` directory
  - [x] **DO NOT copy the `NewsArticle` interface** — `route.ts` already defines an identical one at line 86. Copy only `fetchRssFeeds()` and `DEFAULT_FEEDS`
  - [x] Same `Promise.allSettled` pattern as Task 1
  - [x] Update `sourceType` on insert to be dynamic (`"gnews"` or `"rss"`) instead of hardcoded `"gnews"`
  - [x] Log source breakdown + source health warnings
  - [x] Return `gnewsArticles` and `rssArticles` counts in response JSON stats
- [x] Task 3: Write integration tests for `scripts/batch.ts` RSS integration (AC: #9)
  - [x] Mock both `fetch` (for GNews) and `rss-parser` (for RSS)
  - [x] **DB mock pattern:** `scripts/batch.ts` creates its own `const db = drizzle(pool, { schema })` at line 47 — NOT via `@/db`. Use `jest.mock("drizzle-orm/node-postgres", () => ({ drizzle: jest.fn(() => mockDb) }))` plus `jest.mock("pg", () => ({ Pool: jest.fn() }))`. Wire `mockDb` using the proxy pattern from `tests/helpers/mock-db.ts`
  - [x] Use `beforeEach(() => jest.clearAllMocks())` to prevent mock bleed between scenarios (4-1 retro lesson: mock bleed caused 3 false positives with `mockReturnValueOnce` sequences)
  - [x] Test: both succeed → merged article pool
  - [x] Test: GNews fails, RSS succeeds → RSS articles only
  - [x] Test: RSS fails, GNews succeeds → GNews articles only
  - [x] Test: both fail → graceful exit, no scoring
  - [x] Test: sourceType set correctly per source (spy on `db.insert(articles).values()`)
  - [x] Test: cross-source URL dedup — same URL in GNews and RSS → verify correct sourceType attribution
- [x] Task 4: Update `route.ts` tests (AC: #11, #12)
  - [x] Add `jest.mock("rss-parser")` to existing `tests/api-batch-gnews.test.ts`
  - [x] Test parallel fetch + merged results
  - [x] Verify sourceType differentiation on insert via DB spy
  - [x] Test cross-source URL collision (same URL, different sources)
  - [x] Verify response JSON includes `gnewsArticles` and `rssArticles` stats
  - [x] Verify source health warning logged when one source returns 0
- [x] Task 5: Verify all existing tests pass (AC: #12)
  - [x] Ensure `jest.clearAllMocks()` in `beforeEach` clears RSS mock AND fetch mock

## Dev Notes

### Critical: Import Path for `fetchRssFeeds`

**In `scripts/batch.ts`:** Use relative import `import { fetchRssFeeds } from "./rss"`. Both files are in `scripts/` directory. The `dotenv/config` import in `rss.ts` is idempotent — safe to call multiple times.

**In `route.ts`: MANDATORY — inline `fetchRssFeeds()` directly.** Do NOT import from `scripts/rss.ts`. Next.js standalone output (`output: "standalone"` in `next.config.ts`) only bundles files reachable through the app router. The `scripts/` directory is excluded from the standalone build — a relative import like `../../../../scripts/rss` will compile in dev but **crash at runtime in production** with "module not found."

Copy `fetchRssFeeds()` and `DEFAULT_FEEDS` from `scripts/rss.ts` into `route.ts` as a self-contained block. **Do NOT copy the `NewsArticle` interface** — `route.ts` already defines an identical one at line 86. TypeScript will error `TS2300: Duplicate identifier 'NewsArticle'` if you copy it. The existing interface is fully compatible with `fetchRssFeeds()`'s return type. This is a pragmatic DRY exception — the two pipelines are already heavily duplicated (per the reconciliation plan). Add a `// SYNC: copied from scripts/rss.ts — keep in sync until pipeline consolidation` comment.

**Note:** `epic-4.md` Story 4.2 still says `source_type = 'newsapi'` (stale — written before the GNews emergency migration). Use `"gnews"` as specified in this story's AC #8. Do NOT follow the epic's source_type value.

### Tracking Article Origin Through the Pipeline

The `NewsArticle` interface has no `sourceType` field. Use a `Map<string, "gnews" | "rss">` to track origin.

**CRITICAL: Build sourceMap with first-source-wins, RSS first.**

RSS articles go into the merge array FIRST so they win the `Set` dedup on cross-source duplicates. The `sourceMap` uses first-write-wins (skip if already seen) to stay consistent with the dedup order.

```typescript
// After Promise.allSettled:
const gnewsArticles = gnewsResult.status === "fulfilled" ? gnewsResult.value : [];
const rssArticles = rssResult.status === "fulfilled" ? rssResult.value : [];

// Build sourceMap — first-write-wins (matches Set dedup behavior)
const sourceMap = new Map<string, "gnews" | "rss">();
for (const a of rssArticles) {
  if (!sourceMap.has(a.url)) sourceMap.set(a.url, "rss");
}
for (const a of gnewsArticles) {
  if (!sourceMap.has(a.url)) sourceMap.set(a.url, "gnews");
}

// Merge RSS first so RSS wins dedup on cross-source duplicates
const allArticles = [...rssArticles, ...gnewsArticles];
// ... existing Set<string> dedup filter (first-seen wins) ...

// At insert time:
sourceType: sourceMap.get(a.url) ?? "gnews", // defensive: map is complete by construction; fallback should never trigger
```

**Why RSS first:** RSS is the free, reliable source. GNews has rate limits and API key dependency. When both have the same article, prefer RSS attribution.

**Why first-write-wins in sourceMap:** The `Set` dedup keeps the first article it sees. The `sourceMap` must use the same ordering — if both have the same URL, the map must reflect whichever article survived dedup. Both use first-wins → consistent.

**Do NOT extend `NewsArticle` with an optional field** — that changes the interface contract Story 4.1 established.

### `scripts/batch.ts` — Specific Code Locations

**Line numbers are approximate — verify against current source before implementing.**

| What | Where (approx) | Action |
|------|----------------|--------|
| RSS placeholder comment | Line ~34-35 | Remove placeholder, add `import { fetchRssFeeds } from "./rss"` |
| `fetchNews()` call | Line ~619 | Replace with `Promise.allSettled([fetchNews(), fetchRssFeeds()])` |
| Article count log | Line ~620 | Replace with source breakdown + health warning log |
| Zero-article check | Lines ~622-626 | Keep but check combined total from both sources |
| Article insert | Lines ~768-781 | **ADD** `sourceType: sourceMap.get(a.url) || "gnews"` (field is currently MISSING entirely) |

### `route.ts` — Specific Code Locations

**Line numbers are approximate — verify against current source before implementing.**

| What | Where (approx) | Action |
|------|----------------|--------|
| Top of file | After existing imports | **ADD** inlined `fetchRssFeeds()`, `DEFAULT_FEEDS`, `rss-parser` import — do NOT copy `NewsArticle` (already at line 86) |
| `fetchNews()` call | Line ~547 | Replace with `Promise.allSettled([fetchNews(), fetchRssFeeds()])` |
| Article count log | Line ~548 | Replace with source breakdown + health warning log |
| Zero-article check | Lines ~550-557 | Keep but check combined total from both sources |
| Article insert `sourceType` | Line ~714 | Change from hardcoded `"gnews"` to `sourceMap.get(a.url) ?? "gnews"` |
| API key check | Lines ~531-539 | Keep GNews key check; RSS has no API key (public feeds) |
| Response stats | Lines ~785-796 | Add `gnewsArticles` and `rssArticles` counts to stats object |

### Error Handling: `Promise.allSettled` Pattern

```typescript
const [gnewsResult, rssResult] = await Promise.allSettled([
  fetchNews(),
  fetchRssFeeds(),
]);

const gnewsArticles = gnewsResult.status === "fulfilled" ? gnewsResult.value : [];
const rssArticles = rssResult.status === "fulfilled" ? rssResult.value : [];

// Log catastrophic failures (uncaught exceptions — rare)
if (gnewsResult.status === "rejected") {
  console.error("GNews fetch CRASHED:", gnewsResult.reason);
}
if (rssResult.status === "rejected") {
  console.error("RSS fetch CRASHED:", rssResult.reason);
}

// Source health warnings (AC #10) — distinguish "no data" from "source down"
if (gnewsArticles.length === 0 && rssArticles.length > 0) {
  console.warn("⚠️ GNews returned 0 articles while RSS is healthy — check API key / rate limits");
}
if (rssArticles.length === 0 && gnewsArticles.length > 0) {
  console.warn("⚠️ RSS returned 0 articles while GNews is healthy — check feed URLs / network");
}

console.log(`Sources: GNews=${gnewsArticles.length}, RSS=${rssArticles.length} (before dedup) → ${uniqueCount} unique (after dedup)`);

if (gnewsArticles.length === 0 && rssArticles.length === 0) {
  // Both sources produced nothing — exit gracefully, no scoring
}
```

**CRITICAL: `fetchRssFeeds()` never rejects.** It catches all per-feed errors internally and returns `[]` (empty array) as a *fulfilled* promise. A `"rejected"` result from `Promise.allSettled` for RSS would only come from an uncaught exception (e.g., `rss-parser` import failure). Same for `fetchNews()` — per-keyword errors are caught, only catastrophic failures propagate.

**Implication for tests:** "RSS fails" means `fetchRssFeeds()` returns `[]` (fulfilled, empty array) — NOT a rejected promise. Test both paths:
- Fulfilled with empty array (all feeds timed out — common)
- Rejected (uncaught exception — rare but must be handled)

### Dedup Strategy (Two Layers)

**Layer 1 — In-memory `Set<string>` (pre-insert):** The existing dedup in both pipelines (batch.ts line 150-161, route.ts line 222-232) uses a `Set` that keeps the first article it sees. After merging `[...rssArticles, ...gnewsArticles]` (RSS first!), pass the combined array through the SAME dedup filter. First-seen wins → RSS wins cross-source duplicates.

**Layer 2 — DB UNIQUE constraint (at insert):** `articles.url` has a UNIQUE constraint with `ON CONFLICT DO NOTHING`. This catches duplicates across batch runs (same article fetched in two separate pipeline executions). Layer 1 handles within-run dedup; Layer 2 handles across-run dedup.

**sourceMap consistency:** The `sourceMap` is built with RSS-first, first-write-wins — matching the merge + dedup order. The article that survives dedup will have the correct sourceType in the map.

### Log Format

Follow AC #7 exactly:
```
Sources: GNews=15, RSS=32 (before dedup) → 40 unique (after dedup)
```

- `GNews=15` — raw count from `gnewsArticles.length` (before any dedup)
- `RSS=32` — raw count from `rssArticles.length` (before any dedup)
- `40 unique` — count after in-memory `Set` dedup of the merged array (before DB insert)

The numbers may not add up (15+32=47, but 40 unique) — this is expected when articles appear in both sources.

### Testing Approach

**For `scripts/batch.ts` tests:** Add tests to a new file `tests/batch-rss-integration.test.ts`:
- Mock `global.fetch` for GNews API responses
- Mock `rss-parser` module for RSS feed responses
- Mock the standalone Drizzle `db` for DB operations
- Test all five scenarios per AC #11

**For `route.ts` tests:** Extend existing `tests/api-batch-gnews.test.ts`:
- Add `jest.mock("rss-parser")` alongside existing `fetch` mock
- Add RSS integration test cases
- Spy on `db.insert(articles).values()` to verify `sourceType` — use `jest.spyOn(mockDb.chain, 'values')` (existing pattern in this file)
- Verify response JSON includes `gnewsArticles` and `rssArticles` in stats

**Mock pattern for rss-parser** (from Story 4-1 tests):
```typescript
jest.mock("rss-parser", () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn(),
  }));
});
```

**Promise.allSettled mock shapes** (Commandment XXIV — must match real return):
```typescript
// "Both succeed" — Promise.allSettled returns fulfilled results
// No need to mock allSettled itself. Mock fetchNews/fetchRssFeeds return values:
//   fetchNews() resolves → [{ title, url, source: { name }, description, urlToImage, publishedAt }]
//   fetchRssFeeds() resolves → same NewsArticle[] shape

// "RSS fails (empty)" — fetchRssFeeds returns [] (fulfilled, not rejected!)
// This is the COMMON failure mode. All feeds timed out internally.

// "RSS fails (crash)" — fetchRssFeeds throws (rejected promise)
// This is RARE. Mock by making the function throw: mockFetchRssFeeds.mockRejectedValue(new Error("module crash"))

// "Both fail" — both return [] or both reject
```

**Cross-source dedup test** (CRITICAL — validates sourceMap correctness):
```typescript
// Mock GNews returning article with URL "https://reuters.com/env/amazon"
// Mock RSS returning article with SAME URL "https://reuters.com/env/amazon"
// Assert: exactly ONE article inserted
// Assert: sourceType in DB insert is "rss" (RSS wins per merge order)
```

### What NOT to Change

- `scripts/rss.ts` — Do NOT modify. Story 4-1 delivered and reviewed this.
- `tests/rss.test.ts` — Do NOT modify. Already has 11 passing tests.
- Classification/scoring logic — Not in scope. Only the fetch + insert layer changes.
- `src/lib/types.ts` — `Article.sourceType` already defined.

### Schema Default Note

`src/db/schema.ts` line 60 has `sourceType: text("source_type").default("newsapi")`. The `"newsapi"` default is stale (from pre-GNews era). **Do NOT rely on this default** — always set `sourceType` explicitly on every insert. If an article somehow inserts without explicit sourceType, the `"newsapi"` value will be wrong. A future schema migration story should update this default to `"unknown"` — out of scope for 4-2.

### Pipeline Sync Warning

After this story, BOTH `scripts/batch.ts` AND `route.ts` have RSS integration. These pipelines are intentionally duplicated (see reconciliation plan). Any future change to RSS logic in one pipeline MUST be manually applied to the other until a consolidation story merges them. Add a `// SYNC:` comment at each duplicated block.

### Previous Story Intelligence (Story 4-1)

**Learnings from 4-1 code review:**
- `publishedAt` must be guarded — articles without dates are skipped (not silently assigned `new Date()`)
- `feed.title` can be `undefined` — always guard with `|| "Unknown"`
- `rss-parser` mock shape: omit missing fields (don't set `contentSnippet: null`) — the library omits rather than nulls
- Mock isolation: use `jest.resetModules()` + `jest.doMock()` for env var override tests

**Files created in 4-1 that this story depends on:**
- `scripts/rss.ts` — `fetchRssFeeds()` export (the function we're importing)
- `tests/rss.test.ts` — 11 unit tests (don't break these)

### Project Structure Notes

- Both batch pipelines (`scripts/batch.ts` and `route.ts`) are intentionally duplicated — the reconciliation plan (`docs/plans/2026-02-21-reconcile-batch-scoring-pipelines.md`) documents this as a known DRY violation with a future refactoring story
- `scripts/` directory: standalone Node.js scripts using `dotenv/config` + own Drizzle connection
- `src/app/api/` directory: Next.js API routes using `@/db` module
- Story 4-5 (align scoring pipeline) is already done and landed changes in `route.ts` — do NOT revert those

### References

- [Source: _bmad-output/planning-artifacts/epic-4.md — Story 4.2 AC and Dev Notes]
- [Source: scripts/batch.ts — fetchNews() line 94, article insert lines 768-781, dedup lines 150-161]
- [Source: scripts/rss.ts — fetchRssFeeds() export, NewsArticle interface]
- [Source: src/app/api/batch/route.ts — fetchNews() line 166, article insert lines 703-718, sourceType line 714]
- [Source: src/db/schema.ts — articles table, sourceType column with default "newsapi"]
- [Source: _bmad-output/implementation-artifacts/4-1-rss-feed-fetching-parsing.md — Previous story context]
- [Source: docs/plans/2026-02-21-reconcile-batch-scoring-pipelines.md — Pipeline duplication context]
- Note: Line numbers are approximate — verify against current source before implementing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None. Implementation proceeded without blockers.

### Completion Notes List

- **Task 1**: `scripts/batch.ts` now calls `Promise.allSettled([fetchNews(), fetchRssFeeds()])`. sourceMap built RSS-first (first-write-wins, RSS wins cross-source dedup). Combined dedup+blocked-domain filter applied to merged array. sourceType set on every article insert. `main()` exported + `require.main === module` guard added for testability. Count queries hardened with optional chaining (`?? 0`) — defensive fix that also unblocked DB mock testing.
- **Task 2**: `route.ts` gets inlined `fetchRssFeeds()` + `DEFAULT_FEEDS` (SYNC comment added). Same `Promise.allSettled` + sourceMap + dedup pattern. `sourceType` changed from hardcoded `"gnews"` to `sourceMap.get(a.url) ?? "gnews"`. Response stats include `gnewsArticles` and `rssArticles` raw counts (pre-dedup).
- **Task 3**: 5 integration tests in `tests/batch-rss-integration.test.ts`. DB mock via `jest.mock("drizzle-orm/node-postgres")` + `jest.mock("pg")`. RSS mock via `rss-parser` constructor mock. All 5 scenarios pass. Key lesson: `setupDb()` must run first (calls `mockDb.reset()` → `clearAllMocks`).
- **Task 4**: `tests/api-batch-gnews.test.ts` extended — `rss-parser` mock added before `route.ts` import (CJS source-order guarantee). Top-level `beforeEach` sets default empty RSS. 5 new tests: response stats (AC #9), sourceType differentiation, cross-source dedup, health warnings (AC #10). Key lesson: `mockRestore()` calls `mockReset()` which clears `mock.calls` — must assert BEFORE restore.
- **Task 5**: 306 tests pass, 0 regressions (up from 296 pre-story — 10 new tests added).
- **Code Review (claude-opus-4-6)**: 7 issues found (1H, 3M, 3L), all fixed. 308 tests pass post-review (+2 rejected-promise tests). Fixes: H1 publishedAt null guard in route.ts, M1 SYNC comment on rssParser rename, M2 logSpy assertion ordering, M3 rejected-promise RSS tests (both pipelines), L1-L2 SYNC comments on isBlockedDomain/BLOCKED_DOMAINS, L3 acknowledged (rename deferred).

### Change Log

- Implemented parallel GNews + RSS fetch pipeline in both `scripts/batch.ts` and `src/app/api/batch/route.ts` (Story 4.2, 2026-02-21)
- Code review fixes: publishedAt null guard in route.ts, SYNC comments on duplicated code (BLOCKED_DOMAINS, isBlockedDomain, rssParser), 2 rejected-promise RSS tests added, logSpy assertion ordering fixed (2026-02-21, reviewer: claude-opus-4-6)

### File List

- `scripts/batch.ts` — parallel fetch, sourceMap, sourceType on insert, export main() + guard
- `src/app/api/batch/route.ts` — rss-parser import, inlined fetchRssFeeds, parallel fetch, dynamic sourceType, response stats
- `tests/batch-rss-integration.test.ts` — new: 5 integration tests for scripts/batch.ts RSS integration
- `tests/api-batch-gnews.test.ts` — extended: rss-parser mock + 5 new RSS integration tests
- `_bmad-output/implementation-artifacts/4-2-integrate-rss-batch-pipeline.md` — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updated to review
