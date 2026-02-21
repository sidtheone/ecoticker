# Reconcile route.ts Batch Scoring Pipeline with US-1.0 Rubric

**Date:** 2026-02-21
**Source:** Code review finding H1 (emergency-replace-newsapi-with-gnews)
**Status:** Pending story creation
**Priority:** High — production scoring quality diverges depending on which pipeline runs

---

## Problem

The project has two independent batch pipelines that both fetch news and score topics:

1. **`scripts/batch.ts`** — Docker cron / `npx tsx scripts/batch.ts`
2. **`src/app/api/batch/route.ts`** — Next.js API / cron endpoint

`scripts/batch.ts` was upgraded to the full US-1.0 rubric-based scoring architecture during Epic 1. `route.ts` was never updated and still uses the original simplified scoring. This means **production scoring quality differs depending on which pipeline runs**.

---

## Specific Divergences

| Feature | `scripts/batch.ts` | `route.ts` |
|---------|-------------------|------------|
| LLM temperature | `0` (greedy, deterministic) | `0.3` (non-deterministic) |
| Scoring prompt | Full rubric with 4-level severity (MINIMAL/MODERATE/SIGNIFICANT/SEVERE) | Simple "rate 0-100" prompt |
| Few-shot calibration | 4 calibration examples anchoring each severity level | None |
| `response_format` | `{ type: "json_object" }` (enforced JSON) | Not set (relies on prompt instruction) |
| INSUFFICIENT_DATA handling | Supported (`-1` score, excluded from weighted average) | Not supported |
| Score validation/clamping | `validateScore()` clamps scores to level ranges | None — raw LLM scores used directly |
| Overall score computation | Server-side `computeOverallScore()` (weighted: Eco 40%, Health 35%, Econ 25%) | LLM returns `score` directly (no server-side computation) |
| Urgency derivation | Server-side `deriveUrgency()` from computed overall score | LLM returns `urgency` directly |
| Anomaly detection | `detectAnomaly()` flags >30pt swings between runs | None |
| Batch-level clamping warning | Warns if >30% of dimensions were clamped (model drift) | None |
| LLM timeout | 30s (per project-context.md standard) | 60s |
| Classification prompt | Full newsworthiness test (4 criteria), Q&A/listicle rejection | Simplified classifier, no newsworthiness test |
| Rejection logging | Logs relevance rate, rejected titles + reasons | None |

---

## Impact

- Topics scored via `route.ts` get non-deterministic scores (temperature 0.3) that aren't validated or clamped
- The LLM can return any score without level-range enforcement — a "MINIMAL" topic could get score 90
- No anomaly detection means score spikes go unnoticed
- Urgency is LLM-determined rather than derived from the weighted formula, creating inconsistency
- The simplified classification prompt lets through Q&A articles, listicles, and non-news content that `scripts/batch.ts` would reject

---

## Files to Change

- `src/app/api/batch/route.ts` — Primary target: align `callLLM()`, `classifyArticles()`, `scoreTopic()`, and add `processScoreResult()` with full validation pipeline

### Dependencies from `scripts/batch.ts` and `src/lib/scoring.ts`

Functions to reuse (already exist in `src/lib/scoring.ts`):
- `validateScore(level, score)` — Clamp score to level range
- `computeOverallScore(health, eco, econ)` — Weighted average (40/35/25)
- `deriveUrgency(overallScore)` — Score-to-urgency mapping
- `detectAnomaly(previous, current, topicName, dimension)` — Flag >30pt swings

### Additional changes needed
- `TopicScore` interface in route.ts needs dimension reasoning fields, `rawLlmResponse`, `clampedDimensions`, `anomalyDetected`
- `FEW_SHOT_EXAMPLES` constant (copy from batch.ts or extract to shared module)
- Classification prompt with newsworthiness test + rejection logging
- Add `scoreReasoning` fields to `scoreHistory.values()` insert (currently only inserts `impactSummary`)

---

## Approach Options

### Option A: Copy & align (simple, fast)
Copy the scoring prompt, few-shot examples, and `processScoreResult()` logic from `scripts/batch.ts` into `route.ts`. Import shared functions from `src/lib/scoring.ts`.

**Pros:** Minimal risk, no refactoring, fast to implement
**Cons:** Continued DRY violation — two copies of prompts and pipeline logic

### Option B: Extract shared module (DRY, harder)
Extract `fetchNews()`, `classifyArticles()`, `scoreTopic()`, `processScoreResult()`, prompts, and few-shot examples into a shared `src/lib/batch-pipeline.ts`. Both `scripts/batch.ts` and `route.ts` import from it.

**Pros:** Single source of truth, future changes apply everywhere
**Cons:** More complex refactoring, risk of breaking both pipelines, `scripts/batch.ts` uses its own DB connection (not `@/db`)

### Recommendation
**Option A first**, then Option B as a separate refactoring story if desired. Aligning scoring quality is urgent; DRY refactoring is desirable but lower priority.

---

## Acceptance Criteria (Draft)

1. `route.ts` uses `temperature: 0` for all LLM calls
2. `route.ts` uses `response_format: { type: "json_object" }` for scoring calls
3. `route.ts` scoring prompt matches `scripts/batch.ts` rubric (4-level severity, reasoning-first, INSUFFICIENT_DATA support)
4. `route.ts` includes few-shot calibration examples
5. `route.ts` calls `validateScore()` to clamp dimension scores to level ranges
6. `route.ts` calls `computeOverallScore()` for weighted server-side aggregation (not LLM-returned score)
7. `route.ts` calls `deriveUrgency()` for server-side urgency derivation (not LLM-returned urgency)
8. `route.ts` calls `detectAnomaly()` when previous scores exist
9. `route.ts` logs batch-level clamping warning when >30% of dimensions clamped
10. `route.ts` classification prompt includes newsworthiness test and rejection logging
11. `route.ts` LLM timeout is 30s (matching project standard)
12. `scoreHistory` insert includes dimension reasoning and `rawLlmResponse`
13. All existing tests pass; new tests cover clamping, anomaly detection, INSUFFICIENT_DATA in route.ts context
14. `scripts/batch.ts` behavior unchanged

---

## Size Estimate

**Size M** — Consider breaking into two Size S stories:
- S1: Align scoring prompt + validation + server-side computation (ACs 1-9, 11-12)
- S2: Align classification prompt + rejection logging (AC 10, 13)

---

## References

- `scripts/batch.ts:167-505` — Full US-1.0 scoring pipeline (source of truth)
- `src/app/api/batch/route.ts:136-267` — Current simplified pipeline (target)
- `src/lib/scoring.ts` — Shared scoring utilities (validateScore, computeOverallScore, deriveUrgency, detectAnomaly)
- `_bmad-output/implementation-artifacts/emergency-replace-newsapi-with-gnews.md` — Review follow-up item
- `docs/plans/2026-02-09-llm-scoring-research.md` — Original scoring research
