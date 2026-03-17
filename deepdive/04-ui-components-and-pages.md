# 4. UI Components & Pages

## Build & Style Configuration

### `next.config.ts`
Single option: `output: "standalone"` for Docker builds.

### `postcss.config.mjs`
Uses `@tailwindcss/postcss` only (Tailwind 4).

### `src/app/globals.css`

**Theme tokens (CSS custom properties):**
```
:root  → --background: #faf7f2 (warm cream)  --foreground: #292524 (dark charcoal)
.dark  → --background: #0a0a0a              --foreground: #ededed
```

**Dark mode variant:** `@custom-variant dark (&:where(.dark, .dark *))` — class-based only (no media query).

**Ticker animation:**
```css
@keyframes ticker-scroll { 0% translateX(0) → 100% translateX(-50%) }
.ticker-scroll { animation: ticker-scroll 20s linear infinite; }
.ticker-scroll:hover { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .ticker-scroll { animation: none; } }
```

**Gauge CSS classes:**
- `d8-gauge` (hero): 10px tall, max-width 400px, gradient fill (green→orange→red), absolute marker needle
- `d8-card-gauge` (compact): 4px tall, solid severity-color fill

---

## Type System (`src/lib/types.ts`)

- `Urgency`: breaking | critical | moderate | informational
- `SeverityLevel`: MINIMAL | MODERATE | SIGNIFICANT | SEVERE | INSUFFICIENT_DATA
- `Category`: 10 values
- `Topic`, `Article`, `ScoreHistoryEntry`, `TickerItem`, `TopicDetail`

---

## Utility Functions (`src/lib/utils.ts`)

| Function | Purpose |
|---|---|
| `severityColor(score)` | Returns 6-color object: badge, gauge, border, text, sparkline, change |
| `changeDirectionColor(change)` | Tailwind text class — red/green/gray |
| `formatChange(change)` | "+5 ▲" / "-3 ▼" / "0 ─" |
| `scoreToUrgency(score)` | ≥80=breaking, ≥60=critical, ≥30=moderate, else informational |
| `computeHeroScore(topic)` | `currentScore * 0.6 + abs(change) * 0.4` |
| `selectHeroTopic(topics)` | Highest heroScore, ties: most recent updatedAt, then highest score |
| `computeHeadline(topics)` | 6-rule waterfall: escalation → de-escalation → big move → stable → fallback |
| `truncateToWord(text, maxLen)` | Word-boundary truncation with "..." |
| `relativeTime(dateStr)` | "just now" / "5m ago" / "3h ago" / "2d ago" |
| `topicAbbreviation(name)` | Single word → 8 chars; multi-word → first4+"-"+last3 |
| `urgencyRank(urgency)` | informational=0, moderate=1, critical=2, breaking=3 |
| `CATEGORY_LABELS` | Maps snake_case categories to display labels |

---

## Event Bus (`src/lib/events.ts`)

Thin wrapper over `window.dispatchEvent`/`addEventListener`. Single event: `'ui-refresh'` (void payload).

- `eventBus.emit('ui-refresh')` — dispatches CustomEvent
- `eventBus.subscribe('ui-refresh', fn)` — returns cleanup function

**Consumers:** TickerBar, TopicGrid, BiggestMovers, TopicDetailPage subscribe. RefreshButton emits.

---

## Root Layout (`src/app/layout.tsx`)

**Type:** Server component.

**Fonts:** Geist Sans + Geist Mono via `next/font/google`.

**Anti-FOUC script** (inline, synchronous, in `<head>`):
```js
(function(){
  var t = localStorage.getItem('ecoticker-theme');
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
})();
```

**JSON-LD:** `WebSite` schema.

**Metadata:** `title.template: "%s — EcoTicker"`, `metadataBase` from `NEXT_PUBLIC_BASE_URL`.

**Component tree:**
```
<html lang="en" suppressHydrationWarning>
  <head>
    [anti-FOUC script]
    [JSON-LD script]
  </head>
  <body>
    <ThemeProvider>
      <div.fixed.top-4.right-4.z-50>
        <RefreshButton />
        <ThemeToggle />
      </div>
      <main.max-w-7xl.mx-auto>
        <StaleDataWarning />
        {children}
      </main>
      <Footer />
    </ThemeProvider>
  </body>
</html>
```

---

## Theme System

### ThemeProvider (`src/components/ThemeProvider.tsx`)
- `"use client"`
- Creates `ThemeContext` with `{ theme: Theme; toggleTheme: () => void }`
- `useState<Theme>("dark")` initial
- `useEffect` on mount: reads `document.documentElement.classList.contains("dark")` to sync React state
- `toggleTheme()`: flips state, toggles `.dark` class on `<html>`, writes to localStorage (`ecoticker-theme`)
- Exports `useTheme()` hook

