# Plan: Same-Day Batch Dedup

## Story

Running the batch pipeline more than once on the same calendar day appends duplicate `score_history` rows for each topic — one per run. There is no `UNIQUE(topic_id, recorded_at)` constraint, and the INSERT has no conflict clause. The `recorded_at` column is a `DATE` type, so two runs at 06:00 and 10:00 produce two rows with identical `(topic_id, recorded_at)` values. Charts show duplicate data points; the 4-hour GitHub Actions cron means up to 6 duplicates per topic per day in production.

## Intent

Make the score_history INSERT idempotent. A topic should have at most one score_history row per calendar day. If batch runs multiple times in a day, the latest run wins — scores, reasoning, and raw LLM response are updated in place. Existing duplicate rows in production are removed by a one-time dedup script before the schema constraint is applied.

## Out of Scope

- Threshold duplication fix (separate story)
- articleCount drift fix (separate story)
- UrgencyBadge INSUFFICIENT_DATA guard
- Any changes to the score_history query layer or UI
- Making score_history immutable / append-only (documented decision below)

## Architecture

**Approach B — schema constraint + pipeline fix + dedup script**

Three changes, in deployment order:

1. `scripts/dedup-score-history.ts` — run first to clean up existing duplicates
2. `drizzle-kit push` — applies the new `uniqueIndex` to PostgreSQL
3. Batch pipeline deploy — `onConflictDoUpdate` now has a constraint to target

The INSERT changes from:
```typescript
await db.insert(scoreHistory).values({ topicId, score, ... });
```
to:
```typescript
await db.insert(scoreHistory)
  .values({ topicId, score, ... })
  .onConflictDoUpdate({
    target: [scoreHistory.topicId, scoreHistory.recordedAt],
    set: { score, healthScore, ecoScore, econScore,
           healthLevel, ecoLevel, econLevel,
           healthReasoning, ecoReasoning, econReasoning,
           overallSummary, impactSummary, rawLlmResponse, anomalyDetected }
  });
```

**Documented decision — mutable snapshot contract:**
`score_history` is a **mutable daily snapshot**, not an immutable audit log. The `onConflictDoUpdate` strategy preserves the row's `id` (the serial PK) but overwrites all scored fields. The `scoreFeedback` table has a FK to `score_history.id` — this FK is intact after an update. However, when `scoreFeedback` ships its API routes, feedback should reference `(topic_id + recorded_at)` rather than `score_history.id` if immutability is required. This decision must be revisited before the feedback feature ships.

## Tasks

- [ ] Task 1 — Write `scripts/dedup-score-history.ts` (independent)
  - Accepts `--dry-run` flag; defaults to dry-run for safety
  - Finds all (topic_id, recorded_at) pairs with more than one row
  - For each duplicate group, keeps the row with the highest `id` (latest insert), deletes the rest
  - Prints: topics affected, rows deleted (or would delete in dry-run)
  - Exit 0 on success, non-zero on DB error

- [ ] Task 2 — Add `uniqueIndex` to `schema.ts` (independent at code level; must deploy before Task 3 takes effect)
  ```typescript
  uniqueIndex('idx_score_history_topic_date')
    .on(scoreHistory.topicId, scoreHistory.recordedAt)
  ```

- [ ] Task 3 — Change INSERT in `batch-pipeline.ts:1194` to `onConflictDoUpdate` (depends on Task 2 being deployed)

- [ ] Task 4 — Tests
  - `tests/run-batch-pipeline.test.ts`: add test verifying that when batch inserts score_history for a topic, the insert uses `onConflictDoUpdate` (not naked insert)
  - `tests/dedup-score-history.test.ts`: add tests for dedup logic — groups correctly, keeps highest id, dry-run mode prints without deleting

## Key Files

| File | Action | What changes |
|------|--------|-------------|
| `src/db/schema.ts` | Modify | Add `uniqueIndex` on `(topicId, recordedAt)` to `scoreHistory` table |
| `src/lib/batch-pipeline.ts` | Modify | Line ~1194: change naked INSERT to `.onConflictDoUpdate()` |
| `scripts/dedup-score-history.ts` | Create | One-time dedup script with `--dry-run` |
| `tests/run-batch-pipeline.test.ts` | Modify | Add test asserting `onConflictDoUpdate` is called |
| `tests/dedup-score-history.test.ts` | Create | Tests for dedup logic |

## Challenge

### Triage
Small — 2 modified files, 1 new file, 2 test files. No new interfaces. Existing patterns (scripts/, mock-db) reused throughout.

### Values Alignment
- "Three lines beat a clever abstraction" ✓ — no new abstractions, just adding a conflict clause and a uniqueIndex
- "Delete before you add" ✓ — dedup script removes bad data rather than papering over it
- "Untested code doesn't leave the engine" ✓ — both pipeline change and dedup script get tests

### Dependency Map
```
Task 1 (dedup script)     — independent, code can be written any order
Task 2 (schema uniqueIndex) — independent at code level
Task 3 (onConflictDoUpdate) — code independent, but DEPLOYMENT must follow Task 2
Task 4 (tests)            — depends on Tasks 1-3 being written

Deployment order (CRITICAL):
  1. Run dedup script on prod (clears duplicates)
  2. drizzle-kit push (adds constraint — would fail if dupes still existed)
  3. Deploy pipeline code (onConflictDoUpdate now has target to resolve against)
```

### Top Failure Modes
1. **Schema push before dedup** — `CREATE UNIQUE INDEX` will fail if duplicate `(topic_id, recorded_at)` rows exist. Always run dedup script first.
2. **Pipeline deployed before schema push** — naked INSERT becomes `onConflictDoUpdate` in code, but without the DB constraint it has nothing to resolve against. Not a runtime error, just no dedup effect until push.
3. **Dedup script deletes wrong rows** — mitigated by `--dry-run` default. Always preview before committing.

### Monkey Finding (Plan step)
**Technique:** Assumption Flip | **Confidence:** 72 | **Survived:** yes

`scoreFeedback.score_history_id` FK points at `score_history.id`. With `onConflictDoUpdate`, the `id` is preserved but all scored fields are overwritten. No current breakage (feedback API doesn't exist yet), but the contract between `score_history` mutability and `scoreFeedback` immutability must be explicitly decided before feedback ships. Documented in Architecture above.

### Go/No-Go
**GO.** Triage confirmed small. Deployment ordering documented. Monkey concern captured and doesn't block. Tests defined. Values aligned.
