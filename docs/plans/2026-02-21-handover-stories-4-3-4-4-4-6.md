# Claude Handover: Implement Stories 4-3, 4-4, 4-6

**Date:** 2026-02-21
**Branch:** v3
**Stories:** 4-3 (Source Attribution Badge), 4-4 (RSS Feed Health Logging), 4-6 (Align Classification Pipeline)
**Total sprint status change needed:** 3 stories → `review`

---

## Context

EcoTicker is an environmental news impact tracker. Stack: Next.js 16 App Router + TypeScript + Tailwind CSS 4 + PostgreSQL 17 + Drizzle ORM. Tests run with `npx jest` (306 tests passing baseline). Pre-commit hooks enforce TypeScript + build + lint.

Story files live in `_bmad-output/implementation-artifacts/`. Sprint status in `_bmad-output/implementation-artifacts/sprint-status.yaml`. Project context rules in `_bmad-output/project-context.md`.

**Commandments to keep in mind:**
- Assert BEFORE `spy.mockRestore()` — `mockRestore()` internally calls `mockReset()` which clears `mock.calls`
- Set DB mock first in tests, THEN fetch/RSS mocks (setupDb order matters)
- Never commit broken code — TypeScript, build, lint must pass

---

## Recommended Implementation Order

1. **Story 4-3** — pure frontend, 2 files, ~20 minutes
2. **Story 4-6** — single function in route.ts, prompt replacement + logging
3. **Story 4-4** — breaking interface change, most files, do last

Run `npx jest` after each story before moving to the next.

---

## Story 4-3: Source Attribution Badge

**Story file:** `_bmad-output/implementation-artifacts/4-3-source-attribution-badge.md`
**Status target:** `review`

### What to change

**File 1: `src/components/ArticleList.tsx`**

Find the source span (around line 25):
```tsx
{a.source && <span>{a.source}</span>}
```

Replace with:
```tsx
{a.source && (
  <span>
    {a.source}
    {a.sourceType && (
      <span className="text-stone-400 dark:text-stone-500">
        {" · "}{a.sourceType === "rss" ? "RSS" : "GNews"}
      </span>
    )}
  </span>
)}
```

Rules:
- Only show badge when BOTH `a.source` AND `a.sourceType` are truthy and non-empty
- `"gnews"` → `"GNews"`, `"rss"` → `"RSS"` (capitalize for readability)
- Default/unknown sourceType → shows as `"GNews"` (acceptable per dev notes)
- Badge inherits `text-xs` from parent div — do NOT set font size again
- No new component, no new file — inline within existing span

**File 2: `tests/ArticleList.test.tsx`**

Extend the existing 7 tests (do NOT create a new file). The existing mock data has `sourceType: "news"` — update the base mock to `"gnews"`.

Add a new `describe("source attribution badge", ...)` block with these tests:
1. `sourceType: "gnews"` → renders `"· GNews"` text
2. `sourceType: "rss"` → renders `"· RSS"` text
3. `sourceType: null` → renders source name only, no badge
4. `sourceType: ""` (empty string) → renders source name only
5. `source: null` AND `sourceType: "rss"` → renders nothing (no orphaned badge)

Test pattern for sourceType variations:
```tsx
const articlesWithRss = mockArticles.map((a, i) =>
  i === 0 ? { ...a, sourceType: "rss" } : a
);
```

Use `queryByText` for absence checks; `getByText` or `screen.getByText` for presence. The badge text may be in a nested span — use `{ exact: false }` if needed.

### Acceptance Criteria checklist
- [ ] AC1: Badge shows `"Source Name · GNews"` or `"Source Name · RSS"`
- [ ] AC2: Muted text (`text-stone-400 dark:text-stone-500`)
- [ ] AC3: Dark mode variants present
- [ ] AC4: `sourceType` null/undefined/empty → source name only
- [ ] AC5: `source` null + `sourceType` exists → nothing rendered
- [ ] AC6-7: Tests for both types + graceful fallbacks
- [ ] AC8: All 7 existing ArticleList tests still pass

### Sprint status update
In `_bmad-output/implementation-artifacts/sprint-status.yaml`, change:
```yaml
4-3-source-attribution-badge: ready-for-dev
```
→ `in-progress` when starting, then → `review` when done.

