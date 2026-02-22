# Story 7.1: Unified severity color utility and SeverityGauge component

Status: ready-for-dev

## Story

As a first-time visitor,
I want to see a visual gauge that communicates severity at a glance,
so that I understand the 0-100 scale without reading any explanation.

## Acceptance Criteria

### AC1: `severityColor(score)` utility

**Given** a numeric score between 0 and 100
**When** `severityColor(score)` is called
**Then** it returns an object with: `badge` (foreground hex), `gauge` (background hex), `border` (left-border hex), `text` (readable label)
**And** badge colors are WCAG AA compliant: BREAKING `#dc2626`, CRITICAL `#c2410c`, MODERATE `#a16207`, INFORMATIONAL `#15803d`

### AC2: `SeverityGauge` component renders correctly

**Given** a score is passed to `<SeverityGauge score={87} />`
**When** the component renders
**Then** it displays a horizontal gradient bar (green -> yellow -> orange -> red) with a distinct marker at `left: 87%`
**And** gradient has subtle inflection points at score boundaries (30, 60, 80)
**And** minimum width is 120px; below 120px, fall back to solid severity color
**And** bar thickness is 8-10px with rounded end-caps
**And** marker has a distinct shape (triangle or line) with subtle shadow
**And** component is fully SSR-compatible (zero client JS dependency)
**And** `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` for screen readers

### AC3: Migration of existing consumers

**Given** existing components use `scoreToHex()`, `urgencyColor()`, or `changeColor()`
**When** the unified `severityColor()` utility is complete
**Then** all existing consumers are migrated to use the new utility
**And** the old functions are removed
**And** no raw hex values for severity colors remain in component files

## Tasks / Subtasks

