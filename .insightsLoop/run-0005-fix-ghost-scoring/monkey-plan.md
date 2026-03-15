# Monkey Findings — Plan Step

**Story:** Fix batch pipeline ghost scoring
**Lens:** stateful
**Step:** Plan

---

## Finding #1 — TOCTOU Race: Pre-Query Set Is Stale by the Time Articles Insert

**Technique:** Replay Probe
**Target:** Proposed pre-query (`SELECT url FROM articles WHERE url IN (...)`) + guard clause in `src/lib/batch-pipeline.ts` lines ~1106-1190
**Confidence:** 82
**Impact:** breaks-build
**Survived:** yes

**Observation:**
The plan proposes: query existing URLs into a Set, filter to `newArticles`, skip if empty. But the pre-query and the article insert are not inside a transaction. If two batch runs execute concurrently (cron overlap, manual trigger during cron, two API calls), Run A pre-queries and sees 0 existing URLs. Run B pre-queries at the same moment and also sees 0 existing URLs. Both proceed to score. Both insert articles. `onConflictDoNothing` silently drops the loser's duplicates — but the score has already been upserted by both runs. The ghost scoring bug returns: two score history entries on the same day (overwriting each other via the date-granularity unique constraint on `score_history`), `previousScore` rotated twice (corrupted), and `articleCount` inflated by both runs adding `newArticles.length`.

The plan has no mention of transactions, row-level locks, or advisory locks. The pre-query Set is a point-in-time snapshot with no serialization guarantee.

**Consequence:**
The fix works perfectly for sequential runs but fails under concurrency. The Alpine crond + API endpoint + CLI all call `runBatchPipeline()`. There's nothing preventing overlap. The acceptance criteria ("running the batch pipeline twice with the same news data produces no score changes on the second run") only holds if "twice" means "sequentially." If it means "concurrently," ghost scoring returns with corrupted `previousScore` as a bonus.

---

## Finding #2 — Score History Still Appends on All-Duplicate Runs (Plan Covers articleCount but Not scoreHistory)

**Technique:** Assumption Flip
**Target:** Proposed guard clause: `if (newArticles.length === 0) continue` — and its relationship to `scoreHistory` insert at line 1194-1230
**Confidence:** 90
**Impact:** values-gap
**Survived:** no

**Observation:**
The plan says: if `newArticles.length === 0`, skip the entire topic — "no score, no upsert, no history, no keywords." Good. The guard clause skips everything. But flip the assumption: what if `newArticles.length > 0` but all the "new" articles are genuinely new duplicates that slipped through because they have slightly different URLs (query params, trailing slashes, http vs https, `www.` prefix differences)? The pre-query Set does exact URL matching. `https://example.com/story` and `https://example.com/story?utm_source=twitter` are both "new" — both pass the guard — and now the topic gets re-scored with effectively the same content, producing a score history entry that's a near-duplicate of the previous day's.

The value "Validate at the door" says every external input is validated at the boundary. GNews URLs are external input. The plan treats URLs as canonical identifiers without any normalization — no stripping of query params, no protocol normalization, no trailing-slash handling.

**Consequence:**
`articleCount` inflates with near-duplicate articles that carry different tracking parameters. The ghost scoring bug is reduced but not eliminated — the LLM re-scores on "new" articles that are content-identical to existing ones, producing phantom score changes. The fix addresses the exact-match case but not the semantic-duplicate case.

---

## Finding #3 — Correction Script Has No Idempotency Guard and No Audit Trail

**Technique:** Existence Question
**Target:** Proposed `scripts/fix-article-counts.ts` (item 6 in the plan)
**Confidence:** 75
**Impact:** values-gap
**Survived:** yes

**Observation:**
The plan says: create a correction script that recalculates `articleCount` from actual article rows, with `--dry-run` flag. But should this script exist at all? If the fix is correct, `articleCount` will be accurate going forward. The correction script exists to fix historical data — but it has no audit trail. The batch pipeline logs to `audit_logs` table for every write operation (value: "Default closed" — you track every mutation). The correction script proposes to bulk-update every topic's `articleCount` outside of the audit system.

Additionally, the script has no idempotency guard. Running it twice is harmless (same result), but running it *during* a batch run is not — it recalculates `articleCount` from rows while the batch is actively inserting. The corrected count could be immediately re-inflated or, worse, the correction overwrites a count that includes legitimately new articles from an in-progress batch.

The plan says it "follows dedup-score-history.ts pattern" but doesn't specify whether that pattern includes audit logging or concurrent-run protection.

**Consequence:**
A one-shot correction script that mutates production data with no audit trail violates "Default closed" (every mutation tracked). And if someone runs it as a cron job or re-runs it "just to be safe," it races with active batch runs. The script either needs audit logging and a batch-run lock, or it should be a migration that runs once and self-destructs.

---
