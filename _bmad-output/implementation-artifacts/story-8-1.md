# Story 8-1: Extract shared batch pipeline module

**Epic:** 8 — Technical Debt Cleanup
**Size:** S
**Priority:** HIGH
**Status:** ready-for-dev
**Estimated Effort:** 3-4 hours

---

## Description

Extract all duplicated batch pipeline logic from `src/app/api/batch/route.ts` and `scripts/batch.ts` into a shared module `src/lib/batch-pipeline.ts`. Both consumers import from the shared module. All `// SYNC:` comments are eliminated.

This is a pure extraction refactor — no behavior changes, no new features.

---

## Acceptance Criteria

### AC-1: Shared module exports all duplicated items

**Given** the shared module `src/lib/batch-pipeline.ts` is created
**When** it exports the shared pipeline logic
**Then** it contains:
- `BLOCKED_DOMAINS` array
- `isBlockedDomain()` function
- `FEW_SHOT_EXAMPLES` constant
- `NewsArticle` interface
- `GNewsArticle` interface
- `Classification` interface
- `LLMScoreResponse` interface
- `TopicScore` interface
- `FeedHealth` interface (currently in `scripts/rss.ts` and duplicated in `route.ts`)
- `DEFAULT_FEEDS` array
- `feedHostname()` helper
- `fetchRssFeeds()` function (currently in `scripts/rss.ts` and duplicated in `route.ts`)
- `callLLM()` function
- `extractJSON()` function
- `safeJsonb()` function (route.ts only — move to shared)
- `processScoreResult()` function
- Classification prompt builder function
- Scoring prompt builder function
- `fetchNews()` (GNews fetcher)
- Source merge + dedup + blocked domain filter logic
- Feed health logging logic

**And** both `route.ts` and `scripts/batch.ts` import from the shared module instead of defining their own copies

### AC-2: Zero SYNC comments remain

**Given** all `// SYNC:` comments exist in the codebase (currently 13 across source files: 11 in route.ts, 2 in scripts/batch.ts)
**When** the shared module extraction is complete
**Then** zero `// SYNC:` comments remain in any source file
**And** `grep -r "// SYNC" src/ scripts/` returns no results

### AC-3: All tests pass with zero regressions

**Given** the existing test suites run
**When** all tests execute after the extraction
**Then** all tests pass with zero regressions
**And** TypeScript compiles cleanly
**And** build succeeds

### AC-4: `scripts/rss.ts` is eliminated or reduced to re-exports

**Given** `scripts/rss.ts` currently defines `fetchRssFeeds`, `FeedHealth`, `NewsArticle`, `feedHostname`
**When** the extraction is complete
**Then** `scripts/rss.ts` is either deleted or contains only re-exports from `src/lib/batch-pipeline.ts`
**And** `tests/rss.test.ts` imports are updated to match

### AC-5: RSS parser instantiation is module-scoped in the shared module

**Given** `rss-parser` creates a `new Parser()` at module load time in both `scripts/rss.ts` and `route.ts`
**When** extracted to the shared module
**Then** only one `Parser` instance exists (module-scoped in `batch-pipeline.ts`)
**And** tests that mock `rss-parser` only need to mock it in one place

---

## Dev Notes

### SYNC Comment Inventory (13 in source files)

**`src/app/api/batch/route.ts` (11):**
1. Line 40: `BLOCKED_DOMAINS` must match `scripts/batch.ts`
2. Line 48: `FEW_SHOT_EXAMPLES` must match `scripts/batch.ts`
3. Line 152: `isBlockedDomain` must match `scripts/batch.ts`
4. Line 242: `DEFAULT_FEEDS` copied from `scripts/rss.ts`
5. Line 262: `rssParser` mirrors `scripts/rss.ts`
6. Line 268: `FeedHealth` type must match `scripts/rss.ts`
7. Line 286: `fetchRssFeeds` copied from `scripts/rss.ts`
8. Line 501: classification prompt must match `scripts/batch.ts`
9. Line 595: scoring rubric prompt must match `scripts/batch.ts`
10. Line 728: per-feed health logging must match `scripts/batch.ts`
11. Line 756: sourceMap + merge pattern must match `scripts/batch.ts`

**`scripts/batch.ts` (2):**
1. Line 643: per-feed health logging must match `route.ts`
2. Line 671: sourceMap + merge pattern must match `route.ts`

### Extraction Strategy

1. **Create `src/lib/batch-pipeline.ts`** — the single source of truth for all shared logic.

