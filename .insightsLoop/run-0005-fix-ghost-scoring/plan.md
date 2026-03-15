# Plan: Fix Ghost Scoring in Batch Pipeline

## Story
Fix batch pipeline ghost scoring — score updates without new articles, articleCount inflated across runs, stale orphan topics with no sources. Single story, no breakdown needed.

## Intent
The batch pipeline scores topics and upserts to DB before checking whether fetched articles are actually new. `ON CONFLICT DO NOTHING` silently drops duplicates after the score is already committed. `articleCount` uses arithmetic (`+ topicArticles.length`) instead of actual insert count. This fix adds a pre-query guard that skips scoring entirely when no genuinely new articles exist, and uses actual new-article count for `articleCount`. A one-time correction script fixes historical inflation.

## Out of Scope
- Purging ghost score history rows (already committed, LLM-computed, no retroactive correction possible)
- Changing `backfill-rescore` mode (separate code path, unaffected)
- Restructuring the loop body (minimal diff approach)
- URL normalization (pre-existing: `articles.url` UNIQUE constraint already uses exact matching)
- Concurrent-run protection (single-concurrency by design: rate limit 2/hour, daily cron)

## Architecture
Minimal diff — 4 targeted changes inside the existing loop, no function extraction.

### Change 1: Import
Add `inArray` to the `drizzle-orm` import on line 16.

### Change 2: Pre-query + skip guard (after line 1119, before `scoreTopic()`)
```typescript
// Pre-check: which fetched URLs are genuinely new?
// NOTE: This query sees committed rows only. Single-concurrency assumed
// (daily cron + rate limit 2/hour). If concurrent runs are ever added,
// this needs a SELECT ... FOR UPDATE or advisory lock.
const fetchedUrls = topicArticles.map((a) => a.url);
const existingRows = await db
  .select({ url: articles.url })
  .from(articles)
  .where(inArray(articles.url, fetchedUrls));
const existingUrlSet = new Set(existingRows.map((r) => r.url));
const newArticles = topicArticles.filter((a) => !existingUrlSet.has(a.url));

// Skip entire topic if all articles are duplicates.
// This intentionally skips: scoring, topic upsert, score_history, keywords.
// No score change, no previousScore rotation, no phantom history row.
if (newArticles.length === 0) {
  console.log(`  ${topicName}: skipped (all ${topicArticles.length} articles are duplicates)`);
  continue;
}
```

### Change 3: Fix articleCount in topic upsert (line 1166)
```
- articleCount: sql`${topics.articleCount} + ${topicArticles.length}`,
+ articleCount: sql`${topics.articleCount} + ${newArticles.length}`,
```

### Change 4: Insert only new articles (lines 1176-1191)
Replace the article insert loop to iterate `newArticles` instead of `topicArticles`. This eliminates the need for a per-article counter guard — `newArticles.length` IS the count. `onConflictDoNothing` remains as a safety net but should never fire.

```typescript
// Insert only genuinely new articles (pre-filtered above).
// onConflictDoNothing retained as safety net — should be a no-op.
for (const a of newArticles) {
  await db
    .insert(articles)
    .values({
      topicId,
      title: a.title,
      url: a.url,
      source: a.source?.name || null,
      summary: a.description,
      imageUrl: a.urlToImage,
      sourceType: sourceMap.get(a.url) ?? "gnews",
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
    })
    .onConflictDoNothing({ target: articles.url });
}
articleCount += newArticles.length;
```

### Change 5: Correction script (`scripts/fix-article-counts.ts`)
One-time script following `dedup-score-history.ts` pattern. Fixes ANY mismatch (inflated or deflated). `--dry-run` flag for preview.

Algorithm:
1. `SELECT topic_id, COUNT(*) as actual_count FROM articles GROUP BY topic_id`
2. `SELECT id, article_count FROM topics`
3. For each mismatch: `UPDATE topics SET article_count = actual WHERE id = ?`

## Tasks
- [ ] Task 1: Write failing tests (TDD) — tests for skip-on-all-dupes, partial-dupes-count, correction script. **Must restructure `mockForDaily` to discriminate by table (articles vs topics) instead of selectCallCount ordering** — the new pre-query SELECT breaks the existing counter.
- [ ] Task 2: Add `inArray` import to batch-pipeline.ts line 16
- [ ] Task 3: Insert pre-query block + skip guard after line 1119
- [ ] Task 4: Fix `articleCount` in topic upsert (line 1166: `topicArticles.length` → `newArticles.length`)
- [ ] Task 5: Replace article insert loop — iterate `newArticles`, use `articleCount += newArticles.length`
- [ ] Task 6: Create `scripts/fix-article-counts.ts` + `tests/fix-article-counts.test.ts`
- [ ] Task 7: Run full test suite (`npx jest`) + build (`npm run build`) + TypeScript check

## Key Files
| File | Action |
|------|--------|
| `src/lib/batch-pipeline.ts` | Modify (lines 16, 1106-1191) |
| `src/db/schema.ts` | Reference only (articles.url unique constraint) |
| `tests/run-batch-pipeline.test.ts` | Modify (new test cases, mock restructuring) |
| `tests/helpers/mock-db.ts` | Possibly modify (if mock restructuring is needed here) |
| `scripts/fix-article-counts.ts` | Create |
| `tests/fix-article-counts.test.ts` | Create |

## Acceptance Criteria
1. Running the batch pipeline twice with the same news data produces no score changes on the second run — topics with all-duplicate articles are skipped entirely.
2. Running the batch pipeline with a mix of new and duplicate articles increments articleCount only by the number of genuinely new articles inserted.
3. The `articlesAdded` field in the pipeline result reflects actual DB inserts, not fetched article count.
4. Running `scripts/fix-article-counts.ts --dry-run` reports topics with mismatched counts (in either direction) without modifying them; running without --dry-run corrects them.

## Challenge

### Triage
small — bug fix in one file + one-time script. Not greenfield.

### Lens
stateful

### Values Alignment
- "Three lines beat a clever abstraction" — no new functions, no restructuring. 15 lines of guard logic, each earns its place. YAGNI-clean.
- "Delete before you add" — removes the broken `articleCount++` counter, replaces arithmetic with reality.
- "Untested code doesn't leave the engine" — TDD gate: tests written before implementation.
- "Validate at the door" — the pre-query IS validation at the door. External data (fetched articles) checked against DB state before any scoring or writes.

### Dependency Map
```
Task 1 (tests + mock restructure) ← independent, MUST be first (TDD)
Task 2 (import) ← independent
Task 3 (pre-query + guard) ← depends on Task 2
Task 4 (fix upsert) ← depends on Task 3 (needs newArticles in scope)
Task 5 (fix insert loop) ← depends on Task 3 (needs newArticles in scope)
Task 6 (correction script) ← independent of Tasks 2-5
Task 7 (verification) ← depends on all above
```

Tasks 2-5 are sequential. Tasks 1 and 6 are independent and can parallelize.

### Top Failure Modes
1. **Mock restructuring breaks existing tests** — `mockForDaily` uses selectCallCount ordering. Adding a new SELECT (URL pre-query) shifts the count. Mitigation: restructure mock to discriminate by table reference, not call order.
2. **Correction script races with active batch run** — if run concurrently with a batch, article counts could be inconsistent. Mitigation: run during maintenance window, or add advisory lock. Low risk given it's a one-time manual script.

### Go/No-Go
**GO.** Small, well-scoped bug fix with clear acceptance criteria. Risks are manageable. The mock restructuring (Storm #1) is the highest implementation risk — tackle it first in Task 1.
