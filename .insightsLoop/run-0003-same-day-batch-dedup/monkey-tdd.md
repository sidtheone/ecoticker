# Monkey — TDD

**Technique:** Cross-Seam Probe
**Target:** `tests/dedup-score-history.test.ts` — missing contract for FK child rows in `score_feedback`; implementation target `scripts/dedup-score-history.ts` DELETE path
**Confidence:** 92
**Survived:** yes

## Observation

The test suite validates that dedup deletes the correct score_history rows (Contracts 3, 4, 6), but every test scenario uses score_history rows with zero child references. In production, `score_feedback.score_history_id` is a foreign key pointing at `score_history.id` (`src/db/schema.ts:169`) with no `onDelete` cascade — PostgreSQL defaults to `NO ACTION`. When `dedupScoreHistory()` tries to delete a duplicate score_history row that has score_feedback rows referencing it, PostgreSQL will throw:

```
ERROR: update or delete on table "score_history" violates foreign key constraint
"score_feedback_score_history_id_score_history_id_fk" on table "score_feedback"
```

The mock-based tests cannot catch this because `mockDb.mockDelete()` always resolves successfully — it never simulates FK constraint violations. No test exercises the cross-table seam between score_history and score_feedback.

## Consequence

Running the dedup script against a production database where users have submitted score feedback will crash mid-execution. Depending on whether the implementation deletes row-by-row or in bulk:

- **Row-by-row without a transaction:** Partial dedup — some groups cleaned, others left with orphaned state. The subsequent `uniqueIndex` migration will still fail on the un-deduped groups.
- **Bulk DELETE in a transaction:** Entire dedup rolls back, zero rows cleaned. The uniqueIndex migration cannot proceed at all.

**Current risk:** LOW — feedback API doesn't exist yet, no score_feedback rows in production. This concern applies before feedback ships and before running the dedup script on a database with feedback data. Documented in plan.md Architecture section.
