# Plan: Gut-Punch Landing Page

## Story
Rebuild the EcoTicker landing page. Kill the ticker bar, redesign the hero and topic list so the first load makes you feel the state of the environment. Minimalist — nothing decorative.

## Intent
The current landing page is informational, not visceral. It presents data in a dashboard layout (card grid, ticker bar, filter chips) that reads like a control panel — comfortable, organized, forgettable. The redesign strips the page to two elements: one dominant hero topic that makes you uncomfortable, and a tight list of remaining topics with compact severity gauges that create peripheral dread through color accumulation. Every element earns its place or gets cut.

## Out of Scope
- Biggest Movers rethink (separate story)
- Animation/transitions (separate story)
- selectHeroTopic algorithm changes (pre-existing behavior, separate story)
- Mobile-specific layout optimizations beyond responsive basics
- Topic detail page changes
- API changes

## Architecture

**Fully server-rendered landing page.** No client-side fetch. `page.tsx` queries all topics from DB, selects the hero, passes the rest (sorted by score descending) to a new `TopicList` server component. The only client JS on the page is HeroSection's share button toast.

**Key decisions:**
- New `TopicList` component rather than modifying `TopicGrid` — TopicGrid has 14 tests validating filter behavior that doesn't exist in the new design. Modifying it would orphan all those tests. TopicGrid stays untouched, just not rendered on the landing page.
- HeroSection modified in place — same component, bigger visual weight, fallback narrative chain for null impactSummary.
- TickerBar removed from layout.tsx — file and tests kept, just not imported.
- Compact severity gauges in TopicList rows — Monkey caught that plain text kills peripheral dread. The gauge is data, not decoration.

## Tasks
- [ ] Task 1: Write TopicList tests (independent)
- [ ] Task 2: Implement TopicList component (depends on: 1)
- [ ] Task 3: Remove TickerBar from layout.tsx (independent)
- [ ] Task 4: Update HeroSection — bigger score, full-width gauge, impactSummary with fallback chain (independent)
- [ ] Task 5: Update HeroSection tests for new visual contract (depends on: 4)
- [ ] Task 6: Update page.tsx — swap TopicGrid for TopicList, pass restTopics (depends on: 2)
- [ ] Task 7: Update dashboard-page.test.tsx mock (depends on: 2, 6)
- [ ] Task 8: Full test suite + build verification (depends on: all above)

## Key Files

### Create
- `src/components/TopicList.tsx` — Server component. Renders sorted topic rows with score, name, change, urgency tag, compact severity gauge. Pure props, no client JS.
- `tests/TopicList.test.tsx` — TDD tests for TopicList.

### Modify
- `src/app/page.tsx` — Swap TopicGrid import for TopicList. Compute restTopics from mapped array. Pass as props.
- `src/app/layout.tsx` — Remove TickerBar import and render. Change controls div from `top-12` to `top-4`.
- `src/components/HeroSection.tsx` — Increase score to ~72px. Remove card background/border. Full-width gauge (remove max-w-[400px]). Add impactSummary display with fallback chain (computeHeadline stays as primary, impactSummary below when present).
- `tests/dashboard-page.test.tsx` — Swap TopicGrid mock for TopicList mock.
- `tests/HeroSection.test.tsx` — Update dramatic mode font size assertion. Add test for impactSummary display and null fallback.

### Untouched
- `src/components/TopicGrid.tsx` — Kept, not rendered on landing page
- `src/components/TopicCard.tsx` — Kept, used on topic detail page
- `src/components/Sparkline.tsx` — Kept, used on topic detail page
- `src/components/TickerBar.tsx` — Kept as file, removed from layout
- `src/components/SeverityGauge.tsx` — Kept, used by hero (full mode) and TopicList (compact mode)
- `src/components/UrgencyBadge.tsx` — Kept, used by hero
- `src/lib/utils.ts` — No changes needed
- `src/lib/types.ts` — No changes needed
- All existing test files except dashboard-page.test.tsx and HeroSection.test.tsx

## Challenge

### Triage
Medium — structural changes to 4-5 files, 1 new component. No DB/API changes, no new dependencies.

### Values Alignment
- **YAGNI**: No unused abstractions. TopicList does one thing.
- **"Delete before you add"**: TickerBar removed. Sparklines removed from landing. Filters removed. Net fewer components on the page.
- **"Subtract until it breaks, then add one back"**: Monkey caught over-subtraction (text-only list). Added compact gauge back — minimum needed.
- **"Nothing decorative"**: Gauge bar is data (encodes score visually). Share button is functional. Everything else is score/name/change/urgency.

### Dependency Map
```
Parallel:   [1] TopicList tests    [3] Remove TickerBar    [4] HeroSection visual
Sequential: [1] → [2] TopicList impl → [6] page.tsx swap → [7] dashboard test
            [4] → [5] HeroSection tests
Final:      [8] Full verification (all above)
```

### Top Failure Modes
1. HeroSection test breakage — existing tests assert on `text-[40px]` class. Must update alongside component.
2. Dashboard test mock swap — if page.tsx imports TopicList but test still mocks TopicGrid, real TopicList renders in jsdom and hits next/link issues.
3. Empty state — if no topics exist, both hero and list are empty. Must handle gracefully.

### Go/No-Go
**GO.** Monkey findings addressed. Architecture is minimal, server-rendered, values-aligned. All 622 existing tests stay green except 2 test files that get explicit updates.
