# Monkey — Build

**Technique:** Cross-Seam Probe
**Target:** `scripts/dedup-score-history.ts:9-25` vs `src/lib/batch-pipeline.ts:1212-1230` — conflicting survivor selection strategies
**Confidence:** 89
**Survived:** yes

## Observation

The batch pipeline and the dedup migration script made opposite assumptions about which row is the canonical survivor when duplicates exist for the same `(topicId, recordedAt)`.

**Batch pipeline** uses `onConflictDoUpdate` — it keeps the *existing row's `id`* and overwrites its data with the new values. The surviving row is the one with the **lowest `id`** (the original insert), now carrying the latest scores.

**Dedup script** uses `max(id)` to pick the survivor and deletes all rows where `id != maxId`. It assumes the row with the **highest `id`** has the best data because it was inserted most recently.

These two strategies directly contradict each other for rows that exist after the unique index is live. For the pre-migration cleanup scenario (the script's intended use), `maxId` is correct — the most recently inserted row has the freshest scores. But the script is exported as a reusable function — if called after the batch pipeline has already been running with the constraint active, `maxId` picks the wrong survivor.

Also: the query on line 10-19 has no `HAVING count(*) > 1`. It returns ALL (topicId, recordedAt) groups. `topicsAffected = groups.length` is inflated to total groups, not duplicate groups. Dry-run reports "N topic/date groups" where N includes singletons.

## Consequence

1. **Misleading dry-run audit.** A clean DB with 12 topics returns `topicsAffected: 12, rowsDeleted: 0` instead of `topicsAffected: 0, rowsDeleted: 0`. Violates "Insight, not information."
2. **Latent data-loss if re-run post-migration.** If called after the batch pipeline has been running with the unique index active, `maxId` silently picks the stale duplicate over the `onConflictDoUpdate`-updated canonical row.
