# Story 4.3: Source Attribution Badge

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **dashboard user**,
I want **to see which news source type (GNews or RSS) each article came from**,
so that **I can understand the diversity of EcoTicker's news sources and have transparency about where articles are sourced**.

## Acceptance Criteria

1. ArticleList displays source attribution as: `"Reuters · GNews"` or `"The Guardian · RSS"` (source name + middot + source type label)
2. Badge styling is subtle, muted text — does NOT clutter the article list or compete with the article title
3. Dark mode compatible — uses appropriate `dark:` Tailwind variants
4. If `sourceType` is null, undefined, or empty string, show source name only (backwards compatible with pre-4.2 articles)
5. If `source` is null/empty but `sourceType` exists, show nothing (no orphaned badge without a source name)
6. Component tests verify badge renders for both `"gnews"` and `"rss"` source types
7. Component tests verify graceful fallback when `sourceType` is missing/null/empty
8. All existing ArticleList tests continue to pass — zero regressions

## Tasks / Subtasks

- [x] Task 1: Add source type badge to ArticleList component (AC: #1, #2, #3, #4, #5)
  - [x] In the metadata row (source + date), append source type label after source name with ` · ` separator
  - [x] Display label: `"GNews"` for `sourceType === "gnews"`, `"RSS"` for `sourceType === "rss"`
  - [x] Style badge text with muted color: `text-stone-400 dark:text-stone-500` (per epic dev notes)
  - [x] Guard: only show badge when BOTH `a.source` AND `a.sourceType` are truthy and non-empty
- [x] Task 2: Write component tests for source attribution badge (AC: #6, #7, #8)
  - [x] Test: article with `sourceType: "gnews"` renders `"· GNews"` after source name
  - [x] Test: article with `sourceType: "rss"` renders `"· RSS"` after source name
  - [x] Test: article with `sourceType: null` renders source name only, no badge
  - [x] Test: article with `sourceType: ""` (empty string) renders source name only
  - [x] Test: article with `source: null` AND `sourceType: "rss"` renders nothing (no orphaned badge)
  - [x] Verify all 7 existing tests still pass

## Dev Notes

### Implementation Location

**Single file change:** `src/components/ArticleList.tsx` — line 25 (the source `<span>`).

The current code:
```tsx
{a.source && <span>{a.source}</span>}
```

Should become something like:
```tsx
{a.source && (
  <span>
    {a.source}
    {a.sourceType && (
      <span className="text-stone-400 dark:text-stone-500">
        {/* NOTE: "newsapi" default (pre-4.2 schema) shows as "GNews" — acceptable transient behavior */}
        {" · "}{a.sourceType === "rss" ? "RSS" : "GNews"}
      </span>
    )}
  </span>
)}
```

**Key design decisions:**
- Inline within the existing `<span>`, NOT a separate component — KISS (Commandment XIV)
- The ` · ` (middot) separator is a common UI pattern for metadata items
- Label mapping: `"gnews"` → `"GNews"`, `"rss"` → `"RSS"` — capitalized for readability
- Default fallback: any non-`"rss"` sourceType displays as `"GNews"` (intentional — only two source types exist; tested explicitly)

### sourceType Field — Already Wired End-to-End

- **DB schema:** `src/db/schema.ts` line 60 — `sourceType: text("source_type").default("newsapi")`
- **TypeScript type:** `src/lib/types.ts` line 50 — `sourceType: string` (non-optional)
- **API response:** Both `/api/topics/[slug]/route.ts` and `/api/articles/route.ts` already return `sourceType` in article JSON
- **Batch pipeline:** Story 4-2 set `sourceType` to `"gnews"` or `"rss"` on every insert

**No backend changes needed.** This is a pure frontend story.

### Styling Guidance

Per epic-4.md dev notes: `text-stone-400 dark:text-stone-500` for muted badge text. This aligns with the existing metadata row styling (`text-xs text-gray-500`) but is slightly more muted to make the badge secondary to the source name.

The badge inherits `text-xs` from the parent `div` — no need to set font size.

### Testing Approach

**File:** `tests/ArticleList.test.tsx` — extend the existing 7 tests, do NOT create a new test file.

**Existing mock data** (lines 5-9) already has `sourceType: "news"`. Update this mock to use a realistic value (`"gnews"` or `"rss"`).

**Mock pattern for testing sourceType variations:**
```tsx
// Override single article's sourceType for specific tests
const articlesWithRss = mockArticles.map((a, i) =>
  i === 0 ? { ...a, sourceType: "rss" } : a
);
```

**Test assertions:**
- Use `getByText` / `queryByText` for badge text presence/absence
- The `· GNews` or `· RSS` text may be in a nested span — use `{ exact: false }` or check parent text content

### What NOT to Change

- **No API route changes** — `sourceType` is already returned in article responses
- ~~**No type changes**~~ — Review fix: `sourceType` updated from `string` to `string | null` in `src/lib/types.ts` to match DB nullability
- **No schema changes** — `source_type` column exists and is populated
- **No other components** — Only `ArticleList.tsx` renders individual article metadata

### Edge Cases

- **Pre-4.2 articles** with `sourceType` defaulting to `"newsapi"` (stale schema default): These will show `"· GNews"` — acceptable transient behavior. The schema default is a known issue documented in Story 4-2; a future migration will clean it up.

### Project Structure Notes

- Aligns with existing component patterns: single file, Tailwind-only styling, dark mode variants
- No new files, no new dependencies, no new utilities
- Follows ArticleList's existing conditional rendering pattern (`a.source && ...`)

### References

- [Source: _bmad-output/planning-artifacts/epic-4.md — Story 4.3 AC and Dev Notes]
- [Source: src/components/ArticleList.tsx — current source rendering at line 25]
- [Source: src/lib/types.ts — Article interface, sourceType field at line 50]
- [Source: tests/ArticleList.test.tsx — 7 existing tests]
- [Source: _bmad-output/implementation-artifacts/4-2-integrate-rss-batch-pipeline.md — Previous story context, sourceType wiring]
- [Source: _bmad-output/project-context.md — Dark mode contract, Tailwind CSS 4 patterns, testing rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, no issues.

### Completion Notes List

- Added source type badge to ArticleList.tsx: inline nested span with conditional rendering for sourceType
- Badge displays "· GNews" or "· RSS" with muted styling (text-stone-400 dark:text-stone-500)
- Guards: both source AND sourceType must be truthy; null/empty sourceType shows source only; null source shows nothing
- Updated base mock sourceType from "news" to "gnews" in tests
- Added 5 new tests in "source attribution badge" describe block
- All 12 ArticleList tests pass, 313/313 full suite pass, zero regressions

### Senior Developer Review (AI) — 2026-02-21

**Reviewer:** Claude Opus 4.6 (adversarial party-mode: Dev + QA + Architect)
**Outcome:** APPROVED with 3 fixes applied

**Issues Found & Fixed:**
1. **M1 (Type Safety):** `sourceType: string` → `string | null` in `types.ts` — DB column is nullable, type was lying. Removed `as unknown as string` cast from test.
2. **M2 (Doc Drift):** Epic-4.md AC said `"NewsAPI"` but code correctly uses `"GNews"` post-emergency migration. Epic updated.
3. **M3 (Undocumented Behavior):** Non-`"rss"` sourceType defaults to `"GNews"` label — added explicit test (`"renders GNews for any non-rss sourceType"`) and updated Dev Notes.

**Post-fix verification:** 13/13 ArticleList tests, 324/324 full suite, TypeScript clean, zero regressions.

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-21 | Implementation complete | Dev Agent (Opus 4.6) |
| 2026-02-21 | Code review: 3 fixes (type nullability, epic doc, unknown sourceType test) | Review Agent (Opus 4.6) |

### File List

- `src/components/ArticleList.tsx` (modified)
- `tests/ArticleList.test.tsx` (modified)
- `src/lib/types.ts` (modified — review fix: sourceType nullability)
- `_bmad-output/planning-artifacts/epic-4.md` (modified — review fix: stale AC text)
