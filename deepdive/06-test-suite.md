# 6. Test Suite

## Configuration (`jest.config.ts`)

Two-project setup discriminated by file extension:

| Project | Match | Environment | Transform |
|---|---|---|---|
| `node` | `tests/**/*.test.ts` | node | ts-jest |
| `react` | `tests/**/*.test.tsx` | jsdom | ts-jest + jsx: react-jsx |

Both projects use `@/` path alias → `src/`.

---

## Test Helper: `tests/helpers/mock-db.ts`

Central shared utility providing a chainable mock Drizzle ORM db.

**`createMockDbChain()`** — every Drizzle method (`select`, `insert`, `update`, `delete`, `from`, `where`, `orderBy`, `limit`, `offset`, `values`, `set`, `onConflictDoUpdate`, `onConflictDoNothing`, `returning`, `leftJoin`, `groupBy`) is a `jest.fn()` that returns `this` (chainable).

**`createMockDbQuery()`** — `db.query.*` with `findFirst`/`findMany` mocks for 8 tables.

**Thenable pattern:** Chain gains `.then` when `mockSelect`/`mockInsert`/etc. are called, making it act as a Promise when `await`ed.

**`mockDbInstance`** — `Proxy` intercepting `prop === "query"` → `mockDb.query`.

**Standard injection:**
```typescript
jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return { db: mockDbInstance, pool: { end: jest.fn() } };
});
```

---

## All Test Files (45 files, 685 tests)

### Node Environment (.test.ts) — 26 files, 449 tests

| File | Module | Tests | Key Coverage |
|---|---|---|---|
| `utils.test.ts` | src/lib/utils.ts | 51 | severityColor, changeDirectionColor, formatChange, scoreToUrgency, truncateToWord, relativeTime, topicAbbreviation |
| `severityColor.test.ts` | src/lib/utils.ts | 15 | Focused subset of utils (older file) |
| `heroScore.test.ts` | src/lib/utils.ts | 12 | computeHeroScore formula, selectHeroTopic tiebreakers |
| `scoring.test.ts` | src/lib/scoring.ts | 62 | LEVEL_RANGES, DIMENSION_WEIGHTS, validateScore, computeOverallScore, deriveUrgency, detectAnomaly, scoreToLevel |
| `auth.test.ts` | src/lib/auth.ts | 7 | Correct/wrong key, missing env/header, timingSafeEqual verification via source scan |
| `db.test.ts` | src/db/schema.ts + mock-db | 19 | Schema exports, query builder patterns, upsert patterns, mock helper self-tests |
| `batch.test.ts` | scripts/batch.ts patterns | 12 | 2-day cycle simulation, domain blocking, extractJSON |
| `api-topics.test.ts` | GET /api/topics | 7 | Sort DESC, change computation, urgency/category filters, sparkline |
| `api-ticker.test.ts` | GET /api/ticker | 5 | Top 15, lightweight shape, change values |
| `api-movers.test.ts` | GET /api/movers | 5 | Top 5 by abs change, zero-change excluded |
| `api-topic-detail.test.ts` | GET /api/topics/[slug] | 6 | Fields, article/history ordering, sub-scores, null slug |
| `api-health.test.ts` | GET /api/health | 9 | Empty/null/yesterday/today/5d ago, UTC edge, response shape, no auth, DB error |
| `api-batch-route.test.ts` | POST /api/batch | 21 | GNews errors, dimension clamping, overall score, urgency derivation, anomaly detection, INSUFFICIENT_DATA, RSS integration, classification pipeline |
| `api-cron-batch.test.ts` | GET+POST /api/cron/batch | 18 | Auth (CRON_SECRET), demo-data vs real-data mode, seed fallback, security |
| `batch-pipeline.test.ts` | src/lib/batch-pipeline.ts | 105 | BLOCKED_DOMAINS, FEW_SHOT_EXAMPLES, DEFAULT_FEEDS, isBlockedDomain, feedHostname, extractJSON, safeJsonb, processScoreResult, buildClassificationPrompt, buildScoringPrompt, mergeAndDedup, logFeedHealth, fetchRssFeeds, callLLM, fetchNews, classifyArticles, scoreTopic, type exports |
| `rss.test.ts` | scripts/rss.ts | 17 | fetchRssFeeds, feed health, RSS_FEEDS env override |
| `batch-rss-integration.test.ts` | scripts/batch.ts main() | 7 | GNews+RSS merge, source health warnings, cross-source dedup |
| `run-batch-pipeline.test.ts` | runBatchPipeline() | 15 | Daily mode, ghost scoring prevention, backfill modes, GDPR purge, result shape |
| `seed.test.ts` | scripts/seed.ts | 1 | Seed data shape (12 topics, 36 articles, 84 scores) |
| `dedup-score-history.test.ts` | scripts/dedup-score-history.ts | 7 | No dupes, correct counts, keeps highest id, dry-run, DB error |
| `fix-article-counts.test.ts` | scripts/fix-article-counts.ts | 6 | Inflated/deflated counts, orphan topics, dry-run |
| `sitemap.test.ts` | src/app/sitemap.ts | 14 | Static routes, topic URLs, priorities, hidden exclusion, DB failure fallback |
| `robots.test.ts` | src/app/robots.ts | 5 | userAgent, allow, disallow /api/, sitemap URL |
| `topic-layout.test.ts` | generateMetadata() | 5 | OG tags, scoreReasoning fallback, description truncation, 404 fallback |
| `opengraph-image.test.ts` | OG image routes | 3 | Homepage OG, topic OG, fallback card |
| `source-type-default.test.ts` | Source code audit | 11 | Schema default, sourceType per caller, no "newsapi" in codebase |

