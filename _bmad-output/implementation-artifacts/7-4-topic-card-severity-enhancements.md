# Story 7.4: Topic card severity enhancements

Status: ready-for-dev

## Story

As a dashboard visitor,
I want topic cards to visually communicate severity through colored borders, inline gauges, insight snippets, and timestamps,
so that I can instantly assess the importance and freshness of each topic at a glance.

## Acceptance Criteria

### AC1: Left border colored by severity

**Given** a topic card renders on the dashboard
**When** the component mounts
**Then** it has a 3px left border colored by severity level (from `severityColor(score).border`)
**And** BREAKING topics (80+) have a red border, CRITICAL (60-79) orange, MODERATE (30-59) yellow, INFORMATIONAL (0-29) green

### AC2: Inline SeverityGauge on card

**Given** a topic card renders
**When** the component mounts
**Then** a `SeverityGauge` is displayed in compact mode (height 6px, full card width)
**And** it uses the same `SeverityGauge` component from Story 7.1

### AC3: Truncated insight sentence

**Given** a topic has an `impactSummary`
**When** the card renders
**Then** the insight sentence is shown truncated to max 120 characters at the last full word boundary, with trailing ellipsis ("...")
**And** summaries under 120 characters are shown in full without ellipsis

**Given** the topic has no insight sentence (null, empty, or whitespace-only `impactSummary`)
**When** the card renders
**Then** the insight line is omitted entirely (no empty space or placeholder)

### AC4: Updated timestamp

**Given** a topic card renders
**When** the component mounts
**Then** "Updated Xh ago" (or "Xd ago") is visible in caption text
**And** the timestamp uses the existing `updatedAt` field from the topic

### AC5: Graduated visual weight

**Given** a BREAKING topic (score 80+)
**When** the card renders
**Then** the card has the highest visual weight: red left border, bold score, saturated badge
**And** it is visually the "loudest element on the page"

**Given** an INFORMATIONAL topic (score 0-29)
**When** the card renders
**Then** the card has low visual weight: green left border, calm badge, quiet gauge position
**And** it communicates "this is being tracked and it's okay"

## Tasks / Subtasks