- [ ] Task 1: Create `severityColor()` utility (AC: #1)
  - [ ] 1.1 Add `severityColor(score: number)` to `src/lib/utils.ts`
  - [ ] 1.2 Returns `{ badge, gauge, border, text, change, sparkline }` with WCAG AA hex values
  - [ ] 1.3 Write unit tests for all 4 severity levels + boundary scores (0, 29, 30, 59, 60, 79, 80, 100)
- [ ] Task 2: Create `SeverityGauge` component (AC: #2)
  - [ ] 2.1 Create `src/components/SeverityGauge.tsx` as a server component (no `"use client"`)
  - [ ] 2.2 Pure CSS gradient bar with inline styles (green->yellow->orange->red, inflections at 30/60/80)
  - [ ] 2.3 Absolute-positioned marker at `left: ${score}%`
  - [ ] 2.4 Min-width 120px logic: below 120px, solid color fallback
  - [ ] 2.5 Accessibility: `role="meter"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`
  - [ ] 2.6 Write component tests in jsdom project
- [ ] Task 3: Migrate existing consumers (AC: #3)
  - [ ] 3.1 Replace `urgencyColor()` calls in `UrgencyBadge.tsx` and `src/app/topic/[slug]/page.tsx`
  - [ ] 3.2 Replace `scoreToHex()` call in `TopicCard.tsx` (Sparkline color)
  - [ ] 3.3 Replace `changeColor()` calls in `TopicCard.tsx`, `BiggestMovers.tsx`, `src/app/topic/[slug]/page.tsx`
  - [ ] 3.4 Replace inline `scoreColor` ternary in `TopicCard.tsx` (lines 9-16)
  - [ ] 3.5 Remove old functions (`scoreToHex`, `urgencyColor`, `changeColor`) from `src/lib/utils.ts`
  - [ ] 3.6 Update all affected tests to use new utility
  - [ ] 3.7 Verify no raw severity hex values remain in component files

## Dev Notes

### `severityColor()` Design

Return type:
```typescript
interface SeverityColors {
  badge: string;    // foreground hex for badges/text — WCAG AA on white
  gauge: string;    // muted/dark variant for gauge gradient stops
  border: string;   // left-border color for topic cards (Story 7.4 will consume)
  text: string;     // readable label: "Breaking" | "Critical" | "Moderate" | "Informational"
  sparkline: string; // hex for Sparkline component (replaces scoreToHex)
  change: string;   // Tailwind class for change delta text (replaces changeColor)
}
```

Score thresholds (same as existing `scoreToUrgency()`):
- 80-100: Breaking — badge `#dc2626`, gauge `#991b1b` (red-800)
- 60-79: Critical — badge `#c2410c`, gauge `#9a3412` (orange-800)
- 30-59: Moderate — badge `#a16207`, gauge `#854d0e` (yellow-800)
- 0-29: Informational — badge `#15803d`, gauge `#166534` (green-800)

The "two reds rule": badge uses bright variants (`-500`/`-600`), gauge uses muted/dark (`-800`). Badge color and gauge color at the same score must be perceptibly the same hue.

### `SeverityGauge` Component Design

- Pure CSS, no JS runtime, no `"use client"`. Inline styles for gradient and marker position.
- Gradient stops: `linear-gradient(to right, #15803d 0%, #854d0e 30%, #9a3412 60%, #991b1b 80%, #991b1b 100%)`
- Marker: absolute-positioned `div` with `left: ${score}%`, triangle/line shape via CSS borders, subtle `box-shadow`
- Container: `min-width: 120px`, `height: 8px`, `border-radius: 4px` (rounded end-caps)
- Below 120px: render a solid `div` with background color from `severityColor(score).gauge`
- The 120px breakpoint check: use a container class with `min-w-[120px]` — the component always renders the gradient, but has a CSS fallback. OR: accept a `compact` boolean prop for explicit small-size mode.
- Dark mode: gauge gradient should look good on both light and dark backgrounds. Test both.

### Migration Map (Exact Consumer Locations)

| Consumer File | Current Function | New Usage |
|---|---|---|
| `src/components/UrgencyBadge.tsx:5` | `urgencyColor(urgency)` | `severityColor(scoreToUrgency_inverse)` — NOTE: UrgencyBadge takes `urgency` string, not score. Keep `urgencyColor()` as a thin wrapper OR change UrgencyBadge to accept score. Preferred: add `urgencyToScore()` or pass score directly from parent. |
| `src/components/TopicCard.tsx:57` | `scoreToHex(topic.currentScore)` | `severityColor(topic.currentScore).sparkline` |
| `src/components/TopicCard.tsx:40` | `changeColor(topic.change)` | `severityColor(topic.currentScore).change` — NOTE: `changeColor` is about +/- direction, not severity. Consider keeping it separate or including directionality in return. |
| `src/components/TopicCard.tsx:9-16` | inline `scoreColor` ternary | `severityColor(topic.currentScore).badge` as Tailwind class or inline style |
| `src/components/BiggestMovers.tsx:53` | `changeColor(m.change)` | Same consideration as TopicCard |
| `src/app/topic/[slug]/page.tsx:161` | `changeColor(topic.change)` | Same consideration |
| `src/app/topic/[slug]/page.tsx:209` | `urgencyColor(urgency)` | `severityColor(score)` — parent has score available |

**CRITICAL DESIGN DECISION for `changeColor()`:** `changeColor()` maps change DIRECTION (positive/negative/zero) to red/green/gray. This is conceptually different from severity. Options:
1. **Keep `changeColor()` as a separate utility** — it's not about severity, it's about direction. Rename it for clarity.
2. **Add `directionColor(change)` to the return.** The epic AC says "all existing consumers are migrated" and "old functions are removed." If keeping a separate function, name it differently so the old name is removed.

**Recommended:** Keep change direction logic as a renamed function `changeDirectionColor(change: number)` (or fold into `severityColor` return as `change` field). The AC says remove `changeColor()` — so either rename or absorb.

**CRITICAL DESIGN DECISION for `UrgencyBadge`:** UrgencyBadge currently takes `urgency: Urgency` string. Parents always have the score available. Options:
1. Change `UrgencyBadge` to accept `score: number` and compute colors internally via `severityColor(score)`.
2. Keep `urgency` prop but compute colors from a score-based lookup.

**Recommended:** Option 1 — change prop to `score: number`. The `urgency` label can be derived from `scoreToUrgency(score)` (keep this function). This eliminates the need for `urgencyColor()` entirely.

### Existing Tests to Update

- `tests/utils.test.ts` — has tests for `scoreToHex`, `urgencyColor`, `changeColor`. Remove those, add `severityColor` tests.
- `tests/TopicCard.test.tsx` — may reference color outputs
- `tests/UrgencyBadge.test.tsx` — if it exists, update for new prop
- Any snapshot tests referencing old Tailwind classes

### Project Structure Notes

- `severityColor()` goes in `src/lib/utils.ts` (keep co-located with `scoreToUrgency`, `formatChange`)
- `SeverityGauge.tsx` goes in `src/components/SeverityGauge.tsx` (follows existing component pattern)
- DO NOT create a separate `src/lib/severity.ts` — the epic mentions it as an option but `utils.ts` is the established location and the file is small
- Keep `scoreToUrgency()` — it's used by the API route for computing urgency labels and is conceptually distinct from color
- Keep `formatChange()` — it formats the change number with arrows, not related to colors

### Testing Standards

- Jest with two projects: `node` (.test.ts) and `react` (.test.tsx)
- Component tests mock `recharts` as simple divs with data-testid
- Test boundary scores: 0, 29, 30, 59, 60, 79, 80, 100
- Test SeverityGauge: verify `role="meter"`, `aria-valuenow`, gradient renders, marker position
- Test dark mode class handling if applicable
- Mock `next/link` as `<a>` in component tests

### References

- [Source: docs/plans/2026-02-22-architecture-audit-ux-spec.md] — Gap #1 (SeverityGauge) and #4 (severityColor utility), WCAG color corrections table
- [Source: _bmad-output/planning-artifacts/epic-7.md#Story 7.1] — Full AC and dev notes
- [Source: src/lib/utils.ts] — Current `scoreToHex`, `urgencyColor`, `changeColor` implementations
- [Source: src/components/TopicCard.tsx] — Primary consumer with inline scoreColor ternary
- [Source: src/components/UrgencyBadge.tsx] — Consumer of `urgencyColor()`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
