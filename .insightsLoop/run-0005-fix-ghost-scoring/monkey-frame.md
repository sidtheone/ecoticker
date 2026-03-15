# Monkey Frame — Fix Ghost Scoring in Batch Pipeline

## Finding 1 — Architecture: `inArray` with empty `fetchedUrls` generates invalid SQL

- **Technique:** Assumption Flip
- **Target:** Plan Change 2 (pre-query block), `src/lib/batch-pipeline.ts` line ~1121
- **Confidence:** 85
- **Impact:** breaks-build
- **Survived:** no

**Observation:** The plan assumes `topicArticles` always has at least one article when the loop body executes (`for (const [topicName, topicArticles] of topicGroups)`). This is true — the grouping logic on lines 1088-1095 only adds to the map when an article exists, so `topicArticles.length >= 1` is guaranteed. However, the frame's mock restructuring (Task 1) must also guarantee this invariant holds in tests. The real danger is the inverse: Drizzle's `inArray()` with an empty array. If somehow `fetchedUrls` were empty, `inArray(articles.url, [])` generates `WHERE url IN ()` — which is invalid SQL in PostgreSQL. The plan's code is safe because the loop guard prevents empty `topicArticles`, but the **mock tests in Task 1** must not test with an empty `topicArticles` array and accidentally pass `inArray(articles.url, [])` through a code path that bypasses the loop. The frame does not call this out — the sharpened AC tests "all duplicates" and "partial duplicates" but does not specify that `topicArticles` must be non-empty in every test scenario. This is an implicit contract between the loop structure and the pre-query that the tests could accidentally violate.

**Consequence:** If a future refactor moves the pre-query outside the `for` loop (e.g., batch all URLs in one query for performance), `inArray` with an empty array throws a PostgreSQL syntax error at runtime. The test mock won't catch it because it doesn't execute real SQL. The frame should note this invariant explicitly so Task 1 doesn't create a test that accidentally relies on it.

**Verdict:** Low-probability in the current diff, but the frame should document the invariant: "`fetchedUrls` is always non-empty because it's inside the `topicGroups` loop." One line in the frame's Task 3 description. Not a blocker — nice-to-have awareness.

**Revised Impact:** nice-to-have

---

## Finding 2 — Data: Correction script uses `GROUP BY topic_id` which misses zero-article topics

- **Technique:** Scale Shift
- **Target:** Frame Task 6 / Plan Change 5 — `scripts/fix-article-counts.ts` algorithm
- **Confidence:** 88
- **Impact:** values-gap
- **Survived:** yes

**Observation:** The correction script's algorithm (plan Change 5, frame Task 6) is:
1. `SELECT topic_id, COUNT(*) FROM articles GROUP BY topic_id`
2. `SELECT id, article_count FROM topics`
3. Compare and fix mismatches.

Step 1 only returns rows for topics that have at least one article. Topics with `article_count > 0` but zero actual articles (orphan topics — the exact ghost scoring symptom described in the bug) will NOT appear in the GROUP BY result. The comparison in step 3 therefore never sees these orphans. Their inflated `article_count` stays wrong.

This is the most common ghost scoring pattern: the batch pipeline scored and upserted a topic with `article_count = 8`, but all 8 article inserts hit `ON CONFLICT DO NOTHING`. The topic now has `article_count = 8` and zero rows in the `articles` table. The correction script misses it entirely.

**Consequence:** The correction script — the one-time cleanup tool specifically built to fix historical ghost scoring damage — silently skips the worst-case scenario it was designed to fix. Topics with inflated counts and zero articles remain broken. The frame's AC-4 says "mismatches detected in both directions (inflated and deflated)" but the algorithm can't detect inflated-to-zero because `GROUP BY` excludes zero-count groups.

**Fix:** Step 1 should use a LEFT JOIN from topics to articles (or a separate query for topics not in the GROUP BY result). The frame should amend Task 6's algorithm.

---

## Finding 3 — Integration: wt-2 correction script has no shared contract with wt-1 on what `articleCount` means post-fix

- **Technique:** Cross-Seam Probe
- **Target:** Frame worktree boundary — wt-1 (batch fix) vs wt-2 (correction script)
- **Confidence:** 72
- **Impact:** values-gap
- **Survived:** yes

**Observation:** The frame assigns wt-1 and wt-2 as fully independent — "No file overlap." But there IS a semantic contract between them that isn't documented:

- **wt-1** changes `articleCount` semantics from "cumulative count of all fetched articles across all runs" to "cumulative count of genuinely new articles across all runs."
- **wt-2** correction script compares `topics.article_count` against `COUNT(*) FROM articles WHERE topic_id = X` — which counts actual persisted rows.

These are different things. After wt-1's fix, `articleCount` will track new-article increments. But the correction script assumes `articleCount` should equal the total number of article rows in the DB for that topic. This happens to be correct *post-fix* (because `onConflictDoNothing` won't fire on pre-filtered articles), but only because of an implicit assumption: that the pre-query filter + `newArticles` loop means every `articleCount += newArticles.length` increment corresponds to exactly one successful insert.

The danger: if wt-2 is built and tested against the *current* (broken) code's semantics and merged before wt-1, or if someone runs the correction script and *then* wt-1's fix changes what `articleCount` means, the correction becomes a no-op or over-corrects. The frame says "Parallel: wt-1 and wt-2 run simultaneously" and "post-merge verification confirms wt-2 tests also pass" — but there's no explicit merge-order requirement. The correction script should run AFTER wt-1 is merged, not before. The frame doesn't state this.

**Consequence:** If the correction script is run against prod before the batch fix is deployed, it "fixes" counts to match current article rows, then the next batch run (still running old code) re-inflates them. The fix was wasted. If run after, it works correctly. The frame's parallelization plan implies simultaneous development but doesn't specify execution order on prod.

**Fix:** Add a one-line note to wt-2: "Correction script must be run AFTER wt-1's batch fix is deployed to production. Running it before the fix is deployed will produce correct counts that are immediately re-inflated by the next batch run."
