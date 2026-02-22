# Epic 8: Technical Debt Cleanup

**Status:** backlog
**Phase:** 8 — Debt Reduction
**Goal:** Eliminate technical debt identified in the Epic 4 retrospective: consolidate duplicated batch pipeline into a shared module, fix stale schema defaults, and rename misnamed test files. These items were deferred from Epic 7 to keep UX stories focused.
**Source:** `_bmad-output/implementation-artifacts/epic-4-retro-2026-02-22.md` (Technical Debt section)

## Context

The Epic 4 retrospective identified 3 technical debt items that accumulated during the Operational Resilience phase. Pipeline duplication between `src/app/api/batch/route.ts` and `scripts/batch.ts` was the most impactful — 4 of 6 stories required SYNC comments to keep the two files aligned, and every code review flagged missing or incomplete synchronization.

These items were originally planned for Epic 7 but were separated into their own epic to keep Epic 7 focused on UX foundations. All items are Size S and have no external dependencies.

**Priority ordering:** 8.1 (HIGH) → 8.2 (MEDIUM) → 8.3 (LOW)

---

## Story 8.1: Extract shared batch pipeline module
**Status:** backlog
**Size:** S
**Estimated Effort:** 3–4 hours
**Priority:** HIGH
**Description:** Extract all duplicated batch pipeline logic from `src/app/api/batch/route.ts` and `scripts/batch.ts` into a shared module `src/lib/batch-pipeline.ts`. Both consumers import from the shared module. All `// SYNC:` comments are eliminated.
**Dependencies:** None

**Acceptance Criteria:**

**Given** the shared module `src/lib/batch-pipeline.ts` is created
**When** it exports the shared pipeline logic
**Then** it contains: `fetchRssFeeds()`, `FeedHealth` type, `DEFAULT_FEEDS` array, `BLOCKED_DOMAINS` list, classification prompt template, scoring prompt template, few-shot calibration examples
**And** both `route.ts` and `scripts/batch.ts` import from the shared module instead of defining their own copies

**Given** all `// SYNC:` comments exist in the codebase
**When** the shared module extraction is complete
**Then** zero `// SYNC:` comments remain in any file
**And** grep for `// SYNC` returns no results

**Given** the existing test suites run
**When** all tests execute after the extraction
**Then** all tests pass with zero regressions
**And** no new test files are needed (existing tests cover the behavior, just import paths change)

**Dev Notes:**
- Start by grepping for all `// SYNC:` comments to inventory every duplicated item
- The shared module is a pure extraction — no behavior changes, no new features
- `route.ts` and `scripts/batch.ts` become thin orchestrators that import shared logic
- Watch for module-level constants captured at import time (test implications)
- If `scripts/batch.ts` has a `require.main === module` guard, ensure the shared module doesn't interfere with standalone execution
- **LLM Boundary Validation:** The shared module inherits all existing null/undefined/NaN guards from the source files — do not weaken them during extraction

---

## Story 8.2: Fix stale schema default for source_type
**Status:** backlog
**Size:** S
**Estimated Effort:** 1 hour
**Priority:** MEDIUM
**Description:** The `source_type` column in the articles table defaults to `"newsapi"` — a leftover from before the GNews migration (emergency story). Change the default to `"unknown"` or remove the default entirely so new articles must explicitly set their source type.
**Dependencies:** None

**Acceptance Criteria:**

**Given** the `articles` table schema in `src/db/schema.ts`
**When** the `source_type` column default is updated
**Then** the default is changed from `"newsapi"` to `"unknown"` (or the default is removed)
**And** all code paths that insert articles explicitly set `source_type` (grep confirms no insertions rely on the default)

**Given** existing articles in the database have `source_type = "newsapi"`
**When** this change is deployed
**Then** existing rows are NOT modified (this is a schema default change, not a data migration)
**And** only new articles inserted without an explicit `source_type` get `"unknown"`

**Given** the test suite runs
**When** all tests execute
**Then** all tests pass — update any test fixtures that assert `"newsapi"` as the default

**Dev Notes:**
- Schema change: `drizzle-kit push` (no migration files — fresh launch convention)
- Grep for all `.insert(` calls on the articles table to verify each sets `sourceType` explicitly
- The batch pipeline sets `sourceType: "gnews"` or `sourceType: "rss"` — verify both paths
- Test fixtures may hardcode `"newsapi"` — update to match new default

---

## Story 8.3: Rename misnamed test file
**Status:** backlog
**Size:** S
**Estimated Effort:** 30 minutes
**Priority:** LOW
**Description:** `tests/api-batch-gnews.test.ts` became the general batch route test suite (21+ tests covering RSS, GNews, classification, scoring) but was never renamed after its scope expanded. Rename to `tests/api-batch-route.test.ts` to match the actual content.
**Dependencies:** None

**Acceptance Criteria:**

**Given** the test file `tests/api-batch-gnews.test.ts` exists
**When** it is renamed to `tests/api-batch-route.test.ts`
**Then** all tests pass (Jest discovers by pattern, not explicit path)
**And** no other files reference the old filename (grep confirms)
**And** git tracks the rename properly (`git mv`)

**Dev Notes:**
- Use `git mv tests/api-batch-gnews.test.ts tests/api-batch-route.test.ts`
- Verify Jest config doesn't have explicit file paths (it uses glob patterns — should be fine)
- Check CI workflow for any hardcoded test file references
- This is a pure rename — zero code changes inside the file
