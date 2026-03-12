# Plan: Topic Detail Page — Visual Alignment

## Story
Single story: Redesign `/topic/[slug]` detail page to match the landing page's flat, gut-punch design language. Score-first vertical stack, flat rows, no cards.

## Intent
The landing page was rebuilt with a "terminal/ticker" aesthetic — dramatic scores, left-border accents, flat lists, no card containers. The topic detail page still uses the old "SaaS dashboard" language — rounded-lg cards, background fills, 3-column grids. This creates a visual disconnect when navigating between pages. The fix: make the detail page speak the same language, with Option B's score-first vertical layout where the score IS the page.

## Out of Scope
- No new components or abstractions
- No mobile-specific refinements beyond what's needed for the flat row treatment
- No score chart visual refresh (colors, line styles) — just strip the card wrapper
- No changes to data fetching, API responses, or business logic
- No changes to the landing page or shared layout

## Architecture
**Direct modify, 3 files.** ArticleList and ScoreChart are only used on the topic detail page — safe to modify in place. No ripple effects.

### Score Hero → Score-First Vertical Stack
Current: `text-4xl` (36px) score in a flex-wrap row beside badge + change + share.
Target: Giant monospace score (72px ≥30, 48px <30) at the top, severity-colored. Badge + change on same line below. Name below that. Left-border accent starts on insight lede, not the score.

