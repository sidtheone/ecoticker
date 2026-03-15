# Story 7.2: Dashboard hero section with weighted score calculation

Status: ready-for-dev

## Story

As a first-time visitor,
I want to see the most newsworthy environmental topic prominently highlighted with a severity gauge, score, and insight sentence,
so that I immediately understand what matters most without reading the entire dashboard.

## Acceptance Criteria

### AC1: Hero topic selection via weighted score

**Given** the dashboard loads with topics data
**When** the hero section renders
**Then** the most newsworthy topic is selected using: `heroScore = currentScore * 0.6 + abs(currentScore - previousScore) * 0.4`
**And** tie-breaker: most recent `updatedAt` timestamp, then highest `currentScore`

### AC2: Hero section layout (dramatic mode, severity >= 30)

**Given** the hero topic has severity >= 30
**When** the hero renders
**Then** the hero displays: topic name + score (Geist Mono 40px) + UrgencyBadge + SeverityGauge + insight sentence + action bar (`Updated Xh ago · [Share]`)
**And** score is 40px, gauge is 10px thick, full visual weight
**And** on mobile (375px): badge + score number share the same line (2-step co-perception)
**And** total mobile above-the-fold height is ~172px

### AC3: Hero section layout (calm mode, severity < 30)

**Given** the hero topic has severity < 30
**When** the hero renders
**Then** score shrinks to 28px, gauge thins to 6px, muted badge color
**And** total mobile above-the-fold height is ~120px
**And** insight sentence can display "All monitored topics within normal range" for stable state

### AC4: Share button

**Given** the user taps the Share button in the action bar
**When** clipboard copy succeeds
**Then** a toast shows "Link copied!" for 3 seconds
**And** the copied URL is the topic detail page URL (`/topic/{slug}`)

### AC5: Mobile above-the-fold

**Given** the hero section renders on mobile (375px)
**When** viewed above the fold
**Then** product descriptor + hero (score + badge + gauge + insight + action bar) are all visible without scrolling

## Tasks / Subtasks

