# Dashboard Restyle Retrospective: Direction 8 — Hybrid Best-of

**Date:** 2026-02-22
**Scope:** Restyle dashboard to match UX Design Direction 8 mockup
**Participants:** Sidhartharora (Project Lead), Claude (Senior Dev)

## Summary

Restyled the entire dashboard (TickerBar, HeroSection, TopicCard, SeverityGauge) to match the "Hybrid Best-of" design direction: Weather Radar hero + Bloomberg density + Editorial insight text + left border accents. Removed BiggestMovers from dashboard. Three deploy iterations to converge on the mockup.

- **Files Modified:** 10 (4 components, 1 page, 1 CSS, 4 test files)
- **Tests:** 606 passing (0 regressions)
- **TypeScript:** Clean throughout all iterations
- **Deploy Iterations:** 3 (initial restyle → delta format fix → gauge CSS classes)

## Changes Made

### Step 1: `topicAbbreviation()` utility
- Added stock-ticker-style abbreviated codes to `src/lib/utils.ts`
- Pattern: multi-word → `FIRST4-LAST3` (e.g., "Amazon Deforestation Acceleration" → "AMAZ-ACC")
- Single word → up to 8 chars uppercase
- 6 test cases added

### Step 2: TickerBar restyle
- Names replaced with abbreviated codes via `topicAbbreviation()`
- Scores + deltas now use `severityColor(score).badge` inline styles instead of hardcoded Tailwind classes
- Added `font-mono font-bold` for Bloomberg terminal aesthetic
- Ticker speed: 30s → 20s
- Test assertions updated: full names → abbreviated codes, class checks → inline style checks

### Step 3: HeroSection restyle
- **Layout:** Score LEFT (40px/28px mono) + info RIGHT (title, badge, delta, insight)
- **Container:** `bg-[#f5f0e8] dark:bg-[#24243a]` with `border-left: 4px solid ${severityColor}` accent
- **Share button:** Bordered pill style (`border rounded-md px-3 py-0.5`)
- **Gauge:** max-w-[400px], mt-4
- Removed "EcoTicker" text (not in mockup — caught in iteration 2)
- All `data-testid` values preserved → zero test changes needed

### Step 4: TopicCard restyle
- **Layout reorder:** badge+score TOP → name → gauge → insight → secondary data → timestamp
- **Score:** `text-2xl font-mono font-bold` with severity-colored inline style
- **Delta:** severity-colored inline style (replaces `changeDirectionColor` class approach)
- **Card surface:** `bg-[#f5f0e8] dark:bg-[#24243a]`, border `dark:border-[#2e2e48]`
- **Secondary row:** category chip + article count + region + sparkline in compact `text-[11px]` flex row
- Removed `ScoreInfoIcon` from card (not in mockup)
- Removed unused `changeDirectionColor` import

### Step 5: Remove BiggestMovers from dashboard
- Removed import and `<BiggestMovers />` from `page.tsx`
- Removed mock from `dashboard-page.test.tsx`
- Component + test file kept in codebase (not deleted)

### Step 6: Delta format alignment (iteration 2)
- **Mockup cards:** `▲5` / `▼3` (arrow-prefix, no ± sign, compact)
- **Mockup hero:** `▲ +12` / `▼ -3` (arrow, space, signed number)
- **Was:** `+5 ▲` / `-7 ▼` (number-first, ± sign, arrow suffix)
- Custom inline format in TopicCard and HeroSection (kept `formatChange` in utils unchanged for TickerBar)

### Step 7: SeverityGauge CSS class migration (iteration 3)
- **Hero gauge:** `d8-gauge` class — full-width gradient (green→yellow→orange→red) with `d8-gauge-marker` vertical bar at score%
- **Card gauge:** `d8-card-gauge` track + `d8-card-gauge-fill` severity-colored fill at width=score%
- Moved from inline styles to CSS classes in `globals.css`
- Dark mode: `.dark .d8-gauge { background: #2e2e48 }` etc.
- Card gauge height: 4px (was 8px) — matches mockup density

## Issues Encountered

### Issue 1: Docker nginx 502 after container recreation
- **Symptom:** `http://localhost` returned 502 Bad Gateway after `docker compose up -d`
- **Cause:** Nginx resolves upstream hostnames at startup and caches the IP. When `docker compose up -d` recreated the app container, it got a new IP on the bridge network. Nginx kept hitting the old IP → Connection refused.
- **Fix:** `docker compose restart nginx` after app recreation
- **Prevention:** Add `resolver 127.0.0.11 valid=10s;` to nginx config for dynamic DNS resolution (future story)

### Issue 2: TopicCard test assertions assumed class-based coloring
- **Symptom:** 2 tests failed — expected `text-red-400` / `text-green-400` in className
- **Cause:** Delta coloring changed from Tailwind class to inline `style={{ color: severityColor.badge }}`
- **Fix:** Changed assertions to `toHaveStyle({ color: "#dc2626" })` with score-aware color values

### Issue 3: Mockup-to-implementation delta format mismatch
- **Symptom:** Visual comparison showed `+5 ▲` vs mockup's `▲5`
- **Cause:** Reused `formatChange()` utility which has number-first format
- **Fix:** Inline format in TopicCard (`▲${n}`) and HeroSection (`▲ +${n}`) — didn't modify shared utility

## Learnings

### L1: Visual convergence requires iterative deployment
Three deploys were needed to match the mockup. Code review alone can't catch visual mismatches — only side-by-side comparison with the target design reveals gaps. **Budget for 2-3 visual iterations when restyling.**

### L2: Mockup HTML is the source of truth for CSS class names
The user explicitly requested `d8-card-gauge-fill` from the mockup HTML. When a design direction HTML file exists, **extract CSS class names and patterns from it** rather than inventing new ones. This keeps the implementation traceable to the design spec.

### L3: Delta format is a visual design decision, not a data format decision
The mockup used `▲5` (arrow-prefix, no sign) while the codebase had `+5 ▲` (number-first, signed). These are presentation-layer choices that vary by context (ticker vs card vs hero). **Keep the shared utility generic and format at the component level.**

### L4: Docker compose restart order matters for nginx reverse proxy
Nginx caches upstream DNS at startup. Any time `docker compose up -d` recreates the app container, nginx must also be restarted. **Add this to deployment runbook or fix with dynamic resolver.**

### L5: Moving inline styles to CSS classes enables dark mode without JS
The gauge's inline gradient couldn't respond to `.dark` parent class. Moving to CSS classes (`d8-gauge`, `d8-card-gauge`) enabled dark mode via pure CSS selectors. **Prefer CSS classes over inline styles when dark mode is needed.**

## Action Items

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Add `resolver 127.0.0.11 valid=10s;` to nginx.conf for dynamic upstream DNS | Backlog | Open |
| 2 | Add "restart nginx after app recreation" to deployment runbook | Sidhartharora | Open |
| 3 | Visual smoke-test checklist: compare deployed UI against mockup screenshot before marking done | Team | Open |
