# Storm Report

## Introduced Issues

| Location | Issue | Severity | Suggestion |
|----------|-------|----------|------------|
| `scripts/dedup-score-history.ts:10-19` — dedupScoreHistory() | Missing `HAVING count(*) > 1` filter. Query returns ALL (topicId, recordedAt) groups including singletons, then issues DELETE WHERE ne(id, maxId) for each — which deletes zero rows from singletons but wastes N queries. `topicsAffected` overcounts (total groups, not duplicate groups). | medium | Add `.filter(g => Number(g.count) > 1)` in-memory after SELECT, or add HAVING clause. |
| `scripts/dedup-score-history.ts:31-41` — dedupScoreHistory() | `score_feedback` rows have FK `score_history_id` → `score_history.id` with no ON DELETE CASCADE or SET NULL. If any duplicate row being deleted is referenced by score_feedback, DELETE fails with FK violation. Scenario: batch runs twice in one day, user submits feedback on first run's row, dedup script runs, crashes. | high | Pre-existing architectural concern. No score_feedback rows exist (no feedback API yet). Risk: low in current state. Add ON DELETE SET NULL when feedback ships. |
| `src/lib/batch-pipeline.ts:1194-1230` — score_history upsert | `recordedAt` not set explicitly in .values() — relies on defaultNow() which resolves at insert time. Batch starting at 23:59 UTC that crosses midnight between the first and last topic's score insert will produce two rows for the same batch run on different dates. | low | Compute `recordedAt = new Date().toISOString().split('T')[0]` once before the topic loop and pass explicitly. |
| `tests/run-batch-pipeline.test.ts:351-369` — onConflictDoUpdate test | Asserts `onConflictDoUpdate.mock.calls.length >= 2` but does not verify the call is for score_history (topic + date target). Would pass if two topic upserts happen and zero score_history upserts. | medium | Assert at least one call includes scoreHistory.topicId and scoreHistory.recordedAt in target arg. |
| `src/lib/batch-pipeline.ts:1211-1230` — values/set duplication | 14 fields listed identically in both .values() and .set(). Field added to .values() but missed in .set() will silently drop data on conflict. | low | Use sql\`excluded.column\` references in set, or extract shared object. |

## Pre-existing Issues

| Location | Issue | Severity | Suggestion |
|----------|-------|----------|------------|
| `scripts/dedup-score-history.ts:19` — `.limit(Number.MAX_SAFE_INTEGER)` | Semantically meaningless limit used as Drizzle workaround to make the chain thenable in tests. Not a bug but obscures intent. | low | Remove or add comment explaining it's a mock-compatibility workaround. |
| `src/db/schema.ts:170` — scoreFeedback FK | `scoreHistoryId` references `scoreHistory.id` with no cascade. Pre-existing. Any delete of score_history rows will fail if feedback exists. | medium | Add `.onDelete("set null")` before feedback ships. |
