# Story 8.3: Rename misnamed test file

Status: ready-for-dev

## Story

As a developer maintaining the EcoTicker codebase,
I want `tests/api-batch-gnews.test.ts` renamed to `tests/api-batch-route.test.ts`,
so that the filename reflects its actual scope (21+ tests covering RSS, GNews, classification, and scoring — not just GNews).

## Acceptance Criteria

### AC1: File renamed via git mv

**Given** the test file `tests/api-batch-gnews.test.ts` exists
**When** it is renamed to `tests/api-batch-route.test.ts`
**Then** the rename is performed via `git mv` so git tracks the rename properly
**And** the old filename no longer exists on disk

### AC2: All tests pass after rename

**Given** the renamed file `tests/api-batch-route.test.ts`
**When** `npx jest` runs the full test suite
**Then** all tests pass with zero regressions
**And** Jest discovers the renamed file via its glob pattern (`tests/**/*.test.ts`)

### AC3: No stale references to old filename

**Given** the rename is complete
**When** grep searches the entire project for `api-batch-gnews`
**Then** zero results are found in any source file, config, or CI workflow
**And** references in `tests/batch-pipeline.test.ts` (comment mentioning old filename) are updated

## Tasks / Subtasks

- [ ] Task 1: Rename the file (AC: #1)
  - [ ] 1.1 Run `git mv tests/api-batch-gnews.test.ts tests/api-batch-route.test.ts`
- [ ] Task 2: Update stale references (AC: #3)
  - [ ] 2.1 In `tests/batch-pipeline.test.ts` line 143: update the comment from `api-batch-gnews.test.ts` to `api-batch-route.test.ts`
  - [ ] 2.2 Grep entire project for `api-batch-gnews` — confirm zero results (docs in `docs/plans/` are historical and do not need updating)
- [ ] Task 3: Run full test suite (AC: #2)
  - [ ] 3.1 Run `npx jest` and confirm all tests pass

## Dev Notes

### Verification Performed (Pre-Story)

- **Jest config** (`jest.config.ts`): Uses glob patterns (`<rootDir>/tests/**/*.test.ts`), no hardcoded filenames. Rename is safe.
- **CI workflow** (`.github/workflows/security.yml`): Runs `npx jest --ci` with no file-specific arguments. Rename is safe.
- **Grep results for `api-batch-gnews`:**
  - `tests/batch-pipeline.test.ts:143` — comment referencing old filename. **Must update.**
  - `docs/plans/2026-02-21-handover-stories-4-3-4-4-4-6.md` — 4 references. **Historical doc, do not change.**

### What This Story Is

A pure rename. Zero code changes inside the file. Zero behavior changes. The only content edit is updating a comment in `batch-pipeline.test.ts` that references the old filename.

### Risk Assessment

**Risk: MINIMAL.** This is a single `git mv` plus one comment update. Jest discovers tests by glob pattern, CI uses `npx jest --ci` with no file arguments. No code paths reference the filename at runtime.

### LLM Boundary Validation

N/A — this story does not interact with LLM responses.
