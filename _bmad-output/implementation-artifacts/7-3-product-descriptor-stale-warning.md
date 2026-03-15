# Story 7.3: Product descriptor and stale data warning

Status: ready-for-dev

## Story

As a first-time visitor,
I want to see a clear product descriptor and a warning when data is outdated,
so that I immediately understand what the product does and can trust the freshness of the displayed scores.

## Acceptance Criteria

### AC1: Product descriptor visible on dashboard

**Given** a visitor lands on the dashboard
**When** the page renders
**Then** a product descriptor is visible beneath the site title: "Environmental News Impact Tracker — AI-Scored Severity"
**And** the descriptor is styled as caption text (14px, muted color)
**And** it is visible above the fold on both desktop and mobile

### AC2: Stale data warning when batch data is outdated

**Given** the last successful batch ran more than 18 hours ago (NOTE: `recordedAt` is DATE type — staleness is day-level: stale if `lastBatchDate < today` in UTC)
**When** any page loads (dashboard or topic detail)
**Then** a stale data warning banner is visible: "Data may be outdated — last updated [relative time]. Next batch at 6 AM UTC."
**And** the banner uses amber/yellow warning styling (Layer 2 trust surface)
**And** the banner is not dismissible (data remains stale until batch runs)
**And** all date comparisons use UTC to align with the 6 AM UTC batch schedule

### AC3: No warning when data is fresh

**Given** the last successful batch ran within 18 hours
**When** any page loads
**Then** no stale data banner is shown

### AC4: Empty database state

**Given** no batch has ever run (no score history records)
**When** the dashboard loads
**Then** an empty state message shows: "We're monitoring the environment. Scores will appear after the next batch run at 6 AM UTC."
**And** the message is timeline-based, not error-based (calm tone)
**And** the product descriptor (AC1) is still visible so first-time visitors understand what the product does even with no data

## Tasks / Subtasks