### Dimensions → Flat Rows with Left-Border Accents
Current: 3-column grid of `bg-[#f5f0e8] rounded-lg p-4` cards with score, level, gauge, reasoning.
Target: Vertical stack of flat rows. Each row: left-border accent (colored by that dimension's severity) + score + label + mini gauge + level badge. Tap to expand reasoning. No backgrounds, no rounded corners, no grid.

**Monkey note (confidence 82):** The Monkey questioned whether dimensions earn their place at all. Navigator ruling: they survive because the overall score is a weighted composite — individual dimensions tell you *which aspect* is driving the number. But the Monkey is right that dimension rows should NOT look like navigable landing page rows. The left-border accent correctly signals "data, not navigation." Keep lean.

### Articles → Flat Rows
Current: `bg-[#f5f0e8] rounded-lg p-3` card blocks with title, source, date, and 2-line summary.
Target: Tight rows — title + source + date on one line. No card wrapper. Keep summary as a subtle second line (line-clamp-1) rather than removing it entirely, since ambiguous titles exist.

### Score Chart → Light Border Only
Current: `bg-[#f5f0e8] rounded-lg p-4` card wrapper with duplicate `<h3>Score History</h3>`.
Target: Strip background fill. Keep light border (`border border-stone-200 dark:border-gray-800 rounded-lg`). Remove the internal `<h3>` — the section `<h2>` above already labels it.

### Cuts
- `ScoreInfoIcon` — remove from hero. The `?` tooltip floats awkwardly next to a 72px number. The scoring page link is accessible from the footer.
- Weight percentages in dimension rows — visual noise at row scale. Info lives on the scoring page.
- Dimension card backgrounds and rounded corners
- Article card backgrounds and rounded corners
- Score chart background fill
- Score chart duplicate `<h3>` heading

## Tasks
- [ ] Task 1: Rewrite score hero section in page.tsx — giant score on top, badge + change below, name below that, left-border on lede (independent)
- [ ] Task 2: Rewrite dimension section in page.tsx — flat rows with individual left-border accents, tap-to-expand reasoning (independent)
- [ ] Task 3: Flatten ArticleList.tsx — strip card wrappers, tight rows (independent)
- [ ] Task 4: Flatten ScoreChart.tsx — strip bg, keep light border, remove duplicate h3 (independent)
- [ ] Task 5: Update tests — new DOM structure assertions for all changed components (depends on: 1, 2, 3, 4)

## Key Files
| File | Action |
|------|--------|
| `src/app/topic/[slug]/page.tsx` | Rewrite hero + dimensions sections |
| `src/components/ArticleList.tsx` | Strip card wrappers → flat rows |
| `src/components/ScoreChart.tsx` | Strip bg card, keep border, remove h3 |
| `tests/TopicDetailPage.test.tsx` | Update assertions for new DOM |
| `tests/ArticleList.test.tsx` | Update selectors for flat rows |
| `tests/ScoreChart.test.tsx` | Update selectors for borderless chart |

## Visual Spec

### src/app/topic/[slug]/page.tsx — Score Hero
- `text-xl sm:text-2xl` → DELETE (topic name moves below score, gets new sizing)
- `font-mono text-4xl font-bold text-stone-800 dark:text-white` → `font-mono font-bold` with dynamic `text-[72px]` (score ≥30) or `text-[48px]` (score <30), severity-colored via `style={{ color: colors.badge }}`
- DELETE: `flex flex-wrap items-center gap-3 mb-3` score row wrapper (score moves to top, stacked)
- DELETE: `ScoreInfoIcon` import and usage
- ADD: Score at top of section, standalone `<span>` (not inside a flex row)
- ADD: Badge + change on a new line below score: `flex items-center gap-3`
- ADD: Topic name as `<h1>` below badge line: `text-[22px] font-semibold text-stone-800 dark:text-white`
- KEEP: `SeverityGauge` below name (full-width gradient gauge)
- MOVE: Share button + updated time to a metadata line below gauge: `flex items-center gap-3 mt-3 text-sm text-stone-400`
- ADD: Left-border accent on insight lede section: `pl-5 py-2` with `style={{ borderLeft: 4px solid ${colors.border} }}`
- KEEP: `data-testid="score-hero"`, `data-testid="topic-name"`, `data-testid="detail-score"`, `data-testid="detail-change"`, `data-testid="share-button"`

### src/app/topic/[slug]/page.tsx — Dimensions
- DELETE: `grid grid-cols-1 sm:grid-cols-3 gap-4` wrapper
- ADD: `flex flex-col gap-1` wrapper (same as TopicList)
- DELETE: `bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4` on each dimension
- ADD: `flex items-center gap-3 px-3 py-2` on each dimension row
- ADD: `style={{ borderLeft: 4px solid ${dimensionColors.border} }}` per row (colored by THAT dimension's severity)
- DELETE: Weight percentage spans (`({weight} weight)`)
- Score display: `font-mono font-bold text-sm w-8 shrink-0 text-right` (match TopicList score style)
- Label: `flex-1 text-sm font-medium text-stone-800 dark:text-gray-200`
- Level badge: keep existing `text-xs px-2 py-0.5 rounded-full` with severity colors
- Mini gauge: `w-16 shrink-0` with `<SeverityGauge score={score} compact />`
- Reasoning expand: button at end of row, `▼`/`▲` icon, expanded text below row
- KEEP: all `data-testid="dimension-card-*"` (rename to `dimension-row-*`), `dimension-score-*`, `dimension-level-*`

### src/components/ArticleList.tsx
- DELETE: `bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-3` on article items
- DELETE: `space-y-3` on wrapper
- ADD: `flex flex-col gap-1` on wrapper (match TopicList spacing)
- ADD: `flex items-center gap-3 px-3 py-2 rounded-md bg-stone-50 dark:bg-gray-900 border border-stone-200 dark:border-gray-800` per row (match TopicList row style)
- Article title: `flex-1 text-sm font-medium text-stone-700 dark:text-gray-200 truncate`
- Source + date: `text-xs text-stone-500 dark:text-gray-400 shrink-0` (inline, not stacked)
- KEEP: summary as subtle subtitle `text-xs text-stone-400 line-clamp-1` below title (within the row, not a separate block)
- KEEP: `data-testid="article-item"`, `data-testid="article-list"`

### src/components/ScoreChart.tsx
- `bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4` → `border border-stone-200 dark:border-gray-800 rounded-lg p-4` (strip bg, keep border)
- DELETE: `<h3 className="text-sm font-semibold text-stone-600 dark:text-gray-300 mb-3">Score History</h3>` (duplicate — section h2 above covers it)
- KEEP: dimension toggles, tooltip styling, chart internals unchanged
- KEEP: `data-testid="score-chart"`

## Copy
- Back link: `← Back` (was "← Back to dashboard")
- Error state: `Couldn't load topic. Try again.` (shorter)
- Article count: `Scored from {n} articles` (was "Latest score based on {n} articles")
- No articles: `No sources yet` (was "No articles available for this topic")
- Empty sources: `No sources yet` (was "No articles yet")
- Dimension expand: `▼` / `▲` (no text label)
- Insufficient dimension: `—` for score, no expand available

## Challenge

### Triage
**Medium** — visual-only changes across 3 source files + 3 test files. No new behavior, no data model changes, no API changes.

### Values Alignment
- **"Nothing decorative"**: Stripping card backgrounds, rounded corners, grid layout — all chrome that wasn't serving the data.
- **"Content over chrome"**: Score-first layout puts the number before the name. The data leads.
- **"Subtract until it breaks"**: Cut ScoreInfoIcon, weight percentages, duplicate h3, card wrappers. Kept dimensions (they answer "why is this score what it is" — that's insight).
- **YAGNI**: No variant props, no new components, no "what if we need cards later" flexibility.

### Dependency Map
Tasks 1-4 are independent — can parallelize. Task 5 (tests) depends on all four completing.

```
Task 1 (hero)  ──┐
Task 2 (dims)  ──┤
Task 3 (arts)  ──┼── Task 5 (tests)
Task 4 (chart) ──┘
```

### Top Failure Modes
1. **Test data-testid drift**: Renaming `dimension-card-*` to `dimension-row-*` could break tests that aren't updated. Mitigation: grep all testids before and after.
2. **Dark mode regression**: Stripping backgrounds changes the contrast hierarchy. The flat row treatment uses `bg-stone-50 dark:bg-gray-900` which is tested on the landing page but not yet on the detail page's content density. Mitigation: visual check in both themes after build.
3. **Mobile dimension rows overflow**: Landing page topic rows have fixed-width elements (w-8 score, w-16 gauge). Dimension labels are longer ("Ecological Impact" vs "Agriculture"). Mitigation: truncate label on mobile, or shorten to "Ecology" / "Health" / "Economy" (matching ScoreChart's existing labels).

### Monkey Finding
**Existence Question** on dimensions (confidence 82). Survived with caveat: dimensions stay because they decompose the overall score. But the redesign must NOT create visual false equivalence with navigable topic rows. Left-border accent (not bg/border) correctly signals "data, not link."

### Go/No-Go
**GO.** Medium scope, clear spec, no new abstractions, values-aligned. All failure modes have mitigations. Monkey finding addressed — dimensions survive but stay lean.