2. **What goes in the shared module:**
   - All types/interfaces: `NewsArticle`, `GNewsArticle`, `Classification`, `LLMScoreResponse`, `TopicScore`, `FeedHealth`
   - Constants: `BLOCKED_DOMAINS`, `DEFAULT_FEEDS`, `FEW_SHOT_EXAMPLES`
   - Config readers: `getKeywords()`, `getRssFeeds()`, `getGnewsApiKey()`, `getOpenRouterConfig()` — wrap `process.env` reads in functions so they're evaluated at call time, not import time
   - Pure functions: `isBlockedDomain()`, `feedHostname()`, `extractJSON()`, `safeJsonb()`, `processScoreResult()`
   - LLM caller: `callLLM()` — parameterize the API key and model
   - Prompt builders: `buildClassificationPrompt()`, `buildScoringPrompt()` — extract prompt template strings into functions that accept data parameters
   - GNews fetcher: `fetchNews()` — parameterize API key
   - RSS fetcher: `fetchRssFeeds()` — move from `scripts/rss.ts` to shared module
   - Source merge logic: `mergeAndDedup()` — extract the sourceMap + merge + dedup + blocked domain filter into a reusable function
   - Feed health logger: `logFeedHealth()` — extract the per-feed console logging
   - Classification orchestrator: `classifyArticles()` — shared between both consumers
   - Scoring orchestrator: `scoreTopic()` — shared between both consumers

3. **What stays in `route.ts`** (thin orchestrator):
   - `POST()` handler, auth check, audit logging, HTTP response construction
   - DB operations (topic upsert, article insert, score history insert, keyword insert)
   - Imports `db` from `@/db`

4. **What stays in `scripts/batch.ts`** (thin orchestrator):
   - `main()` function, DB connection setup (standalone Pool), `pool.end()`
   - DB operations (same pattern as route.ts but with standalone connection)
   - GDPR audit log purge
   - `require.main === module` guard
   - Imports from shared module

5. **What happens to `scripts/rss.ts`:**
   - Its exports (`fetchRssFeeds`, `FeedHealth`, `NewsArticle`, `feedHostname`) move to `src/lib/batch-pipeline.ts`
   - `scripts/batch.ts` changes its import from `./rss` to `../src/lib/batch-pipeline`
   - `scripts/rss.ts` can be deleted or reduced to a re-export if standalone RSS testing is still needed

### Key Differences Between the Two Consumers

Watch for these divergences that must be reconciled during extraction:

1. **`callLLM()` signature differs:** `route.ts` has `options?: { jsonMode?: boolean }` parameter; `scripts/batch.ts` always uses `jsonMode: true`. The shared version must support the optional parameter.

2. **`TopicScore.rawLlmResponse` type differs:** `route.ts` uses `unknown` (via `safeJsonb()`); `scripts/batch.ts` uses `string`. Reconcile to `unknown` (the safer type for JSONB storage).

3. **Classification fallback differs:** `route.ts` returns `[]` on failure; `scripts/batch.ts` returns a fallback grouping assigning all articles to "Environmental News". Choose one strategy (recommend: return `[]` and let the caller decide).

4. **Anomaly detection flow differs:** `route.ts` passes `previousScores` directly to `scoreTopic()`; `scripts/batch.ts` scores without previous scores, then re-processes with `Object.assign`. The shared `scoreTopic()` should accept optional `previousScores` parameter (matching `route.ts` pattern — cleaner).

5. **`processScoreResult()` null-safety differs:** `route.ts` uses `raw.healthReasoning || ""` with fallback; `scripts/batch.ts` uses `raw.healthReasoning` without fallback. Shared version must use the defensive `|| ""` pattern for all string fields (LLM boundary validation).

### LLM Boundary Validation Guards (MUST preserve)

- `validateScore()` clamping for each dimension
- `typeof parsed.healthScore !== "number"` check before using LLM response
- `Array.isArray(raw.keywords) ? raw.keywords : []` guard
- `|| ""` fallbacks on all string fields from LLM
- `safeJsonb()` wrapper for raw LLM response storage
- `extractJSON()` with null return on parse failure

### Module-Level Constant Caveat

