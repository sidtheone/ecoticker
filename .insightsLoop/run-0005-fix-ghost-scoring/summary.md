# Run Summary

**Feature:** Fix Ghost Scoring in Batch Pipeline
**Date:** 2026-03-14
**Triage:** small

## What Was Built
Fixed the batch pipeline ghost scoring bug where topics were re-scored on duplicate articles, articleCount was inflated across runs, and orphan topics accumulated with no sources. Added a pre-query guard that checks fetched article URLs against the DB before scoring — skips entire topic processing when all articles are duplicates. Fixed articleCount arithmetic to use actual new-article count. Created a one-time correction script to fix historical inflation.

## Files
- Modified: `src/lib/batch-pipeline.ts` (pre-query guard, articleCount fixes)
- Modified: `tests/run-batch-pipeline.test.ts` (mock restructuring, 3 new ghost scoring tests)
- Modified: `tests/batch-rss-integration.test.ts` (mock fix for new pre-query)
- Created: `scripts/fix-article-counts.ts` (one-time correction script)
- Created: `tests/fix-article-counts.test.ts` (6 tests for correction script)

## Tests
- Before: 673
- After: 682 (+9 new: 3 ghost scoring prevention, 6 correction script)

## Findings
- Storm Plan: 7 findings (2 high, 3 medium, 1 low, 1 consistency) — 4 incorporated into plan
- Monkey (Plan): 3 findings (TOCTOU race, URL near-dupes, audit trail) — all dismissed
- Monkey (Frame): 3 findings (inArray empty, GROUP BY orphans, execution order) — 1 accepted
- Storm TDD: 7 findings (1 critical, 2 high, 2 medium, 2 low) — 5 fixed by Sentinel re-invoke
- Storm Verify: 6 findings (1 high false positive, 1 medium, 4 low) — 1 fixed (process.exit)

## Decisions
- Minimal diff approach chosen over clean architecture (VALUES: "Three lines beat a clever abstraction")
- Score from ALL fetched articles (LLM needs context), count only new ones
- Pre-query per topic (not batched) — acceptable given LLM call per topic dwarfs one SELECT
- Mock restructured from selectCallCount ordering to table-reference discrimination
- Correction script fixes ANY mismatch direction (inflated or deflated)
- process.exitCode replaces process.exit to allow pool.end in finally
