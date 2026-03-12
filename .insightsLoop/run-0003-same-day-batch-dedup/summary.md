# Run Summary

**Feature:** Same-Day Batch Dedup
**Date:** 2026-03-12
**Triage:** Small (scope expanded at Frame)

## What Was Built

Made the `score_history` INSERT idempotent. Running the batch pipeline multiple times on the same day now produces exactly one row per topic per calendar day (latest scores win). Existing duplicates can be cleaned with the new dedup script before applying the schema constraint.

Scope expanded at Frame when the Monkey found two seed paths also had naked INSERTs that would crash after the uniqueIndex shipped.

## Files

- Created: `scripts/dedup-score-history.ts`, `tests/dedup-score-history.test.ts`
- Modified: `src/db/schema.ts`, `src/lib/batch-pipeline.ts`, `src/app/api/seed/route.ts`, `scripts/seed.ts`, `tests/run-batch-pipeline.test.ts`

## Tests

- Before: 665
- After: 673 (+8 new contracts)

## Findings

- Storm: 0 critical, 1 high (pre-existing FK concern, no fix needed), 2 medium (backlog), 2 low (backlog)
- Cartographer: 3 findings (1 fixed — HAVING filter; 2 backlog — no transaction, nullable recordedAt)
- Monkey: 4 challenges, 4 survived, 0 didn't

  | Step | Technique | Finding | Survived | Action |
  |------|-----------|---------|----------|--------|
  | Frame | Existence Question | Seed paths missing from scope | yes | Scope expanded |
  | TDD | Cross-Seam Probe | score_feedback FK violation in dedup | yes | Documented, low risk (no feedback API) |
  | Build | Cross-Seam Probe | topicsAffected inflation + survivor strategy mismatch | yes | HAVING filter fixed |
  | Ship | — | (pending) | — | — |

## Deployment Order (CRITICAL)

1. Run `npx tsx scripts/dedup-score-history.ts --dry-run` — preview what would be deleted
2. Run `npx tsx scripts/dedup-score-history.ts` — clean existing duplicates
3. Run `npx drizzle-kit push` — adds `uniqueIndex('idx_score_history_topic_date')`
4. Deploy app — `onConflictDoUpdate` is now idempotent with the constraint in place

## Decisions

- Batch pipeline uses `onConflictDoUpdate` (latest scores win, existing row id preserved)
- Seed paths use `onConflictDoNothing` (seed data is fixed demo data, no latest-wins needed)
- Dedup script defaults to `--dry-run` for safety
- No transaction wrapping DELETE loop — partial failure is recoverable by re-running the script
- score_feedback FK concern documented and deferred — no feedback API or rows exist yet

## Backlog Created

- Test assertion: verify onConflictDoUpdate call targets score_history specifically (not just topic upsert)
- Wrap dedup DELETE loop in transaction for atomic cleanup
- Add `ON DELETE SET NULL` to scoreFeedback.scoreHistoryId before feedback ships
- Compute `recordedAt` once per batch run to avoid midnight boundary edge case
- Remove `.limit(Number.MAX_SAFE_INTEGER)` from dedup script (Drizzle mock workaround)