Also update `Status: ready-for-dev` → `Status: review` in the story file itself.

### Files changed
- `src/components/ArticleList.tsx`
- `tests/ArticleList.test.tsx`

---

## Story 4-6: Align Classification Pipeline

**Story file:** `_bmad-output/implementation-artifacts/4-6-align-classification-pipeline.md`
**Status target:** `review`

### What to change

**Single file: `src/app/api/batch/route.ts`** — only `classifyArticles()` function (lines ~443-496)

#### Task 1: Replace the classification prompt

Current prompt at lines 453-478 is simplified (no newsworthiness test). Replace it with the full prompt from `scripts/batch.ts:238-287`.

The target prompt must include ALL of:
- `✅ INCLUDE articles about:` list
- `❌ REJECT articles about:` list (Q&A, listicles, question-titled articles, educational explainers, academic studies)
- `🔍 NEWSWORTHINESS TEST — An article must pass ALL of these:` (4 criteria)
- JSON schema with `"rejected"` and `"rejectionReasons"` arrays

Add at the top of the prompt string:
```typescript
// SYNC: classification prompt must match scripts/batch.ts
```

Do NOT change `scripts/batch.ts` — that is the gold standard, copy FROM it, never modify it.

#### Task 2: Update the parsed type and add rejection logging

After parsing the LLM response, update the `parsed` type:
```typescript
parsed: {
  classifications: Classification[];
  rejected?: number[];
  rejectionReasons?: string[];
}
```

Remove the raw debug log line (`console.log("LLM Classification Response:", response.substring(0, 500))`). Replace with structured rejection logging:

```typescript
if (parsed.rejected && parsed.rejected.length > 0) {
  console.log(`📋 Filtered ${parsed.rejected.length} irrelevant articles:`);
  parsed.rejectionReasons?.forEach((reason, i) => {
    const articleIdx = parsed.rejected![i];
    const article = newsArticles[articleIdx];  // NOTE: variable is newsArticles in route.ts
    if (article) {
      console.log(`   ❌ [${articleIdx}] "${article.title.substring(0, 60)}..." (${reason})`);
    }
  });
  const relevanceRate = ((newsArticles.length - parsed.rejected.length) / newsArticles.length * 100).toFixed(1);
  console.log(`✅ Relevance rate: ${relevanceRate}% (${newsArticles.length - parsed.rejected.length}/${newsArticles.length} articles)`);
}
```

