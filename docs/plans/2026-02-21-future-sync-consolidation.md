# Future Story: Consolidate SYNC'd Code Between route.ts and batch.ts

**Priority:** Low (tech debt)
**Origin:** Story 4.6 code review (2026-02-21)

## Problem

`src/app/api/batch/route.ts` and `scripts/batch.ts` share 5+ identical code blocks marked with `// SYNC:` comments:

1. Classification prompt (~50 lines)
2. Scoring rubric prompt (~80 lines)
3. Few-shot examples (~35 lines)
4. Blocked domains list
5. RSS feed defaults + parser config
6. Rejection logging pattern
7. `isBlockedDomain()` function

Each SYNC comment is a manual maintenance contract. Any prompt or logic change must be applied to both files. This violates DRY and creates drift risk.

## Constraint

`route.ts` runs in Next.js standalone builds. It **cannot** import from `scripts/` (excluded from build output). Any shared module must live under `src/`.

## Proposed Solution

Create `src/lib/prompts.ts` (or `src/lib/pipeline-shared.ts`) exporting:

- `CLASSIFICATION_PROMPT_TEMPLATE` (function accepting topicsList, titlesList)
- `SCORING_PROMPT_TEMPLATE` (function accepting topicName, articleSummaries)
- `FEW_SHOT_EXAMPLES` constant
- `BLOCKED_DOMAINS` constant
- `isBlockedDomain()` function

Then import in both `route.ts` and `scripts/batch.ts`. Remove all SYNC comments.

## Acceptance Criteria

1. All SYNC'd code extracted to a shared module under `src/lib/`
2. Both `route.ts` and `scripts/batch.ts` import from the shared module
3. All SYNC comments removed
4. Zero test regressions
5. `scripts/batch.ts` can import from `src/lib/` (verify with `npx tsx scripts/batch.ts --dry-run`)
