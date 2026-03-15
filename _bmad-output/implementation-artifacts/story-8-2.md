# Story 8.2: Fix stale schema default for source_type

Status: ready-for-dev

## Story

As a developer maintaining the EcoTicker codebase,
I want the `source_type` column default to reflect reality (not the defunct NewsAPI provider),
so that articles inserted without an explicit source type are flagged as `"unknown"` rather than silently mislabeled as `"newsapi"`.

## Acceptance Criteria

### AC1: Schema default changed from "newsapi" to "unknown"

**Given** the `articles` table schema in `src/db/schema.ts`
**When** the `source_type` column default is updated
**Then** the default is `"unknown"` instead of `"newsapi"`
**And** `drizzle-kit push` applies the change without error

### AC2: All insert call sites explicitly set sourceType

**Given** every code path that inserts into the `articles` table
**When** each `.insert(articles).values(...)` call is reviewed
**Then** each one explicitly sets `sourceType` to a meaningful value (`"gnews"`, `"rss"`, `"seed"`, or `"api"`)
**And** no insertion relies on the schema default

### AC3: Fallback references to "newsapi" are removed

**Given** code that falls back to `"newsapi"` when `sourceType` is null/missing
**When** those fallbacks are updated
**Then** they use `"unknown"` instead of `"newsapi"`
**And** grep for the string `"newsapi"` in `src/` returns zero results (excluding comments)

### AC4: Existing data is not modified

**Given** existing articles in the database have `source_type = "newsapi"`
**When** this schema change is deployed via `drizzle-kit push`
**Then** existing rows retain their current `source_type` values (no data migration)

### AC5: All tests pass

**Given** the test suite runs after all changes
**When** all tests execute
**Then** all tests pass with zero regressions
**And** any test fixtures that referenced `"newsapi"` are updated to match the new values

### AC6: ArticleList badge only renders for known feed sources

**Given** the `ArticleList.tsx` component renders source type badges
**When** an article has `sourceType` of `"unknown"`, `"seed"`, `"api"`, or `null`
**Then** no source type badge is rendered for that article
**And** badges are only rendered for `"rss"` and `"gnews"` source types

## Tasks / Subtasks

