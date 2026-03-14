# Storm Report

## Lens: `stateful`

Reviewed: `src/lib/batch-pipeline.ts` (lines 1115-1215), `scripts/fix-article-counts.ts`, `tests/batch-rss-integration.test.ts` mock fix.

---

## Introduced Issues

| # | Location | Issue | Severity | Suggestion |
|---|----------|-------|----------|------------|
| 1 | `batch-pipeline.ts:1141` | **scoreTopic receives all articles, not just new ones.** After filtering to `newArticles`, the code calls `scoreTopic(topicName, topicArticles, previousScores)` — passing the unfiltered `topicArticles` array. The LLM scores based on all fetched articles (including duplicates already in the DB), but only `newArticles.length` gets persisted as the count. **Scenario:** Topic "Deforestation" has 8 articles in DB. Batch fetches 10 articles: 8 are duplicates, 2 are new. The pre-check correctly filters to 2 new articles. But `scoreTopic` receives all 10 — the LLM prompt lists 10 article summaries, producing a score weighted by 10 articles' worth of evidence. The topic's `articleCount` increments by 2, but its score reflects 10 articles. On the next run, if the same 10 appear again plus 1 new one, the LLM sees 11 articles but count increments by 1. The score-to-article-count relationship drifts. This is a reduced version of the original ghost scoring bug: the score isn't phantom anymore, but it's still influenced by stale data the system already processed. | **High** | Change line 1141 to `scoreTopic(topicName, newArticles, previousScores)`. The LLM should score based only on genuinely new evidence. Same fix for line 1143 (`imageUrl` selection) — use `newArticles` so image doesn't come from a duplicate article that might belong to a different topic now. |
| 2 | `batch-pipeline.ts:1143` | **imageUrl selected from `topicArticles` not `newArticles`.** `topicArticles.find((a) => a.urlToImage)` may select an image from a duplicate article. Minor data integrity issue — the image might be from an article that was already processed under a different topic (if the LLM reclassified it). | **Low** | Change to `newArticles.find(...)`. |
| 3 | `fix-article-counts.ts:18` | **`db` parameter typed as `any`.** The exported function signature is `fixArticleCounts(db: any, dryRun: boolean)`. This defeats TypeScript's type safety — callers can pass anything without a compile error. The parameter shadows the module-level `db` import, which is correct for testability, but `any` means typos in Drizzle method names won't be caught. | **Low** | Type as `NodePgDatabase<typeof schema>` or at minimum `Pick<NodePgDatabase, 'select' | 'update'>`. |
| 4 | `fix-article-counts.ts:73-96` | **CLI entry point calls `process.exit(1)` inside `.catch()` before `.finally()`.** `process.exit(1)` terminates immediately — `pool.end()` in `.finally()` may not execute, leaving the PostgreSQL connection open. Node.js does not guarantee `.finally()` runs after `process.exit()`. In practice this is a one-shot script so the OS reclaims the connection, but it violates the cleanup contract. | **Low** | Move `pool.end()` into both the `.then()` and `.catch()` blocks, or use `try/catch/finally` in an async IIFE. |

## Consistency

| # | Location | Inconsistency | Canonical Form | Action |
|---|----------|---------------|----------------|--------|
| 1 | `batch-pipeline.ts:1141` vs `1131,1166,1186,1197,1212` | `topicArticles` used for scoring and image selection while `newArticles` used everywhere else (count, insert, skip check). Within the same 80-line block, two different arrays represent "the articles we care about." The fix intended `newArticles` to be the canonical array after filtering, but scoring escaped the refactor. | `newArticles` after line 1131 | Change lines 1141 and 1143 to use `newArticles`. |
| 2 | `fix-article-counts.ts:69` vs return type | `topicsFixed` is set to `mismatches.length` — this counts topics with mismatches, not topics actually fixed (in dry-run mode, zero topics are fixed but `topicsFixed` is nonzero). The name implies mutation happened. | Rename to `mismatchCount` or split into `mismatchCount` + `topicsFixed` (0 in dry-run). | Rename field or adjust semantics so dry-run returns `topicsFixed: 0`. |

## Pre-existing Issues

| # | Location | Issue | Severity | Suggestion |
|---|----------|-------|----------|------------|
| 1 | `batch-pipeline.ts:1197-1211` | **Sequential per-article INSERT in a loop.** Each new article is inserted with a separate `await db.insert()` call. For a topic with 10 new articles, this is 10 round-trips. Drizzle supports batch insert via `.values([...])` with a single call. Not introduced by this change, but the refactor from `topicArticles` to `newArticles` was the opportunity to batch. | **Low** | `await db.insert(articles).values(newArticles.map(a => ({...}))).onConflictDoNothing()` — one round-trip. |
| 2 | `tests/batch-rss-integration.test.ts:142-152` | **`setupDb` mock is structurally blind to the new pre-query SELECT.** The mock uses a single thenable chain — `mockSelect([])` makes every `db.select().from(...).where(...)` resolve to `[]`. The initial topics query (with `leftJoin.groupBy`) and the per-topic articles pre-query (with `where(inArray(...))`) both resolve to the same value. This works by accident (empty = no existing topics and no existing articles), but any test that passes `existingTopics` to `setupDb` will also return those topics when the pre-query checks for existing article URLs. The dedicated `run-batch-pipeline.test.ts` handles this correctly with table-discriminated mocks, but this file does not. | **Medium** | Add table-discriminated mock (similar to `mockForDaily` in `run-batch-pipeline.test.ts`) if any test in this file ever needs to pass existing topics. Add a comment documenting the limitation. |

---

**Values alignment check:**
- "Untested code doesn't leave the engine" — Finding #1 (scoring with wrong array) has test coverage that passes because the mock doesn't distinguish which articles the LLM receives. The test asserts the correct `articleCount` but doesn't verify that `scoreTopic` was called with `newArticles` vs `topicArticles`. The bug ships with green tests.
- "Three lines beat a clever abstraction" — The fix is clean and readable. No over-engineering.
- "Read it top to bottom" — The `topicArticles`/`newArticles` split at line 1131 is readable, but the inconsistent usage at 1141/1143 breaks the top-to-bottom expectation. A reader would assume everything after the filter uses the filtered array.
