# Story 4.5: Align route.ts Scoring Pipeline with US-1.0 Rubric

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **product owner**,
I want the `route.ts` batch scoring pipeline to use the same US-1.0 rubric-based scoring as `scripts/batch.ts`,
so that **topic scores are deterministic, validated, and consistent regardless of which pipeline runs**.

## Acceptance Criteria

1. `route.ts` `callLLM()` uses `temperature: 0` for all LLM calls (was 0.3)
2. `route.ts` `callLLM()` sets `response_format: { type: "json_object" }` for scoring calls (enforced JSON)
3. `route.ts` `callLLM()` uses 30s timeout (was 60s) matching project standard
4. `route.ts` scoring prompt matches `scripts/batch.ts` rubric: 4-level severity (MINIMAL/MODERATE/SIGNIFICANT/SEVERE), reasoning-first output, INSUFFICIENT_DATA support
5. `route.ts` includes `FEW_SHOT_EXAMPLES` (4 calibration examples matching `scripts/batch.ts:319-355`)
6. `route.ts` calls `validateScore()` from `src/lib/scoring.ts` to clamp dimension scores to level ranges
7. `route.ts` calls `computeOverallScore()` for weighted server-side aggregation (Eco 40%, Health 35%, Econ 25%) — NOT LLM-returned `score`
8. `route.ts` calls `deriveUrgency()` for server-side urgency derivation — NOT LLM-returned `urgency`
9. `route.ts` calls `detectAnomaly()` when previous scores exist, logs `⚠️ ANOMALY` warnings
10. `route.ts` logs batch-level clamping warning when >30% of dimensions are clamped (model drift indicator)
11. `scoreHistory` insert includes dimension reasoning (`healthReasoning`, `ecoReasoning`, `econReasoning`), dimension levels (`healthLevel`, `ecoLevel`, `econLevel`), `rawLlmResponse`, and `anomalyDetected`
12. `scripts/batch.ts` behavior is completely unchanged (no regressions)
13. All existing 276+ tests pass; new tests cover: clamping, anomaly detection, INSUFFICIENT_DATA handling, server-side score computation, and few-shot prompt presence in the route.ts context

## Tasks / Subtasks