- [ ] Task 1: Compute hero topic server-side (AC: #1)
  - [ ] 1.1 In `src/app/page.tsx`, convert to server component that fetches topics via direct DB query or internal API call
  - [ ] 1.2 Compute `heroScore` for each topic: `currentScore * 0.6 + Math.abs(currentScore - previousScore) * 0.4`
  - [ ] 1.3 Sort by heroScore desc, then updatedAt desc, then currentScore desc — pick first
  - [ ] 1.4 Pass hero topic as prop to the hero component
- [ ] Task 2: Evolve InsightHeadline into HeroSection (AC: #2, #3)
  - [ ] 2.1 Refactor `src/components/InsightHeadline.tsx` into `src/components/HeroSection.tsx` (rename file)
  - [ ] 2.2 Accept `heroTopic: Topic` prop (server-computed) instead of client-side fetch
  - [ ] 2.3 Render: topic name, score (Geist Mono), UrgencyBadge, SeverityGauge, insight sentence, action bar
  - [ ] 2.4 Dramatic mode (score >= 30): 40px score, 10px gauge, full visual weight
  - [ ] 2.5 Calm mode (score < 30): 28px score, 6px gauge, muted colors
  - [ ] 2.6 Calm fallback text: "All monitored topics within normal range"
  - [ ] 2.7 Mobile layout: badge + score on same line (co-perception pattern)
  - [ ] 2.8 Desktop layout: badge -> gauge -> number left-to-right sequence
- [ ] Task 3: Action bar with Share + timestamp (AC: #4)
  - [ ] 3.1 "Updated Xh ago" relative timestamp from `heroTopic.updatedAt`
  - [ ] 3.2 Share button with clipboard copy (reuse pattern from `src/app/topic/[slug]/page.tsx:53`)
  - [ ] 3.3 Toast "Link copied!" with 3s auto-dismiss (useRef + cleanup for timeout)
  - [ ] 3.4 Copied URL: `${window.location.origin}/topic/${heroTopic.slug}`
- [ ] Task 4: Update imports and tests (AC: #1-5)
  - [ ] 4.1 Update `src/app/page.tsx` imports from InsightHeadline to HeroSection
  - [ ] 4.2 Update or rename `tests/InsightHeadline.test.tsx` to `tests/HeroSection.test.tsx`
  - [ ] 4.3 Test hero topic selection logic (weighted score, tiebreakers)
  - [ ] 4.4 Test dramatic vs calm mode rendering
  - [ ] 4.5 Test share button + toast behavior
  - [ ] 4.6 Test empty topics array (fallback headline)
  - [ ] 4.7 Update any other files importing InsightHeadline or `computeHeadline`

## Dev Notes

### Hero Topic Selection — Server-Side

The hero topic selection MUST happen server-side in `page.tsx`, not in the component. The current `InsightHeadline` is a `"use client"` component that fetches `/api/topics` on mount. The new approach:

1. `page.tsx` becomes async server component (or stays sync and passes data)
2. Fetch topics from DB or `/api/topics` server-side
3. Compute heroScore and select the top topic
4. Pass `heroTopic` as a prop to `HeroSection`

Formula: `heroScore = currentScore * 0.6 + Math.abs(currentScore - previousScore) * 0.4`

Tie-breaker chain: heroScore desc -> updatedAt desc -> currentScore desc

**Edge case:** If all topics have score < 30, the hero still shows the highest-scoring topic but in calm mode. If topics array is empty, show fallback: "Environmental News Impact Tracker" with no gauge/badge.

### Refactoring InsightHeadline -> HeroSection

This is an EVOLUTION, not a net-new component. Steps:
1. Rename `InsightHeadline.tsx` -> `HeroSection.tsx`
2. Keep `computeHeadline()` for the insight sentence text — it still generates the right sentence
3. The component is now a CLIENT component (needs Share button, toast state) that receives `heroTopic` as a prop
4. `urgencyRank()` can stay exported (used by computeHeadline logic)

**CRITICAL:** `computeHeadline()` is exported and used in tests. Keep it or move it — don't break imports.

### SeverityGauge Integration (Story 7.1 Dependency)

This story depends on Story 7.1 which provides:
- `severityColor(score)` utility in `src/lib/utils.ts` — returns `{ badge, gauge, border, text, sparkline, change }`
- `SeverityGauge` component in `src/components/SeverityGauge.tsx`

Use `SeverityGauge` directly in the hero section. Pass `height` or `thickness` prop for dramatic (10px) vs calm (6px) modes.

### Share Button Pattern

Reuse the clipboard logic from `src/app/topic/[slug]/page.tsx:53`:
```typescript
await navigator.clipboard.writeText(url);
```
Wrap in try/catch — clipboard API can fail on HTTP, no focus, or permission denied (documented in MEMORY.md).

Toast state: `useState<boolean>` for visibility + `useRef<NodeJS.Timeout>` for cleanup. Clear timeout on unmount to prevent memory leaks (documented pattern in MEMORY.md).

### Layout Modes

**Dramatic (score >= 30):**
- Score: `font-mono text-[40px]` (Geist Mono)
- Gauge: `<SeverityGauge score={score} height={10} />`
- Badge: full saturation UrgencyBadge
- Mobile height target: ~172px

**Calm (score < 30):**
- Score: `font-mono text-[28px]`
- Gauge: `<SeverityGauge score={score} height={6} />`
- Badge: muted color variant
- Mobile height target: ~120px

### Existing File Locations

| File | Role |
|---|---|
| `src/components/InsightHeadline.tsx` | Current component to evolve (rename to HeroSection) |
| `src/app/page.tsx` | Dashboard page — currently imports InsightHeadline |
| `src/app/topic/[slug]/page.tsx:53` | Clipboard copy reference pattern |
| `src/components/UrgencyBadge.tsx` | Badge component (already exists) |
| `src/components/SeverityGauge.tsx` | Gauge component (from Story 7.1) |
| `src/lib/utils.ts` | `scoreToUrgency`, `severityColor` (from 7.1), `computeHeadline` (currently in InsightHeadline) |
| `src/lib/types.ts` | `Topic` type with `updatedAt: string` field |
| `src/lib/events.ts` | `eventBus` for ui-refresh subscription |
| `tests/InsightHeadline.test.tsx` | Existing tests to rename/update |

### Relative Time Formatting

For "Updated Xh ago", compute from `heroTopic.updatedAt` (ISO string). Simple approach:
```typescript
const hoursAgo = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 3600000);
const timeAgo = hoursAgo < 1 ? "just now" : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;
```
No external library needed.

### Event Bus Refresh

The current InsightHeadline subscribes to `eventBus` for `ui-refresh` events. The new HeroSection receives its topic as a prop from the server. If real-time refresh is needed, the component can still subscribe to `ui-refresh` and re-fetch the hero topic client-side as a fallback. But the primary data flow is server -> prop.

### Testing Standards

- Jest with two projects: `node` (.test.ts) and `react` (.test.tsx)
- Component tests: jsdom project, mock `next/link` as `<a>`
- Mock `recharts` as simple divs with data-testid
- Mock `SeverityGauge` as a div with data-testid in HeroSection tests
- Test heroScore calculation as a pure function (node project)
- Test dramatic vs calm mode rendering
- Test share button: mock `navigator.clipboard.writeText`
- Test empty topics fallback
- Mock shapes must match real API response shapes (Commandment XXIV)

### Project Structure Notes

- Rename `InsightHeadline.tsx` -> `HeroSection.tsx` (same directory `src/components/`)
- Rename `InsightHeadline.test.tsx` -> `HeroSection.test.tsx` (same directory `tests/`)
- Consider extracting `computeHeroScore()` as a named export from HeroSection or utils — it's useful for testing
- `computeHeadline()` stays as the insight sentence generator — can move to utils.ts or keep in HeroSection

### References

- [Source: docs/plans/2026-02-22-architecture-audit-ux-spec.md] — Gap #2 (Hero section), weighted score formula, layout modes
- [Source: _bmad-output/planning-artifacts/epic-7.md#Story 7.2] — Full AC and dev notes
- [Source: src/components/InsightHeadline.tsx] — Current component to evolve
- [Source: src/app/page.tsx] — Dashboard page layout
- [Source: src/app/topic/[slug]/page.tsx:53] — Clipboard copy pattern
- [Source: _bmad-output/implementation-artifacts/7-1-severity-gauge-color-utility.md] — Dependency: SeverityGauge + severityColor

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