### React/jsdom Environment (.test.tsx) — 19 files, 236 tests

| File | Module | Tests | Key Coverage |
|---|---|---|---|
| `TickerBar.test.tsx` | TickerBar | 7 | Abbreviated codes, severity colors, doubled items, empty state |
| `TopicCard.test.tsx` | TopicCard | 29 | All urgency colors, change arrows, badges, borders, truncation, timestamps |
| `TopicGrid.test.tsx` | TopicGrid | 15 | Cards, loading, filters (urgency server-side, category client-side), combined filters, clear |
| `BiggestMovers.test.tsx` | BiggestMovers | 7 | Loading, cards, scores, change format, links, empty state |
| `Sparkline.test.tsx` | Sparkline | 5 | Valid data, <2 points null, color prop, default gray |
| `ScoreChart.test.tsx` | ScoreChart | 13 | Overall line default, toggles (health/eco/econ), colors, connectNulls, weight labels, -1→null |
| `ScoreInfoIcon.test.tsx` | ScoreInfoIcon | 4 | Button, aria-label, urgency scale, learn more link |
| `SeverityGauge.test.tsx` | SeverityGauge | 10 | ARIA (role/aria-*), gradient bar, marker position, compact mode, SSR |
| `ArticleList.test.tsx` | ArticleList | 16 | Titles, sources, sourceType badges (gnews/rss/null/api/seed), empty state |
| `TopicDetail.test.tsx` | TopicDetailPage | 31 | Loading, score, insight lede, dimensions, INSUFFICIENT_DATA, share/clipboard, errors |
| `TopicDetail-7-5.test.tsx` | TopicDetailPage (Story 7-5) | 36 | Editorial rhythm, mobile, share, compact gauge, source citations, empty states, a11y |
| `HeroSection.test.tsx` | HeroSection | 20 | Hero display, dramatic/calm mode, impact summary, share+toast, null fallback, timestamps |
| `InsightHeadline.test.tsx` | computeHeadline | 10 | urgencyRank, 9 headline scenarios |
| `TopicList.test.tsx` | TopicList | 9 | Rows, scores, colors, links, change, gauge, empty, order |
| `dashboard-page.test.tsx` | page.tsx (RSC) | 3 | Product descriptor, classes, DOM order |
| `StaleDataWarning.test.tsx` | StaleDataWarning | 12 | Stale, fresh, empty DB, error/fail-silent, loading, fetch endpoint |
| `Footer.test.tsx` | Footer | 3 | Links, copyright year |
| `scoring-page.test.tsx` | scoring/page.tsx | 4 | Section headings, formula, back link, metadata |
| `data-policy-page.test.tsx` | data-policy/page.tsx | 6 | Headings, data tables, last updated, metadata |

---

## Mock Patterns

### `next/link`
```tsx
jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }) {
    return <a href={href} {...props}>{children}</a>;
  };
});
```
Used in 14 test files.

### `next/navigation`
```tsx
jest.mock("next/navigation", () => ({
  useParams: () => ({ slug: "arctic-ice-decline" }),
  useRouter: () => ({ push: jest.fn() }),
}));
```

### `recharts`
```tsx
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: ({ children, data }) => <div data-testid="line-chart" data-count={data.length}>{children}</div>,
  Line: (props) => <div data-testid={`line-${props.dataKey}`} data-stroke={props.stroke} data-connect-nulls={props.connectNulls?.toString()} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="grid" />,
}));
```

### `@/db`
```typescript
jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return { db: mockDbInstance, pool: { end: jest.fn() } };
});
```

### `global.fetch`
```typescript
global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ items: mockItems }),
}) as jest.Mock;
```

### `rss-parser`
```typescript
jest.mock("rss-parser");
const mockParseURL = jest.fn();
(Parser as unknown as jest.Mock).mockImplementation(() => ({ parseURL: mockParseURL }));
```

---

## Test Categories

| Category | ~Count | Examples |
|---|---|---|
| Unit — pure functions | 200 | utils, scoring, auth, heroScore |
| Unit — DB query patterns | 80 | api-topics, api-ticker, api-movers |
| Unit — scripts | 40 | seed, dedup, fix-article-counts |
| Unit — source code audit | 11 | source-type-default |
| Unit — Next.js infra | 27 | sitemap, robots, opengraph, topic-layout |
| Integration — route handlers | 60 | api-batch-route, api-cron-batch, api-health |
| Integration — batch pipeline | 130 | batch-pipeline, rss, run-batch-pipeline |
| Component — React | 240 | All .tsx files |

---

## Coverage

**Claimed:** 98.6% statement coverage.

**Notable gaps:**
1. ThemeProvider/ThemeToggle — no dedicated tests
2. UrgencyBadge — only tested as stub in parent tests
3. rate-limit.ts — no dedicated test file
4. audit-log.ts — mocked in route tests, no standalone tests
5. validation.ts — exercised via integration, no dedicated tests