- [ ] Task 1: Update schema default (AC: #1)
  - [ ] 1.1 In `src/db/schema.ts`, change `.default("newsapi")` to `.default("unknown")` on the `sourceType` column (line 60)
- [ ] Task 2: Update insert call sites (AC: #2)
  - [ ] 2.1 `src/app/api/seed/route.ts` line 176: change `sourceType: "newsapi"` to `sourceType: "seed"`
  - [ ] 2.2 `src/app/api/articles/route.ts` line 127: change `sourceType: "newsapi"` to `sourceType: "api"`
  - [ ] 2.3 Verify `src/app/api/batch/route.ts` line 951 already sets `sourceType` explicitly (`"gnews"` or `"rss"`) -- no change needed
- [ ] Task 3: Update fallback references (AC: #3)
  - [ ] 3.1 `src/app/api/topics/[slug]/route.ts` line 62: change `a.sourceType || "newsapi"` to `a.sourceType || "unknown"`
- [ ] Task 4: Fix ArticleList badge logic (AC: #6)
  - [ ] 4.1 In `src/components/ArticleList.tsx` line 25-29: change the badge condition from `a.sourceType && (...)` to only render for `"rss"` and `"gnews"` — currently any truthy sourceType (including `"unknown"`, `"seed"`, `"api"`) falls into the else branch and renders "GNews" incorrectly
  - [ ] 4.2 Update `tests/ArticleList.test.tsx` to cover: (a) `"rss"` shows "RSS", (b) `"gnews"` shows "GNews", (c) `"unknown"` / `"seed"` / `"api"` / `null` show no badge
- [ ] Task 5: Update test fixtures (AC: #5)
  - [ ] 5.1 Grep all test files for `"newsapi"` and update to match new values
  - [ ] 5.2 Run full test suite (`npx jest`) and confirm zero failures
- [ ] Task 6: Final verification (AC: #2, #3)
  - [ ] 6.1 Grep `src/` for `"newsapi"` -- expect zero results (comments about GNews migration are acceptable)
  - [ ] 6.2 Grep `tests/` for `"newsapi"` -- expect zero results (all updated)

## Dev Notes

### Schema Change Strategy

This is a **default-only change** -- no column type change, no data migration. `drizzle-kit push` will alter the column default without touching existing rows. Per project convention, we use `drizzle-kit push` (no migration files -- fresh launch).

### Inventory of "newsapi" References in `src/`

Found 4 locations that must change:

| File | Line | Current | New | Rationale |
|---|---|---|---|---|
| `src/db/schema.ts` | 60 | `.default("newsapi")` | `.default("unknown")` | Schema default |
| `src/app/api/seed/route.ts` | 176 | `sourceType: "newsapi"` | `sourceType: "seed"` | Seed data is synthetic, label it distinctly |
| `src/app/api/articles/route.ts` | 127 | `sourceType: "newsapi"` | `sourceType: "api"` | Articles created via POST API endpoint |
| `src/app/api/topics/[slug]/route.ts` | 62 | `\|\| "newsapi"` | `\|\| "unknown"` | Fallback for null sourceType on read |

### Inventory of "newsapi" References in `tests/`

No test files reference `"newsapi"` as a sourceType value in fixtures (confirmed by grep). Test fixtures use `"gnews"`, `"rss"`, `"news"`, or `"api"`. No test updates needed for this string.

### ArticleList Badge Bug (DISCOVERED VIA FAILURE MODE ANALYSIS)

**Current code (line 25-29):**
```tsx
{a.sourceType && (
    <span className="text-stone-400 dark:text-stone-500">
      {" · "}{a.sourceType === "rss" ? "RSS" : "GNews"}
    </span>
)}
```

**Problem:** The ternary only checks for `"rss"` — everything else (including `"unknown"`, `"seed"`, `"api"`) falls through to "GNews". After this story changes `sourceType` values to `"seed"` and `"api"`, seed articles and API-created articles will display a "GNews" badge, which is incorrect.

**Fix:** Guard the badge render to only trigger for `"rss"` and `"gnews"`:
```tsx
{(a.sourceType === "rss" || a.sourceType === "gnews") && (
    <span className="text-stone-400 dark:text-stone-500">
      {" · "}{a.sourceType === "rss" ? "RSS" : "GNews"}
    </span>
)}
```

### What NOT to change

- **Existing database rows:** This is a schema default change only. Rows with `source_type = "newsapi"` stay as-is. They are historically accurate (those articles were fetched via NewsAPI before the GNews migration).
- **`scripts/batch.ts`:** Uses the same pipeline logic as `route.ts` and already sets sourceType explicitly. Verify but do not change.
- **Comment in `batch/route.ts` line 172:** References "NewsAPI" in a comment about GNews OR syntax. This is a historical/explanatory comment, not a code reference. Leave it.

### Failure Mode Analysis

| Component | Failure Mode | Severity | Mitigation |
|---|---|---|---|
| Schema default | `drizzle-kit push` fails on default change | Low | Default-only change; no type change, no constraint change |
| Insert call sites | Missed an insert site; article gets `"unknown"` | Low | Grep verification in Task 6; `"unknown"` is honest fallback |
| ArticleList badge | Non-feed sourceTypes show wrong badge | Medium | **AC6 added** — guard badge to `"rss"`/`"gnews"` only |
| Existing `"newsapi"` rows | Badge shows "GNews" for historical newsapi articles | Low | Acceptable — these articles were fetched via a news API; "GNews" badge is close enough. No data migration needed. |
| Future insert without sourceType | Gets `"unknown"` default | None | This is the desired behavior |

### Pre-mortem: Deployment Failure Scenarios

1. **`drizzle-kit push` rejects the change** — Extremely unlikely for a default-only change. If it happens, the column default can be changed manually via `ALTER TABLE articles ALTER COLUMN source_type SET DEFAULT 'unknown'`.
2. **Missed a `"newsapi"` reference** — Task 6 grep catches this. Zero tolerance: grep must return zero matches in `src/`.
3. **ArticleList renders wrong badge after deploy** — Mitigated by AC6. Without AC6, seed and API articles would silently show "GNews" badges in production. This was the highest-risk failure mode and has been addressed.

### Risk Assessment

- **Risk: LOW.** This is a 5-file change (4 original + ArticleList fix). All insert paths already set sourceType explicitly; this story fixes the stale default, removes dead references, and hardens the badge rendering.
- **Edge case:** If a future code path inserts an article without setting `sourceType`, it will now get `"unknown"` instead of `"newsapi"` -- which is the correct, honest behavior.

### LLM Boundary Validation

N/A -- this story does not interact with LLM responses.