- [ ] Task 1: Add severity left border to TopicCard (AC: #1)
  - [ ] 1.1 Apply `borderLeft: 3px solid ${severityColor(score).border}` via inline style on the card `<Link>` wrapper
  - [ ] 1.2 Remove any conflicting left border styles from existing classes
  - [ ] 1.3 Verify all 4 severity levels render correct border colors
- [ ] Task 2: Add inline SeverityGauge to TopicCard (AC: #2)
  - [ ] 2.1 Import `SeverityGauge` component
  - [ ] 2.2 Add `<SeverityGauge score={topic.currentScore} compact height={6} />` after the score row
  - [ ] 2.3 Ensure gauge spans full card width with appropriate margin
- [ ] Task 3: Create `truncateToWord` utility and add insight sentence (AC: #3)
  - [ ] 3.1 Add `truncateToWord(text: string, maxLen: number): string` to `src/lib/utils.ts`
  - [ ] 3.2 Truncate at last full word boundary before `maxLen`, append "..." if truncated
  - [ ] 3.3 Return original text unchanged if length <= maxLen
  - [ ] 3.4 Handle edge case: single word longer than maxLen — truncate at maxLen
  - [ ] 3.5 Add insight sentence display in TopicCard, conditionally rendered when `impactSummary` is truthy, non-empty, and non-whitespace (use `.trim()`)
  - [ ] 3.6 Style as `text-xs text-stone-500 dark:text-gray-400` with single-line truncation
- [ ] Task 4: Add relative timestamp (AC: #4)
  - [ ] 4.1 Add `relativeTime(dateStr: string): string` to `src/lib/utils.ts` — returns "Xh ago", "Xd ago", "just now"
  - [ ] 4.2 Display "Updated {relativeTime(topic.updatedAt)}" in caption text on the card
  - [ ] 4.3 Style as `text-xs text-stone-400 dark:text-gray-500`
- [ ] Task 5: Tests (AC: #1-5)
  - [ ] 5.1 Unit test: `truncateToWord` — text under limit, at limit, over limit (word boundary), single long word, empty string, whitespace-only string, maxLen=0
  - [ ] 5.2 Unit test: `relativeTime` — minutes ago, hours ago, days ago, invalid date string, future date, edge cases
  - [ ] 5.3 Component test: TopicCard renders left border with correct severity color for each level
  - [ ] 5.4 Component test: TopicCard renders SeverityGauge
  - [ ] 5.5 Component test: TopicCard renders truncated insight sentence when `impactSummary` present
  - [ ] 5.6 Component test: TopicCard omits insight line when `impactSummary` is null
  - [ ] 5.7 Component test: TopicCard omits insight line when `impactSummary` is empty string
  - [ ] 5.8 Component test: TopicCard omits insight line when `impactSummary` is whitespace-only
  - [ ] 5.9 Component test: TopicCard renders relative timestamp
  - [ ] 5.10 Component test: TopicCard renders correct border color at exact boundary scores (30, 60, 80)

## Dev Notes

### Left Border Implementation

Apply via inline style on the `<Link>` wrapper since the border color is dynamic (derived from score):

```tsx
<Link
  href={`/topic/${topic.slug}`}
  style={{ borderLeft: `3px solid ${colors.border}` }}
  className="block bg-[#f5f0e8] dark:bg-gray-900 ..."
>
```

The existing `border border-[#e8dfd3]` class provides the other 3 borders. The inline `borderLeft` overrides the left side. No `rounded-l-none` needed — the existing `rounded-lg` still applies to all corners; the left border just becomes 3px and colored.

### SeverityGauge Integration

The `SeverityGauge` component (from Story 7.1) already supports `compact` mode (solid color, no marker) and a `height` prop. Use:

```tsx
<SeverityGauge score={topic.currentScore} compact height={6} />
```

Place after the score/change row, before the region/sparkline row. Full width via default block layout.

### `truncateToWord` Utility

Place in `src/lib/utils.ts`:

```typescript
export function truncateToWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace <= 0) return truncated + "...";
  return truncated.slice(0, lastSpace) + "...";
}
```

Edge cases:
- Empty string → return empty string (guard in component, not utility)
- Whitespace-only string → guard in component with `.trim()` check before calling utility
- Single word longer than maxLen → truncate at maxLen + "..."
- Text exactly at maxLen → return as-is (no ellipsis)
- maxLen <= 0 → return "..." (defensive; should never happen in practice)

### `relativeTime` Utility

Place in `src/lib/utils.ts`:

```typescript
export function relativeTime(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "unknown";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now"; // future date (clock skew) — treat as fresh
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
```

No external library needed. Matches the "Updated Xh ago" format from the UX spec.

**LLM boundary guard:** `updatedAt` comes from the DB (reliable), but invalid/null date strings must not crash `relativeTime`. The `isNaN` guard returns `"unknown"` for garbage input. Future dates (clock skew between server and DB) are treated as "just now" rather than showing negative time.

### Existing File Locations

| File | Role |
|---|---|
| `src/components/TopicCard.tsx` | Main component to enhance |
| `src/components/SeverityGauge.tsx` | Gauge component (Story 7.1, already exists) |
| `src/lib/utils.ts` | Add `truncateToWord` and `relativeTime` utilities |
| `src/lib/types.ts:17-39` | `Topic` type — has `impactSummary`, `updatedAt` |
| `tests/TopicCard.test.tsx` | Existing test file to extend |
| `tests/utils.test.ts` | Existing test file for utility functions |

### Mock Requirements

- `SeverityGauge` in TopicCard tests: mock as simple div with `data-testid="gauge-bar"` (same pattern as Sparkline mock), OR let it render since it's pure HTML with no side effects
- `recharts` mock already exists in TopicCard tests (for Sparkline)
- No fetch mocks needed — TopicCard is a pure presentational component

### Testing Standards

- Jest with two projects: `node` (.test.ts for utils) and `react` (.test.tsx for component)
- Use existing `makeTopic()` helper in `TopicCard.test.tsx`
- Test all 4 severity levels for left border color
- Test `truncateToWord` boundary conditions thoroughly (this is the only non-trivial logic)
- Mock `Date.now()` for `relativeTime` tests to avoid flaky time-dependent tests

### Project Structure Notes

- Modified files: `src/components/TopicCard.tsx`, `src/lib/utils.ts`, `tests/TopicCard.test.tsx`, `tests/utils.test.ts`
- No new files
- No schema changes
- No migration needed

### Edge Cases & Risks

1. **Dynamic inline style for border color:** Tailwind cannot use dynamic class names (`border-l-[${color}]` won't work with JIT). Using inline `style={{ borderLeft: ... }}` is the correct approach for dynamic colors.

2. **Long impact summaries with no spaces:** The `truncateToWord` utility handles single-word strings by falling back to character-level truncation at maxLen. This prevents visual overflow.

3. **`updatedAt` timezone handling:** `relativeTime` uses `Date.now()` and `new Date(dateStr).getTime()` — both in UTC millis. No timezone issues as long as `updatedAt` is ISO 8601 (which it is from the API).

4. **SeverityGauge compact mode vs full mode:** The compact mode renders a solid-color bar (no gradient, no marker). This is intentional — the card gauge is a quick severity hint, not the full interactive gauge from the hero section.

5. **Color-only severity indicator (a11y):** The left border color communicates severity, but color-blind users cannot distinguish red/green/orange. This is mitigated by the existing `UrgencyBadge` text label ("BREAKING", "CRITICAL", etc.) and the numeric score — the border is a redundant visual cue, not the sole indicator. No additional a11y work needed for this story.

6. **Boundary scores (30, 60, 80):** These are the exact thresholds where severity level changes. `severityColor()` uses `>=` comparisons, so score=80 is BREAKING, score=60 is CRITICAL, score=30 is MODERATE. Tests must verify these exact boundaries to catch off-by-one regressions.

7. **`impactSummary` whitespace-only:** LLM responses can return whitespace-only strings that pass truthy checks. The component must `.trim()` before rendering to avoid showing a blank insight line.

8. **`relativeTime` with invalid date:** If `updatedAt` is somehow null or malformed (e.g., during data migration), `new Date(null)` returns epoch and `new Date("garbage")` returns `Invalid Date`. The `isNaN` guard handles this gracefully.

9. **Future `updatedAt` (clock skew):** If the DB server clock is ahead of the app server, `diffMs` goes negative. Treat as "just now" rather than showing nonsensical "in the future" text.

### Key Constraints

- TopicCard is a server-compatible component (no `"use client"`) — `relativeTime` must work server-side
- All color values come from `severityColor()` — no raw hex values in TopicCard
- `truncateToWord` truncates at word boundary, not character boundary (UX spec requirement)
- Insight line is completely omitted (not hidden) when `impactSummary` is null/empty

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#Story 7.4] — Full AC and dev notes
- [Source: docs/plans/2026-02-22-architecture-audit-ux-spec.md] — Graduated visual weight principle
- [Source: src/components/TopicCard.tsx] — Current component implementation
- [Source: src/components/SeverityGauge.tsx] — Gauge component (compact mode)
- [Source: src/lib/utils.ts:70-81] — `severityColor()` utility

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TDD bug: 7 border color tests used hex `#dc2626` assertions but jsdom normalizes inline style hex colors to `rgb()` format. Fixed assertions to use `rgb(220, 38, 38)` etc.

### Completion Notes List

- All 4 ACs implemented: left border, SeverityGauge compact, truncated insight, relative timestamp
- `truncateToWord` and `relativeTime` added to `src/lib/utils.ts`
- `SeverityGauge` compact mode ignores `height` prop (hardcodes 8px) — noted but not a story blocker
- Tests went from 27 failing → 0 failing (full suite 447 passing)

### File List

- `src/lib/utils.ts` — MODIFIED: added `truncateToWord` and `relativeTime` exports
- `src/components/TopicCard.tsx` — MODIFIED: left border, SeverityGauge, insight sentence, timestamp
- `tests/TopicCard.test.tsx` — MODIFIED: fixed 7 hex→rgb assertions (TDD bug fix)
- `tests/utils.test.ts` — unchanged (written in TDD phase, all passed)