### ThemeToggle (`src/components/ThemeToggle.tsx`)
- Sun SVG (dark→light) / Moon SVG (light→dark)
- `p-2 rounded-lg bg-[#e8dfd3] dark:bg-gray-800`
- Dynamic `aria-label`

**Flow:** inline script → DOM class → ThemeProvider reads DOM → React state → toggleTheme → class + localStorage

---

## Pages

### Homepage (`src/app/page.tsx`) — Server Component

- `export const dynamic = "force-dynamic"` (no page caching)
- Direct Drizzle query: `db.select().from(topics).where(eq(topics.hidden, false))`
- `selectHeroTopic(mapped)` picks hero
- `computeHeadline(mapped)` generates insight
- `restTopics` = everything except hero, sorted currentScore DESC

**Renders:** subtitle text → HeroSection → TopicList (sr-only h2)

---

### Topic Detail (`src/app/topic/[slug]/page.tsx`) — Client Component

- `useParams<{ slug: string }>()`
- Fetches `/api/topics/${slug}` client-side
- States: data, loading, error, errorMessage, expandedDimensions, copied

**Sections:**
1. **Score Hero**: Giant digit (72px if ≥30, 48px if <30), badge, change, gauge with marker, share button
2. **Insight Lede**: prefers `overallSummary`, falls back to `impactSummary`
3. **Dimensions**: 3 rows (eco 40%, health 35%, econ 25%) with score, level badge, compact gauge, reasoning. Mobile: toggle expand. INSUFFICIENT_DATA → "N/A" + "No Data"
4. **Article Count**: attribution line
5. **Sources**: `<ArticleList>`
6. **Score History**: `<ScoreChart>`

Loading: pulse skeleton. Error: message + back link.

---

### Topic Layout (`src/app/topic/[slug]/layout.tsx`)
- `generateMetadata`: async, queries DB for OG tags. 404 fallback title.
- Render: transparent passthrough `<>{children}</>`

---

### Scoring Page (`src/app/scoring/page.tsx`) — Server Component
Static, no data fetching. `max-w-3xl`. 7 sections: severity scale, 3 dimensions, weights rationale, formula, urgency levels, data sources, limitations.

### Data Policy Page (`src/app/data-policy/page.tsx`) — Server Component
Static. `max-w-3xl`. 7 sections: what collected/not, legal basis (GDPR 6(1)(f)), rights (15/17/21), retention, controller, changes.

---

## Components

### HeroSection (`src/components/HeroSection.tsx`) — Client
- Props: `{ heroTopic: Topic | null; headline?: string }`
- Left border accent (severity-colored)
- Giant score digit: 72px if ≥30 (isDramatic), 48px if <30
- UrgencyBadge + change indicator
- Headline + optional impact summary
- Full SeverityGauge (hero variant)
- Share button: copies `/topic/${slug}` to clipboard, 3s toast
- Null state: fallback "Environmental News Impact Tracker"

### TopicList (`src/components/TopicList.tsx`) — Server
- Props: `{ topics: Topic[] }`
- Vertical list (`flex flex-col gap-1`)
- Each row: score (colored), name link, change, UrgencyBadge, compact SeverityGauge (w-16)
- No filtering/pagination — displays whatever is passed

### TopicCard (`src/components/TopicCard.tsx`) — Server
- Props: `{ topic: Topic }`
- Entire card is a `<Link>`
- Left accent border (3px, severity-colored)
- Score + change (colored), UrgencyBadge, compact SeverityGauge
- Truncated summary (120 chars)
- Metadata: category chip, article count, region, Sparkline (if ≥2 points)
- Relative timestamp

### TopicGrid (`src/components/TopicGrid.tsx`) — Client (*currently unused*)
- Two filter dimensions: urgency (server-side query param) + category (client-side)
- Available categories derived dynamically from fetched topics
- Responsive grid: 1 col → 2 col (640px) → 3 col (1024px)
- "Clear filters" button when no matches
- Subscribes to `eventBus('ui-refresh')`

### TickerBar (`src/components/TickerBar.tsx`) — Client (*currently unused*)
- Fetches `/api/ticker`, auto-refresh every 5min
- Items doubled for seamless scroll loop (`ticker-scroll` animation)
- `sticky top-0 z-50`
- Each item: abbreviated name, severity-colored score, formatted change
- Second copy has `aria-hidden="true"`

### BiggestMovers (`src/components/BiggestMovers.tsx`) — Client (*currently unused*)
- Fetches `/api/movers`
- Horizontal scroll (`overflow-x-auto`)
- Each card: name (truncated), score, change in color

### Sparkline (`src/components/Sparkline.tsx`) — Client
- Props: `{ data: number[]; color?: string }`
- Recharts `LineChart`: monotone, no dots, no axes, no tooltip
- 64×32px container
- Returns null if data.length < 2