`GNEWS_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `KEYWORDS`, `RSS_FEEDS` are currently captured at module load time. In the shared module, wrap these in getter functions or accept them as parameters so:
- Tests can override env vars after import
- `scripts/batch.ts` (which uses `dotenv/config`) loads env before the shared module reads them
- `route.ts` (which uses Next.js env loading) also works correctly

### Test Implications

- Existing tests mock `global.fetch` and `@/db` — these patterns remain unchanged
- Tests that import from `scripts/batch.ts` or `scripts/rss.ts` may need import path updates
- Tests that mock `BLOCKED_DOMAINS` or `FEW_SHOT_EXAMPLES` via module internals will need to mock from the new shared module path
- `tests/rss.test.ts` imports from `../scripts/rss` — update to `../src/lib/batch-pipeline` (or keep if rss.ts becomes re-export shim)
- `tests/batch-rss-integration.test.ts` mocks the module-level `Parser` constructor from `scripts/rss.ts` — must be updated to mock the shared module's parser
- No new test files should be needed — behavior is unchanged, only import paths change

### Failure Modes to Guard Against

These are the most likely ways this refactor can break things (from failure mode analysis):

1. **Circular import:** `batch-pipeline.ts` must NOT import from `@/db` or any consumer module. It should be pure logic + `fetch`. If DB types are needed, accept them as generic parameters.

2. **Module-level `Parser()` instantiation in tests:** `rss-parser` `new Parser()` runs at import time. If `batch-pipeline.ts` instantiates at module scope, every test file that imports it will trigger the constructor. Ensure the mock is registered via `jest.mock()` (hoisted) before any import.

3. **`dotenv/config` load order in `scripts/batch.ts`:** `scripts/batch.ts` does `import "dotenv/config"` at the top. If it then imports from `batch-pipeline.ts`, and `batch-pipeline.ts` captures env vars at module load, the env may not be loaded yet (depending on CJS import order). The getter-function pattern in the Dev Notes is mandatory — not optional.

4. **Next.js build tree-shaking:** `route.ts` is a server-only API route. If `batch-pipeline.ts` imports `rss-parser` (a Node-only package), the build will include it correctly since it is only imported by server routes. However, if any client component ever accidentally imports from `batch-pipeline.ts`, the build will fail. Add a `"use server"` or `// @ts-expect-error` comment is NOT the answer — just ensure no client component imports it.

5. **Re-export breakage:** If `scripts/rss.ts` becomes a re-export shim (`export { ... } from "../src/lib/batch-pipeline"`), TypeScript path resolution from `scripts/` to `src/lib/` uses relative paths, NOT `@/` aliases. The `@/` alias only works under Next.js's tsconfig paths. Verify the re-export compiles with `npx tsc --noEmit`.

### Divergence Resolution Decisions (Pre-agreed)

For the 5 divergences listed above, here are the mandatory resolutions (not recommendations — decisions):

1. **`callLLM()` signature:** Use `options?: { jsonMode?: boolean }` (route.ts pattern). Default `jsonMode` to `true`.
2. **`TopicScore.rawLlmResponse`:** Use `unknown`. Both consumers wrap with `safeJsonb()`.
3. **Classification fallback:** Return `[]`. The caller decides fallback behavior. `scripts/batch.ts` wraps with its "Environmental News" fallback at the call site.
4. **Anomaly detection:** `scoreTopic()` accepts optional `previousScores` parameter. `scripts/batch.ts` passes it directly instead of post-processing with `Object.assign`.
5. **`processScoreResult()` null-safety:** All string fields use `|| ""` fallback. All number fields use `validateScore()` clamping. All arrays use `Array.isArray() ? x : []`.

---

## Task Breakdown

1. **Inventory all shared code** — grep for `// SYNC`, catalog every duplicated function/type/constant across `route.ts`, `scripts/batch.ts`, and `scripts/rss.ts`
2. **Create `src/lib/batch-pipeline.ts`** — extract types, interfaces, constants, pure functions first (no async, no side effects)
3. **Extract async functions** — move `callLLM()`, `fetchNews()`, `fetchRssFeeds()`, `classifyArticles()`, `scoreTopic()` to shared module with parameterized config
4. **Extract orchestration helpers** — `mergeAndDedup()`, `logFeedHealth()`, source health warning logic
5. **Reconcile divergences** — resolve the 5 differences listed in Dev Notes (callLLM signature, rawLlmResponse type, classification fallback, anomaly detection flow, null-safety)
6. **Refactor `route.ts`** — replace inline definitions with imports from shared module, keep only HTTP handler + DB operations
7. **Refactor `scripts/batch.ts`** — replace inline definitions with imports from shared module, keep only `main()` + DB setup + GDPR purge
8. **Update `scripts/rss.ts`** — delete or reduce to re-export from shared module
9. **Remove all `// SYNC:` comments** — verify with grep
10. **Run full test suite** — `npx jest`, TypeScript check, build
11. **Final grep verification** — confirm zero `// SYNC` comments in source files
12. **Verify no circular imports** — `batch-pipeline.ts` must not import from `@/db`, `route.ts`, or `scripts/batch.ts`
13. **Verify `scripts/` path resolution** — if `scripts/rss.ts` re-exports, confirm `npx tsc --noEmit` passes (relative paths, not `@/` alias)
