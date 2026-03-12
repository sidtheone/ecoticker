# Monkey — Frame

**Technique:** Existence Question
**Target:** `src/app/api/seed/route.ts` and `scripts/seed.ts` — naked `db.insert(scoreHistory)` without `onConflictDoUpdate`, which will crash after the `uniqueIndex` is deployed (Task 2)
**Confidence:** 91
**Survived:** yes

## Observation

The plan's scope covers exactly one INSERT site: `src/lib/batch-pipeline.ts:1194`. But there are two other callers that insert into `score_history` with naked INSERTs and no conflict clause:

1. **`src/app/api/seed/route.ts`** — the API seed endpoint inserts days of score history per topic. It explicitly sets `recordedAt` as a `YYYY-MM-DD` string. If you call `POST /api/seed` twice, day-0 gets the same `recordedAt` value both times. After the `uniqueIndex` is deployed, the second seed call will throw a unique constraint violation and crash mid-seed, leaving the database in a partially-seeded state.

2. **`scripts/seed.ts`** — the CLI seed script has the same pattern. Same crash on re-run after the constraint is live.

The plan identifies the batch pipeline as the only INSERT site to fix. The seed paths are not mentioned in the Key Files table, the Task list, or the Out of Scope section. They are simply invisible.

## Consequence

After Task 2 ships (the `uniqueIndex`), both seed paths become broken. Running `POST /api/seed` or `npx tsx scripts/seed.ts` more than once on the same day — or at all if prior data exists — will throw `duplicate key value violates unique constraint "idx_score_history_topic_date"` and exit with an unhandled Drizzle error. Both need either `onConflictDoUpdate` or `onConflictDoNothing` added to their score_history INSERTs, or the scope must explicitly document them as "known broken after deploy, fix later."