### ScoreChart (`src/components/ScoreChart.tsx`) — Client
- Props: `{ history: ScoreHistoryEntry[] }`
- State: `visible: { health, eco, econ }` toggles
- Theme-aware colors via `useTheme()`
- Overall line always visible (red)
- Toggleable: health (purple), eco (cyan), econ (amber)
- `-1` scores → null (gaps in line)
- CartesianGrid, XAxis (dates), YAxis (0-100), Tooltip

### SeverityGauge (`src/components/SeverityGauge.tsx`) — Server
- Props: `{ score: number; compact?: boolean }`
- Score clamped 0-100
- **Hero variant**: 10px, full-width gradient (green→red), marker needle at score%
- **Compact variant**: 4px, solid severity-color fill
- ARIA: `role="meter"`, aria-valuenow, aria-valuemin=0, aria-valuemax=100

### UrgencyBadge (`src/components/UrgencyBadge.tsx`) — Server
- Props: `{ score: number }`
- Colored pill: inline styles with 10%/20% opacity backgrounds
- Labels: BREAKING / CRITICAL / MODERATE / INFORMATIONAL (uppercase)

### ArticleList (`src/components/ArticleList.tsx`) — Server
- Props: `{ articles: Article[] }`
- External links (`target="_blank" rel="noopener noreferrer"`)
- Source + sourceType badge (GNews/RSS only)
- Formatted date, 1-line summary
- Empty state: "No sources yet"

### RefreshButton (`src/components/RefreshButton.tsx`) — Client
- `eventBus.emit('ui-refresh')` + `router.refresh()`
- 1.5s artificial delay for visual feedback
- Three icon states: spinning → checkmark → default refresh

### StaleDataWarning (`src/components/StaleDataWarning.tsx`) — Client
- Fetches `/api/health` on mount
- Three states: loading (null), empty DB (stone info banner), stale >24h (amber warning)
- Silent on error

### Footer (`src/components/Footer.tsx`) — Server
- Links to /scoring and /data-policy
- `© {year} EcoTicker`

### ScoreInfoIcon (`src/components/ScoreInfoIcon.tsx`) — Client (*currently unused*)
- "?" button with CSS-only hover tooltip showing urgency scale
- "Learn more" links to /scoring

---

## OG Images

### Homepage (`src/app/opengraph-image.tsx`)
- Static (no revalidation)
- 1200×630px, dark background (#292524)
- Gradient severity bar, "E" logo, "EcoTicker" heading, urgency level pills
- Cache-Control: 1hr CDN, 24hr stale-while-revalidate

### Per-Topic (`src/app/topic/[slug]/opengraph-image.tsx`)
- Dynamic, `revalidate = 43200` (12h)
- Queries DB for topic data
- Urgency-colored top bar, score card with 3 dimension boxes
- Fallback: "Topic Not Found" card

### SVG Favicon (`src/app/icon.svg`)
- 32×32, dark rounded-rect background
- "E" letter + 3 severity bars (red/orange/green)

---

## Component Composition

### Homepage render tree:
```
RootLayout → ThemeProvider
  → RefreshButton + ThemeToggle (fixed top-right z-50)
  → main
    → StaleDataWarning (client, /api/health)
    → page.tsx
      → HeroSection (client, server data)
        → SeverityGauge (hero)
        → UrgencyBadge
      → TopicList (server)
        → [per topic] UrgencyBadge + SeverityGauge (compact)
  → Footer
```

### Topic detail render tree:
```
RootLayout → ThemeProvider
  → RefreshButton + ThemeToggle
  → main
    → StaleDataWarning
    → topic/[slug]/layout.tsx (transparent)
      → TopicDetailPage (client, /api/topics/:slug)
        → SeverityGauge (hero) + UrgencyBadge
        → [3 dimension rows] SeverityGauge (compact)
        → ArticleList (server)
        → ScoreChart (client, Recharts)
  → Footer
```

---

## Responsive Design

| Breakpoint | Behavior |
|---|---|
| Mobile (default) | 1-col, px-4 py-4, text-sm, dimension reasoning behind toggle |
| sm (640px+) | 2-col TopicGrid, px-6 py-6, reasoning visible, ScoreChart h-64 |
| lg (1024px+) | 3-col TopicGrid, px-8 |
| max-w-7xl | Content caps at 1280px |
| max-w-3xl | Scoring + data-policy pages |

## Animations

| Element | Animation |
|---|---|
| TickerBar | `ticker-scroll` 20s linear infinite, paused on hover |
| prefers-reduced-motion | ticker disabled |
| RefreshButton | `animate-spin` |
| Cards/toggles | `transition-colors`, `transition-all` |
| Card hover | `hover:shadow-lg` |
| ScoreInfoIcon tooltip | `transition-opacity` via group-hover |
| Loading skeletons | `animate-pulse` |
| Share/refresh feedback | State-based setTimeout revert |

## Unused Components

TickerBar, TopicGrid, BiggestMovers, ScoreInfoIcon — built but not imported by any current page or layout.