- [x] Task 1: Update `callLLM()` function (AC: #1, #2, #3)
  - [x] 1.1 Change `temperature` from `0.3` → `0`
  - [x] 1.2 Add `response_format: { type: "json_object" }` parameter
  - [x] 1.3 Change timeout from `60000` → `30000` ms
- [x] Task 2: Replace scoring prompt in `scoreTopic()` (AC: #4, #5)
  - [x] 2.1 Copy `FEW_SHOT_EXAMPLES` constant from `scripts/batch.ts:319-355`. Add sync comment: `// SYNC: Few-shot examples must match scripts/batch.ts AND src/app/api/batch/route.ts`
  - [x] 2.2 Replace simple "rate 0-100" prompt with full rubric prompt (4-level severity, reasoning-first, INSUFFICIENT_DATA support) from `scripts/batch.ts:418-472`
  - [x] 2.3 Update `LLMScoreResponse` / `TopicScore` interface to include reasoning fields, levels, `rawLlmResponse`, `clampedDimensions`, `anomalyDetected`
- [x] Task 3: Add `processScoreResult()` function (AC: #6, #7, #8, #9, #10)
  - [x] 3.1 Import `validateScore`, `computeOverallScore`, `deriveUrgency`, `detectAnomaly` from `src/lib/scoring.ts`
  - [x] 3.2 Implement `processScoreResult()` mirroring `scripts/batch.ts:520-595`: validate each dimension → compute overall → derive urgency → detect anomalies
  - [x] 3.3 Wire `scoreTopic()` to call `processScoreResult()` instead of returning raw LLM output
  - [x] 3.4 Add batch-level clamping percentage tracking and >30% warning log
- [x] Task 4: Update `scoreHistory` insert (AC: #11)
  - [x] 4.1 Add dimension reasoning fields to insert: `healthReasoning`, `ecoReasoning`, `econReasoning`
  - [x] 4.2 Add dimension levels: `healthLevel`, `ecoLevel`, `econLevel`
  - [x] 4.3 Add `rawLlmResponse` (JSONB) and `anomalyDetected` (boolean)
- [x] Task 5: Update topic upsert for anomaly context (AC: #9)
  - [x] 5.1 Fetch previous scores for existing topics before scoring (needed for `detectAnomaly()`). Extended existing topics SELECT to include `healthScore`, `ecoScore`, `econScore`. In the batch loop, match by topic name to extract `previousScores`.
  - [x] 5.2 Pass previous scores to `processScoreResult()`
- [x] Task 6: Tests (AC: #12, #13)
  - [x] 6.1 Verify all 276+ existing tests still pass (no regressions) — **295/295 pass**
  - [x] 6.2 Add test: `scoreTopic()` returns clamped scores within level ranges
  - [x] 6.3 Add test: overall score is server-side weighted average (not LLM-returned)
  - [x] 6.4 Add test: urgency is derived from overall score (not LLM-returned)
  - [x] 6.5 Add test: `detectAnomaly()` called when previous scores exist
  - [x] 6.6 Add test: INSUFFICIENT_DATA dimension excluded from weighted average
  - [x] 6.7 Add test: scoreHistory insert includes reasoning and raw response
  - [x] 6.8 Add test: callLLM uses temperature 0 and response_format json_object
  - [x] 6.9 Add test: LLM returns non-JSON string despite `response_format` → verify graceful fallback to defaults (not crash). OpenRouter proxies to multiple models; not all honor `response_format`.

## Dev Notes

### What This Story IS
This is **Option A from the reconciliation plan** — copy & align the scoring pipeline from `scripts/batch.ts` into `route.ts`. Import shared functions from `src/lib/scoring.ts`. No shared module extraction (that's a separate DRY refactoring story if desired).

### What This Story IS NOT
- Does NOT touch `classifyArticles()` — classification prompt alignment is story 4-6
- Does NOT refactor into a shared `batch-pipeline.ts` module (Option B, deferred — track as future story after Epic 4)
- Does NOT modify `scripts/batch.ts` in any way

### Follow-Up: DRY Extraction (Future Story)
Option A (this story) intentionally duplicates prompt text and pipeline logic. A future story should extract shared scoring into `src/lib/batch-pipeline.ts` so both pipelines import from one source of truth. This prevents the exact drift that created this story in the first place. Track as a candidate for Epic 5 or a standalone refactoring story.

### Critical Architecture Constraints

1. **Temperature MUST be 0** — Research-backed decision for maximum determinism in scoring. See `docs/plans/2026-02-09-llm-scoring-research.md`. Non-negotiable.
2. **Server-side aggregation is mandatory** — Never use LLM-returned `score` or `urgency`. Always compute via `computeOverallScore()` and `deriveUrgency()`. The LLM returns dimension-level scores only.
3. **Clamping is a safety net, not a fix** — If >30% of dimensions are clamped, that signals model drift, not success. Log it loudly.
4. **INSUFFICIENT_DATA = -1** — When the LLM returns `-1` for a dimension, it means insufficient data. Exclude from weighted average (don't treat as zero). `computeOverallScore()` handles this automatically.
5. **Fallback scores remain at 50** — If LLM call fails entirely, the existing fallback `{ score: 50, healthScore: 50, ecoScore: 50, econScore: 50 }` pattern is acceptable as a degraded mode.

### Error Handling
- `callLLM()` already has try/catch returning `null` on failure — preserve this
- `processScoreResult()` should handle malformed LLM responses (missing fields, NaN scores) — validate at boundary per Commandment X
- If `JSON.parse()` of LLM response fails despite `response_format: json_object`, log error and fall back to defaults

### Source Files (Read These First)

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/api/batch/route.ts` | 159-175, 244-290, 466-473 | **TARGET** — callLLM, scoreTopic, scoreHistory insert |
| `scripts/batch.ts` | 167-185, 319-355, 413-505, 520-595, 772-788 | **SOURCE OF TRUTH** — callLLM, few-shot, scoreTopic, processScoreResult, scoreHistory insert |
| `src/lib/scoring.ts` | All | Shared utilities: validateScore, computeOverallScore, deriveUrgency, detectAnomaly |
| `src/db/schema.ts` | 68-96 | scoreHistory table schema (reasoning fields already exist) |

### Testing Standards

- Use **proxy-based Drizzle mock** from `tests/helpers/mock-db.ts`
- Mock `global.fetch` for LLM API calls (OpenRouter)
- Set **module-level env vars** (`process.env.OPENROUTER_API_KEY`, `process.env.BATCH_KEYWORDS`) before imports
- Test both success and failure paths (Commandment VII)
- Existing test files to extend: `tests/api-batch-gnews.test.ts` (3 tests) — add scoring-specific tests here. Note: this file name says "gnews" but is becoming the general batch route test suite. Flag for rename to `api-batch-route.test.ts` in a follow-up cleanup.
- Run `npx jest` to verify no regressions

### Project Structure Notes

- All scoring utilities live in `src/lib/scoring.ts` — import from there, do NOT duplicate
- `route.ts` uses `@/db` module import (Drizzle connection pool) — different from `scripts/batch.ts` which creates its own pg connection
- `TopicScore` interface in `route.ts:65-75` needs expanding — add fields to match `scripts/batch.ts` output shape
- `scoreHistory` table already has all needed columns (reasoning, levels, rawLlmResponse, anomalyDetected) per `src/db/schema.ts:68-96` — just need to populate them in the insert

### References

- [Source: docs/plans/2026-02-21-reconcile-batch-scoring-pipelines.md] — Full problem analysis and approach options
- [Source: docs/plans/2026-02-09-llm-scoring-research.md] — Scoring architecture decisions (temperature, rubric, weights)
- [Source: _bmad-output/implementation-artifacts/emergency-replace-newsapi-with-gnews.md] — Code review finding H1
- [Source: scripts/batch.ts:167-595] — Gold standard scoring pipeline
- [Source: src/lib/scoring.ts] — Shared scoring utilities
- [Source: src/db/schema.ts:68-96] — scoreHistory table schema

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Aligned `route.ts` scoring pipeline with `scripts/batch.ts` US-1.0 rubric (Option A from reconciliation plan)
- `callLLM()`: temperature 0.3→0, timeout 60s→30s, added `response_format: { type: "json_object" }`
- Added `FEW_SHOT_EXAMPLES` constant (4 calibration examples) with SYNC comment
- Added `LLMScoreResponse` interface; expanded `TopicScore` interface with levels, reasoning, `rawLlmResponse`, `clampedDimensions`, `anomalyDetected`
- Added `processScoreResult()`: validates each dimension via `validateScore()`, computes overall via `computeOverallScore()`, derives urgency via `deriveUrgency()`, detects anomalies via `detectAnomaly()`
- `scoreTopic()` now calls `processScoreResult()` instead of returning raw LLM output; accepts `previousScores` parameter
- Extended existing topics SELECT to include `healthScore`, `ecoScore`, `econScore` for anomaly detection
- Updated `scoreHistory` insert: adds levels, reasoning, `rawLlmResponse`, `anomalyDetected`
- Added batch-level clamping warning (>30% of dimensions clamped → model drift warning)
- Updated topic upsert to use `overallScore` (server-computed) and `overallSummary` instead of LLM-returned `score`/`impactSummary`
- **Tests: 295/295 passing** (276 baseline + 19 new; test file covers 11 batch-route tests: 3 original + 8 new US-1.0 tests)
- `scripts/batch.ts` completely unchanged (AC #12 ✅)

### File List

- src/app/api/batch/route.ts (modified)
- tests/api-batch-gnews.test.ts (new — 3 original GNews tests + 8 new US-1.0 tests)

## Change Log

- 2026-02-21: Implemented Story 4.5 — aligned route.ts scoring pipeline with US-1.0 rubric. Added FEW_SHOT_EXAMPLES, processScoreResult(), updated callLLM() (temp 0, 30s, json_object), expanded scoreHistory insert with full rubric audit trail, anomaly detection, server-side score aggregation. 295/295 tests passing.
- 2026-02-21: **Code Review (claude-opus-4-6)** — 3 HIGH, 4 MEDIUM, 3 LOW issues found. All HIGH and MEDIUM fixed:
  - H1: Added boundary guards for undefined LLM fields (keywords, category, region, reasoning) in processScoreResult
  - H2: Added safeJsonb() to prevent JSONB INSERT crash on non-JSON LLM fallback responses
  - H3: Made response_format opt-in (jsonMode param on callLLM) — classification no longer gets response_format, matching AC #2 scope
  - M1: Replaced hardcoded urgency "moderate" with deriveUrgency(50) in fallback path
  - M2: Added SYNC comment on scoring rubric prompt body
  - M3: Fixed File List (test file is new, not modified)
  - M4: Added explicit assertion for batch-level clamping warning (AC #10)
  - 296/296 tests passing, TypeScript clean