- [ ] Task 1: Add product descriptor to dashboard layout (AC: #1)
  - [ ] 1.1 Add `<p>` tag beneath the site content area in `src/app/page.tsx` with descriptor text
  - [ ] 1.2 Style as 14px muted caption (`text-sm text-stone-500 dark:text-gray-400`)
  - [ ] 1.3 Verify above-the-fold visibility on 375px mobile
- [ ] Task 2: Create `/api/health` endpoint for last batch timestamp (AC: #2, #3, #4)
  - [ ] 2.1 Create `src/app/api/health/route.ts` with GET handler
  - [ ] 2.2 Query `scoreHistory` table: `SELECT MAX(recorded_at) AS lastBatchAt FROM score_history`
  - [ ] 2.3 Return `{ lastBatchAt: string | null, isStale: boolean }` (stale if >18h or null)
  - [ ] 2.4 Public endpoint (no auth required — read-only health check)
- [ ] Task 3: Create `StaleDataWarning` client component (AC: #2, #3, #4)
  - [ ] 3.1 Create `src/components/StaleDataWarning.tsx` as `"use client"` component
  - [ ] 3.2 Fetch `/api/health` on mount
  - [ ] 3.3 If `lastBatchAt` is null → show empty state message
  - [ ] 3.4 If `isStale` is true → show amber warning banner with relative time
  - [ ] 3.5 If fresh → render nothing
  - [ ] 3.6 Compute relative time: hours ago or days ago from `lastBatchAt`
  - [ ] 3.7 Style: amber background, rounded, padding, warning icon
- [ ] Task 4: Place StaleDataWarning in layout (AC: #2, #3)
  - [ ] 4.1 Import `StaleDataWarning` in `src/app/layout.tsx`
  - [ ] 4.2 Place inside `<main>` above `{children}` — visible on all pages
- [ ] Task 5: Tests (AC: #1-4)
  - [ ] 5.1 Unit test: `/api/health` route — returns lastBatchAt and isStale correctly
  - [ ] 5.2 Unit test: `/api/health` with no score history → `{ lastBatchAt: null, isStale: true }`
  - [ ] 5.3 Component test: `StaleDataWarning` renders warning banner when stale
  - [ ] 5.4 Component test: `StaleDataWarning` renders nothing when fresh
  - [ ] 5.5 Component test: `StaleDataWarning` renders empty state when lastBatchAt is null
  - [ ] 5.6 Snapshot or render test: product descriptor is visible on dashboard
  - [ ] 5.7 Component test: `StaleDataWarning` renders nothing when `/api/health` fetch fails (fail-silent)
  - [ ] 5.8 Unit test: `/api/health` stale calculation uses UTC date comparison, not local timezone

## Dev Notes

### Product Descriptor — Pure HTML, Zero Logic

The product descriptor is a single `<p>` tag. No state, no fetch, no component. Add directly to `src/app/page.tsx` above the `HeroSection`:

```tsx
<p className="text-sm text-stone-500 dark:text-gray-400 mb-4">
  Environmental News Impact Tracker — AI-Scored Severity
</p>
```

This goes inside the existing `<div>` in `page.tsx` before `<HeroSection />`. It is NOT in layout.tsx because the descriptor is dashboard-specific, not site-wide.

### Stale Data Detection Strategy

**No `batch_runs` table exists yet** (Phase 3 scope per architecture audit). Use `scoreHistory.recordedAt` as a proxy:

```sql
SELECT MAX(recorded_at) AS last_batch_at FROM score_history;
```

The `recordedAt` column is `date("recorded_at")` type in schema (line 90 of `src/db/schema.ts`). This is a DATE type, not TIMESTAMP — it stores only the date portion. This means:
- Staleness detection has day-level granularity, not hour-level
- 18h threshold becomes: if `lastBatchDate < today`, the data is from yesterday or earlier
- Acceptable for MVP since batch runs daily at 6 AM UTC

In Drizzle:
```typescript
import { max } from "drizzle-orm";
import { scoreHistory } from "@/db/schema";

const result = await db.select({ lastBatchAt: max(scoreHistory.recordedAt) }).from(scoreHistory);
const lastBatchAt = result[0]?.lastBatchAt ?? null; // optional chaining — result can be []
```

### `/api/health` Endpoint

- Path: `src/app/api/health/route.ts`
- Method: GET only
- Public (no `requireAdminKey()` — this is a read-only health check)
- No rate limiting needed (standard read rate applies via existing middleware)
- Response: `{ lastBatchAt: string | null, isStale: boolean }`
- Stale calculation: compare `lastBatchAt` date to current UTC date. If `lastBatchAt` is null or before today (UTC), `isStale = true`. Use `new Date().toISOString().slice(0, 10)` for UTC date string.

### StaleDataWarning Component

- Path: `src/components/StaleDataWarning.tsx`
- `"use client"` — needs `useEffect` + `useState` for fetch
- Fetches `/api/health` on mount
- Three render states:
  1. **Loading** — render nothing (avoid flash)
  2. **Stale** — amber banner: "Data may be outdated — last updated [date]. Next batch at 6 AM UTC."
  3. **Fresh** — render nothing
  4. **Empty DB** (`lastBatchAt === null`) — calm message: "We're monitoring the environment. Scores will appear after the next batch run at 6 AM UTC."
- **Error state:** If `/api/health` fetch fails, render nothing (fail silent — don't block the page for a health check). Log the error to `console.error` for debugging (see Edge Cases & Risks #3).

Styling for stale banner:
```tsx
<div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-amber-800 dark:text-amber-200 text-sm">
```

### Placement in Layout

`StaleDataWarning` goes in `src/app/layout.tsx` inside `<main>`, directly before `{children}`. This ensures it appears on both dashboard and topic detail pages.

```tsx
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
  <StaleDataWarning />
  {children}
</main>
```

### Relative Time Formatting

Since `recordedAt` is a DATE (not timestamp), format as:
- Same day → don't show warning (fresh)
- Yesterday → "last updated yesterday"
- 2+ days ago → "last updated X days ago"

No external library needed.

### Existing File Locations

| File | Role |
|---|---|
| `src/app/page.tsx` | Dashboard — add product descriptor here |
| `src/app/layout.tsx:49` | Main layout — add StaleDataWarning here |
| `src/db/schema.ts:68-96` | `scoreHistory` table with `recordedAt` (DATE type) |
| `src/app/topic/[slug]/page.tsx` | Topic detail — inherits StaleDataWarning from layout |
| `src/lib/utils.ts` | Utilities — no changes needed |
| `src/lib/types.ts` | Types — no changes needed |

### Testing Standards

- Jest with two projects: `node` (.test.ts) and `react` (.test.tsx)
- API route tests: mock `@/db` module (Drizzle queries)
- Component tests: jsdom project, mock `global.fetch`
- Mock shapes must match real API response: `{ lastBatchAt: "2026-02-22" | null, isStale: boolean }`
- Test the three component states: stale, fresh, empty DB
- Mock `@/db` in health route tests using the proxy-based pattern
- Optional chaining on DB results: `result[0]?.lastBatchAt ?? null`

### Project Structure Notes

- New files: `src/app/api/health/route.ts`, `src/components/StaleDataWarning.tsx`
- Modified files: `src/app/page.tsx` (descriptor), `src/app/layout.tsx` (StaleDataWarning import)
- No schema changes — uses existing `scoreHistory.recordedAt`
- No migration needed

### Edge Cases & Risks (Elicitation)

1. **UTC timezone alignment:** All date comparisons in `/api/health` MUST use UTC (`new Date().toISOString().slice(0, 10)`) to match the 6 AM UTC batch schedule. Using server-local time could show false "fresh" or false "stale" depending on deployment timezone.

2. **AC2 vs implementation granularity mismatch:** AC2 says "18 hours" but `recordedAt` is DATE type (day-level). The implementation uses day comparison (`lastBatchDate < todayUTC`). This is acceptable for MVP but the AC text is aspirational — document this explicitly in code comments.

3. **Fail-silent trade-off:** If `/api/health` itself errors (DB down, network), the component renders nothing. This means during an outage, users see NO warning that data is stale — the exact moment when a warning matters most. Accepted for MVP (don't block the page), but log the fetch error to console for debugging.

4. **No client-side refresh:** If a user keeps the tab open for hours, the stale state won't update. No polling or visibility-change refetch. Acceptable for MVP — page reload gets fresh state.

5. **Empty state on topic detail:** AC4 specifies "dashboard loads" but `StaleDataWarning` is in layout (all pages). If a user navigates directly to `/topic/slug` with empty DB, they'll see the empty-state message there too. This is acceptable — better to inform than confuse.

### Key Constraints

- `recordedAt` is DATE type, not TIMESTAMP — day-level granularity only
- No `batch_runs` table yet — upgrading to timestamp-level accuracy is a future story
- Empty-state is a "timeline state" not an "error state" (UX spec principle)
- Product descriptor is dashboard-only, NOT in layout (topic detail page has its own hero)

### References

- [Source: docs/plans/2026-02-22-architecture-audit-ux-spec.md] — Gap #3 (product descriptor), Gap #5 (stale data warning)
- [Source: _bmad-output/planning-artifacts/epic-7.md#Story 7.3] — Full AC and dev notes
- [Source: src/db/schema.ts:68-96] — scoreHistory table with recordedAt field
- [Source: src/app/layout.tsx:49] — Main layout placement point
- [Source: src/app/page.tsx] — Dashboard page for descriptor placement
- [Source: _bmad-output/implementation-artifacts/7-2-dashboard-hero-section.md] — Previous story patterns

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
