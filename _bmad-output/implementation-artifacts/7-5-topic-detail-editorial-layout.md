# Story 7.5: Topic detail page editorial layout

Status: ready-for-dev

## Story

As a social share arrival (or direct visitor),
I want the topic detail page to follow an editorial layout rhythm (score hero → insight lede → dimension body → source citations → score history),
so that I can assess severity within 0–3 seconds and trust the scoring through transparent source citations and dimension breakdowns.

## Acceptance Criteria

### AC1: Editorial rhythm layout order

**Given** a user navigates to `/topic/[slug]`
**When** the page loads
**Then** the content follows this top-to-bottom editorial rhythm:
1. **Score hero** — topic name + score (40px) + UrgencyBadge + SeverityGauge + share button
2. **Insight lede** — full insight sentence + action bar (`Updated Xh ago · [Share]`)
3. **Dimension body** — sub-scores with mini SeverityGauge bars per dimension + reasoning prose
4. **Source citations** — article list with publisher names and publication dates prominently visible
5. **Score history** — sparkline/ScoreChart showing trend over time

### AC2: Mobile above-the-fold (375px)

**Given** the page loads on mobile (375px)
**When** viewed above the fold
**Then** topic name + score + badge + gauge + share button are all visible without scrolling
**And** no preamble content appears above the score (score is the first content below topic name)
**And** topic name uses `line-clamp-2` to prevent long names from pushing hero content below the fold

### AC3: Social share arrival severity glance

**Given** a social share arrival lands on this page
**When** they see the hero within 0–3 seconds
**Then** the severity glance succeeds: badge → gauge → number communicates severity without explanation
**And** the product descriptor or site identity is visible (EcoTicker branding)

### AC4: Dimension sub-scores use mini SeverityGauge

**Given** the dimension breakdown section renders
**When** each sub-score displays
**Then** it uses a mini `SeverityGauge` (compact mode) alongside the dimension score and reasoning text
**And** the gauge vocabulary is consistent with the overall score gauge (same component, same colors)

### AC5: Source citations with prominent publication dates

**Given** the article list renders in the source citations section
**When** articles have `publishedAt` dates
**Then** publication dates are prominently visible (not buried in metadata)
**And** publisher names (`source` field) are clearly attributed
**And** when `publishedAt` is null for an article, display "Date unknown" instead of empty space

### AC6: Graceful empty/null states

**Given** the topic detail page renders
**When** `summaryText` is null or empty
**Then** the insight lede section is omitted entirely (no empty whitespace or placeholder)
**And** when the articles array is empty, the source citations section (including heading) is hidden entirely
**And** when dimension sub-scores are 0, the mini SeverityGauge renders an empty bar (not hidden)

### AC7: Accessibility landmarks

**Given** a screen reader user navigates the topic detail page
**When** they use landmark navigation
**Then** each editorial section (score hero, insight lede, dimensions, sources, score history) has a semantic heading (h2/h3) for screen reader navigation
**And** the back link remains in the DOM and is keyboard-accessible regardless of visual de-emphasis

## Tasks / Subtasks