**Important:** The variable in `route.ts` is `newsArticles`, not `articles` (that's `batch.ts`). Adjust accordingly.

#### Task 3: Verify (do NOT change) callLLM settings

- `classifyArticles()` should call `callLLM(prompt)` WITHOUT `{ jsonMode: true }` — classification must NOT use `response_format`
- `callLLM()` uses `temperature: 0` by default (from Story 4.5)
- These should already be correct — just verify them. If they're wrong, fix them.

### Test file: `tests/api-batch-gnews.test.ts`

Extend the existing test suite. The existing helper `makeClassificationResponse()` already returns `rejected: []` and `rejectionReasons: []` — great, tests are pre-structured.

Add these 4 new tests:

**Test 1: Rejection logging**
```typescript
it("logs rejected articles with titles and reasons", async () => {
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  // Mock classification to return rejected: [1], rejectionReasons: ["Q&A content"]
  // ... run batch ...
  const logCalls = logSpy.mock.calls.map(c => c.join(" "));
  expect(logCalls.some(c => c.includes("❌"))).toBe(true);
  expect(logCalls.some(c => c.includes("Filtered 1 irrelevant"))).toBe(true);
  logSpy.mockRestore(); // ALWAYS assert BEFORE mockRestore!
});
```

**Test 2: Relevance rate calculation**
```typescript
// 3 articles submitted, 1 rejected → "66.7%" in log output
```

**Test 3: Missing rejected array (graceful fallback)**
```typescript
// Mock returns { classifications: [...] } with no "rejected" field
// Assert: no crash, classifications still returned, no "❌" in logs
```

**Test 4: Prompt content validation**
```typescript
// Capture fetch call body for classification LLM call
// Assert prompt includes: "NEWSWORTHINESS TEST", "Q&A", "listicle", "rejected", "rejectionReasons"
// (Story 4.5 has a test around line 475 checking response_format — add near there)
```

Console spy pattern reminder:
```typescript
const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
// ... run test ...
const logCalls = logSpy.mock.calls.map(c => c.join(" "));
expect(logCalls.some(c => c.includes("Relevance rate:"))).toBe(true);
logSpy.mockRestore(); // CRITICAL: ASSERT BEFORE RESTORE
```

### Acceptance Criteria checklist
- [ ] AC1: route.ts classification prompt includes full newsworthiness test (4 criteria)
- [ ] AC2: route.ts prompt rejects Q&A/listicles/question-titles/explainers/academic studies
- [ ] AC3: route.ts prompt requests `rejected` and `rejectionReasons` in JSON response
- [ ] AC4: `classifyArticles()` logs rejected article titles with reasons
- [ ] AC5: `classifyArticles()` logs relevance rate
- [ ] AC6: `callLLM(prompt)` without jsonMode (temperature: 0 by default) — verified
- [ ] AC7: NO `response_format` on classification call — verified
- [ ] AC8: All existing tests pass
- [ ] AC9: New tests for rejection logging, relevance rate, graceful fallback when `rejected` absent
- [ ] AC10: `scripts/batch.ts` untouched

### Sprint status update
Change `4-6-align-classification-pipeline: ready-for-dev` → `in-progress` → `review`.

### Files changed
- `src/app/api/batch/route.ts`
- `tests/api-batch-gnews.test.ts`

---

## Story 4-4: RSS Feed Health Logging

**Story file:** `_bmad-output/implementation-artifacts/4-4-rss-feed-health-logging.md`
**Status target:** `review`

⚠️ **Breaking change warning:** `fetchRssFeeds()` return type changes from `Promise<NewsArticle[]>` to `Promise<{ articles: NewsArticle[]; feedHealth: FeedHealth[] }>`. All 5 locations below must be updated atomically or TypeScript will fail. Do NOT run `npx jest` between Task 1 and Task 4.

### Implementation order (do not skip)

#### Task 1: Modify `scripts/rss.ts` — add FeedHealth type, change return

Add and export the `FeedHealth` interface in `scripts/rss.ts` (alongside `NewsArticle`):
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

Add a local hostname helper (NOT exported):
```typescript
function feedHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
```

Change `fetchRssFeeds()` return type and wrap each `parseURL` call with timing:
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

Process results into `feedHealth` array:
- Success: `{ name: feed.title || feedHostname(url), url, status: "ok", articleCount: feed.items.length, durationMs }`
- Failure: extract `{ error, durationMs, url }` from `result.reason`, then `{ name: feedHostname(url), url, status: "error", articleCount: 0, durationMs, error: error instanceof Error ? error.message : String(error) }`

Return: `return { articles: allArticles, feedHealth };`

#### Task 2: Update `scripts/batch.ts` — destructure new return, add logging

Around line 624, find where `rssResult.value` is used as `NewsArticle[]`. Change to:
```typescript
const { articles: rssArticles, feedHealth } = rssResult.value;
```

After the existing Sources log line, add per-feed health lines:
```
  ✓ The Guardian (theguardian.com): 15 articles in 834ms
  ✗ EcoWatch (ecowatch.com): FAILED in 15001ms — timeout
```

Add summary line:
```
Feed health: 8/10 healthy, 2 failed [ecowatch.com: timeout, eea.europa.eu: 503]
```

Handle the crash case where `rssResult.status === "rejected"` (entire RSS fetch crashed, no `feedHealth` available):
```typescript
console.log("RSS feed health: unavailable (fetch crashed)");
```

#### Task 3: Update inlined `fetchRssFeeds()` in `src/app/api/batch/route.ts`

The inlined copy is at lines 269-307 and its caller at lines 617-663. Mirror ALL changes from Task 1 exactly:
- Same `FeedHealth` interface (with `// SYNC: FeedHealth type must match scripts/rss.ts` comment)
- Same timing wrapper pattern
- Same return shape `{ articles, feedHealth }`
- Mirror Task 2's logging in the POST handler caller
- Add `// SYNC:` comments on both the type and the logging block

#### Task 4: Update `tests/rss.test.ts` — all 11 tests

ALL existing assertions like:
```typescript
const result = await fetchRssFeeds();
expect(result).toHaveLength(N);
```
Must become:
```typescript
const { articles, feedHealth } = await fetchRssFeeds();
expect(articles).toHaveLength(N);
```

Also check `feedHealth` where the test can assert it (e.g., `expect(feedHealth).toHaveLength(RSS_FEEDS.length)`).

#### Task 5: Write new health logging tests in `tests/rss.test.ts`

Add a new `describe("feed health", ...)` block:
1. **All healthy:** all `feedHealth` entries have `status: "ok"`, positive `articleCount`, `durationMs >= 0`
2. **Mixed:** some `"ok"`, some `"error"` entries
3. **All failed:** `articles` is `[]`, all `feedHealth` entries are `"error"`
4. **Timeout error:** error string contains `"timeout"`
5. **HTTP error:** error string contains the status code
6. **Fallback name:** when `feed.title` is unavailable, `name` equals hostname

For timing: assert `durationMs >= 0`, NOT exact values (non-deterministic in tests).

Mock pattern:
```typescript
const mockParseURL = jest.fn()
  .mockResolvedValueOnce({ title: "The Guardian", items: [mockItem] }) // success
  .mockRejectedValueOnce(new Error("timeout"))                          // failure
  .mockResolvedValueOnce({ title: "Grist", items: [] });                // success, 0 articles
```

#### Task 6: Update `tests/batch-rss-integration.test.ts` and `tests/api-batch-gnews.test.ts`

Both files mock `fetchRssFeeds`. Update ALL mocks to return the new shape:
```typescript
// Old:
mockFetchRssFeeds.mockResolvedValue([...articles])
// New:
mockFetchRssFeeds.mockResolvedValue({ articles: [...articles], feedHealth: [] })
```

An empty `feedHealth: []` array is fine for tests that don't assert on health logging.

### Acceptance Criteria checklist
- [ ] AC1: Per-feed status line in batch log (name, duration, article count, success/failure)
- [ ] AC2: Failed feeds include error message in log
- [ ] AC3: Summary line format: `"Feed health: 8/10 healthy, 2 failed [name: reason]"`
- [ ] AC4: Health data in batch log only — no new API endpoint, no new DB table
- [ ] AC5: Per-feed timing uses `Date.now()` before/after each `parseURL`
- [ ] AC6: Failed feed name derived from hostname (no `feed.title` on failure)
- [ ] AC7: Tests for all-healthy, mixed, all-failed scenarios
- [ ] AC8: Tests verify timeout vs HTTP error differentiation
- [ ] AC9: All existing RSS and batch tests continue to pass
- [ ] AC10: BOTH `scripts/rss.ts` AND `route.ts` inlined copy get the same changes

### Sprint status update
Change `4-4-rss-feed-health-logging: ready-for-dev` → `in-progress` → `review`.

### Files changed
- `scripts/rss.ts`
- `scripts/batch.ts`
- `src/app/api/batch/route.ts`
- `tests/rss.test.ts`
- `tests/batch-rss-integration.test.ts`
- `tests/api-batch-gnews.test.ts`

---

## Final Validation (after all 3 stories)

```bash
npx tsc --noEmit       # TypeScript must pass
npm run build          # Build must succeed
npx jest               # All tests must pass (306+ baseline → expect ~330+)
```

Verify in `_bmad-output/implementation-artifacts/sprint-status.yaml`:
```yaml
4-3-source-attribution-badge: review
4-4-rss-feed-health-logging: review
4-6-align-classification-pipeline: review
```

Each story file's `Status:` field should also read `review`.

---

## What NOT to change

- `scripts/batch.ts` — story 4-6 AC #10 explicitly forbids changes
- `src/lib/types.ts` — `FeedHealth` stays in `scripts/rss.ts` only (not a UI/API type)
- Any scoring logic (`scoreTopic`, `processScoreResult`, `callLLM`)
- `epic-5` or `epic-6` stories — not in scope
- `src/db/schema.ts` — no new columns needed for any of these stories