- [ ] Task 1: Restructure score hero section (AC: #1, #2, #3)
  - [ ] 1.1 Move topic name to the top, remove "← Back to dashboard" from above-the-fold position (move to bottom or reduce prominence)
  - [ ] 1.2 Place score (40px, Geist Mono) directly below topic name — score is the first visual content
  - [ ] 1.3 Place UrgencyBadge + SeverityGauge inline with score on desktop; badge + score share the same line on mobile
  - [ ] 1.4 Add share button co-located with score hero (at the moment of peak intent)
  - [ ] 1.5 Remove the two-column `flex-row` layout — editorial pages are single-column top-to-bottom
- [ ] Task 2: Add insight lede section with action bar (AC: #1)
  - [ ] 2.1 Display full `summaryText` (not truncated) as the insight lede below the hero
  - [ ] 2.2 Add action bar below insight: `Updated Xh ago · [Share]` using `relativeTime` from `src/lib/utils.ts`
  - [ ] 2.3 Style insight as body text (not card/box) — editorial lede feel
- [ ] Task 3: Add mini SeverityGauge to dimension sub-scores (AC: #4)
  - [ ] 3.1 Replace the current plain `div` progress bar in each dimension card with `<SeverityGauge score={score} compact />`
  - [ ] 3.2 Keep existing dimension reasoning behavior (desktop: always visible, mobile: toggle)
- [ ] Task 4: Reorder sections to editorial rhythm (AC: #1)
  - [ ] 4.1 Order: score hero → insight lede → dimension body → article count → source citations (ArticleList) → score history (ScoreChart)
  - [ ] 4.2 Move ScoreChart below ArticleList (history is appendix, citations are body)
- [ ] Task 5: Enhance source citations visibility (AC: #5)
  - [ ] 5.1 Ensure `publishedAt` date is prominently displayed (not secondary metadata)
  - [ ] 5.2 Ensure publisher name (`source`) is clearly visible
  - [ ] 5.3 Add section heading "Sources" or "Source Articles" for editorial clarity
- [ ] Task 6: Add semantic headings to editorial sections (AC: #7)
  - [ ] 6a.1 Add h2/h3 headings to each section: "Dimensions", "Sources", "Score History"
  - [ ] 6a.2 Headings can be visually styled to match editorial tone (not necessarily large/bold)
- [ ] Task 7: Tests (AC: #1-7)
  - [ ] 6.1 Component test: editorial rhythm order — score hero renders before dimension body, dimension body before articles, articles before chart
  - [ ] 6.2 Component test: score hero contains topic name, score, UrgencyBadge, SeverityGauge, share button
  - [ ] 6.3 Component test: insight lede displays summaryText
  - [ ] 6.4 Component test: action bar displays relative timestamp
  - [ ] 6.5 Component test: dimension cards contain SeverityGauge (compact mode)
  - [ ] 6.6 Component test: share button copies URL and shows toast
  - [ ] 6.7 Component test: back link is present (but not above score)
  - [ ] 6.8 Component test: article list section has heading
  - [ ] 6.9 Component test: score history section renders after articles
  - [ ] 6.10 Component test: insight lede hidden when summaryText is null
  - [ ] 6.11 Component test: source citations section hidden when articles array is empty
  - [ ] 6.12 Component test: each editorial section has a semantic heading for accessibility
  - [ ] 6.13 Component test: topic name uses line-clamp-2 class
  - [ ] 6.14 Component test: articles with null publishedAt display "Date unknown"

## Dev Notes

### This is a RESTRUCTURE, not a rewrite

The existing `src/app/topic/[slug]/page.tsx` has all the data fetching, state management, error handling, and event bus integration working correctly. This story restructures the JSX layout and adds SeverityGauge to dimensions — it does NOT change data fetching, routing, or state logic.

### Editorial Rhythm Rationale

The current layout uses a two-column desktop header (name/badge left, score right) which splits the severity glance across both sides. The editorial layout is single-column top-to-bottom, following news brief structure:
- **Headline** → topic name (what)
- **Lede** → score + badge + gauge (how severe)
- **Body** → dimensions (why)
- **Citations** → articles (evidence)
- **Appendix** → score history (trend)

### Score Hero Layout

Desktop (single column):
```
Topic Name
87  BREAKING  [=========|==] gauge  [Share]
```

Mobile (375px):
```
Topic Name
BREAKING 87  [Share]
[=========|==] gauge
```

Key: score uses `font-mono text-4xl` (40px). Badge and score share the same line on mobile for 2-step co-perception.

### Back Link Placement

Move "← Back to dashboard" to less prominent position. Options:
1. Small text link at the very top (above topic name) — minimal, doesn't compete with hero
2. Bottom of page — after all content
3. Keep at top but de-emphasize (already `text-sm text-stone-400`)

Recommendation: keep at top but ensure it's visually subordinate to the score hero. The current implementation is already small/muted — this may just need the score to be visually louder (40px), not the back link to move.

### SeverityGauge in Dimensions

Replace the current manual progress bar:
```tsx
// BEFORE (manual div bar)
<div className="w-full h-2 rounded-full bg-stone-200 dark:bg-gray-700 mb-2">
  <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: colors.badge }} />
</div>

// AFTER (SeverityGauge compact)
<SeverityGauge score={score} compact />
```

This ensures visual consistency — the same gauge component is used everywhere (hero, cards, dimensions).

### Action Bar

The action bar pattern: `Updated Xh ago · [Share]`

Use `relativeTime` from `src/lib/utils.ts` (added in Story 7.4). The share button reuses the existing `handleShare` logic already in the component.

### Insight Lede vs Impact Summary Box

The current implementation wraps `summaryText` in a card-style box (`bg-[#f5f0e8] border rounded-lg p-4`). The editorial layout uses clean typography without a box — the insight lede is inline body text, not a callout card. Remove the card wrapper for the lede section.

### Section Reordering

Current order:
1. Back link
2. Name + badge + score (two-column)
3. Impact summary (card)
4. Sub-score breakdown
5. Article count line
6. ScoreChart
7. ArticleList

New order:
1. Back link (de-emphasized)
2. Score hero (name → score + badge + gauge + share)
3. Insight lede + action bar
4. Dimension body (sub-scores with SeverityGauge)
5. Article count line
6. Source citations (ArticleList — moved above chart)
7. Score history (ScoreChart — moved to end)

### Existing File Locations

| File | Role |
|---|---|
| `src/app/topic/[slug]/page.tsx` | Main page to restructure |
| `src/app/topic/[slug]/layout.tsx` | Metadata generation (NO CHANGES) |
| `src/components/SeverityGauge.tsx` | Gauge component (import into page) |
| `src/components/ArticleList.tsx` | Article list (review for publication date prominence) |
| `src/components/UrgencyBadge.tsx` | Badge component (already used) |
| `src/lib/utils.ts` | `relativeTime`, `severityColor` utilities |
| `tests/` | Existing test files to extend or create new |

### Mock Requirements

- `SeverityGauge` in page tests: mock as div with `data-testid="gauge-bar"` (consistent with TopicCard tests)
- `ScoreChart` mock: already exists in test patterns (simple div with data-testid)
- `ArticleList` mock: mock as div with data-testid for order testing
- `global.fetch` mock: needed for data fetching (existing pattern in topic detail tests)
- `next/navigation` mock: `useParams` returns `{ slug: "test-topic" }` (existing pattern)

### Testing Standards

- Jest with jsdom project (`.test.tsx`)
- Use existing mock patterns from topic detail tests
- Test layout ORDER by checking DOM element positions (use `document.querySelector` and compare `compareDocumentPosition`)
- Test SeverityGauge presence in dimension cards
- Test share button toast behavior (existing pattern)
- Mock `Date.now()` for relative time assertions

### Project Structure Notes

- Modified files: `src/app/topic/[slug]/page.tsx`, possibly `src/components/ArticleList.tsx` (heading), test files
- No new files (except possibly a new test file if the existing one doesn't cover topic detail)
- No schema changes
- No migration needed

### Edge Cases & Risks

1. **Existing test breakage:** Restructuring the JSX will break existing tests that assert on specific DOM structure or element ordering. Tests in `tests/` that reference topic detail must be updated. **Mitigation:** Before restructuring, grep all test files for topic detail selectors/testids and list which assertions will break. Update tests in the same commit as the restructure.

2. **SeverityGauge compact mode in dimensions:** The compact mode renders a solid-color bar. For dimension sub-scores, this replaces the current gradient fill bar. Visually different but functionally equivalent. When score is 0, the gauge should render an empty bar (not disappear from DOM).

3. **`summaryText` null/empty:** When both `latest?.overallSummary` and `topic.impactSummary` are null, the insight lede section should be omitted entirely (no empty space). **Do not render an empty `<section>` — conditionally omit the entire block.**

4. **Share button duplication:** The hero has a share button, and the action bar has a share link. **Decision: single share button in the hero row only.** The action bar shows `Updated Xh ago` without a second share link, avoiding confusion about which share button to use.

5. **Mobile 375px above-the-fold constraint:** The hero must fit in ~172px on mobile. Topic name (1-2 lines) + score row (badge + number + share) + gauge = ~120-160px. Long topic names (3+ lines) may push gauge below the fold. **Mandatory: `line-clamp-2` on topic name** as a safety valve (promoted to AC2).

6. **`relativeTime` import:** Already available in `src/lib/utils.ts` from Story 7.4. If Story 7.4 is not yet merged, the `relativeTime` function also exists locally in `src/components/HeroSection.tsx` — but prefer the utils.ts version for DRY.

7. **Back link accessibility:** Moving or hiding the back link affects keyboard navigation. Keep it in the DOM, just visually de-emphasize it. Must remain keyboard-focusable — never use `display: none` or `aria-hidden`.

8. **Empty articles array:** When `articles` is empty (new topic, no articles yet), hide the entire source citations section including the "Sources" heading. Do not render an empty list.

9. **`publishedAt` null:** Some articles may have null `publishedAt` (GNews occasionally omits it). Display "Date unknown" instead of empty space or "Invalid Date".

10. **Dark mode visual regression:** When removing the card wrapper from insight lede, verify the text contrast ratio is sufficient in both light and dark mode. The card wrapper provided background contrast — without it, body text must have adequate contrast against the page background directly.

11. **Loading skeleton gap:** The hero section should show a skeleton/placeholder during fetch, not a blank space. The existing loading state in the component should be verified to cover the new layout structure — if it currently shows a generic spinner, update it to show a skeleton matching the editorial layout shape.

12. **Social share arrival on slow connection:** First-time visitors from social links may see a loading flash before content appears. The hero skeleton is critical for this persona — score + badge placeholders communicate "content is coming" rather than an empty page.

### Key Constraints

- Page is `"use client"` — all components must be client-compatible
- Data fetching via `fetch` to `/api/topics/${slug}` — no changes to API
- Event bus refresh must continue working
- Share button clipboard logic already implemented — reuse, don't rewrite
- `generateMetadata` in layout.tsx is untouched (server-side, separate file)

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#Story 7.5] — Full AC and dev notes
- [Source: docs/plans/2026-02-22-architecture-audit-ux-spec.md] — Editorial rhythm specification
- [Source: src/app/topic/[slug]/page.tsx] — Current implementation to restructure
- [Source: src/components/SeverityGauge.tsx] — Gauge component (compact mode)
- [Source: src/components/HeroSection.tsx] — Hero pattern reference (Story 7.2)
