# Project Index: EcoTicker

Generated: 2026-02-07

## Project Structure

```
ecoticker/
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout with TickerBar, dark theme, Geist fonts
│   │   ├── page.tsx                  # Dashboard: heading + BiggestMovers + TopicGrid
│   │   ├── globals.css               # Tailwind, ticker-scroll keyframes animation
│   │   ├── topic/[slug]/page.tsx     # Topic detail: score chart, impact summary, articles
│   │   └── api/
│   │       ├── topics/route.ts       # GET /api/topics — filtered list with sparklines
│   │       ├── topics/[slug]/route.ts # GET /api/topics/[slug] — detail + articles + history
│   │       ├── ticker/route.ts       # GET /api/ticker — top 15, lightweight payload
│   │       └── movers/route.ts       # GET /api/movers — top 5 by abs(change)
│   ├── components/
│   │   ├── TickerBar.tsx             # Sticky scrolling marquee, auto-refresh 5min
│   │   ├── TopicGrid.tsx             # Filterable grid (All/Breaking/Critical/Moderate/Info)
│   │   ├── TopicCard.tsx             # Card: score, change, urgency badge, sparkline, region
│   │   ├── BiggestMovers.tsx         # Horizontal scroll of top movers
│   │   ├── Sparkline.tsx             # Mini Recharts line chart (w-16 h-8)
│   │   ├── ScoreChart.tsx            # Full history chart (4 lines: overall, health, eco, econ)
│   │   ├── ArticleList.tsx           # External article links with source, date, summary
│   │   └── UrgencyBadge.tsx          # Color-coded urgency pill
│   └── lib/
│       ├── db.ts                     # SQLite singleton (better-sqlite3, WAL, auto-schema)
│       ├── types.ts                  # Topic, Article, ScoreHistoryEntry, TickerItem, TopicDetail
│       └── utils.ts                  # urgencyColor, changeColor, formatChange, scoreToUrgency
├── scripts/
│   ├── batch.ts                      # Daily pipeline: NewsAPI → LLM classify → LLM score → DB
│   └── seed.ts                       # Seeds 12 topics, 36 articles, 84 score history entries
├── db/
│   └── schema.sql                    # 4 tables: topics, articles, score_history, topic_keywords
├── tests/                            # 16 suites, 114 tests (98.6% statement coverage)
│   ├── db.test.ts                    # 10 tests — schema, constraints, upserts
│   ├── utils.test.ts                 # 14 tests — all utility functions
│   ├── batch.test.ts                 # 7 tests — batch DB ops, JSON extraction
│   ├── seed.test.ts                  # 1 test — end-to-end seed verification
│   ├── api-topics.test.ts            # 7 tests — topic listing, filters, sparkline query
│   ├── api-topic-detail.test.ts      # 6 tests — detail endpoint, 404, sub-scores
│   ├── api-ticker.test.ts            # 5 tests — ticker payload, sorting, limit
│   ├── api-movers.test.ts            # 5 tests — abs sorting, positive/negative movers
│   ├── TickerBar.test.tsx            # 7 tests — render, fetch, doubling, links
│   ├── TopicCard.test.tsx            # 13 tests — score colors, change, badge, region, link
│   ├── TopicGrid.test.tsx            # 8 tests — filters, loading, empty, fetch params
│   ├── BiggestMovers.test.tsx        # 7 tests — loading, cards, scores, links, empty
│   ├── Sparkline.test.tsx            # 5 tests — render, min data, color prop
│   ├── ScoreChart.test.tsx           # 3 tests — chart lines, empty state
│   ├── ArticleList.test.tsx          # 7 tests — titles, source, links, empty
│   └── TopicDetail.test.tsx          # 9 tests — loading, error, score, chart, articles
├── Dockerfile                        # Multi-stage: deps → build → slim production
├── docker-compose.yml                # 3 services: app, nginx, cron + named volume
├── nginx.conf                        # Reverse proxy to app:3000, gzip, static cache
├── crontab                           # Daily batch at 6AM UTC
├── .env.example                      # Environment variable template
├── .dockerignore                     # Excludes node_modules, .next, tests, db/*.db
├── jest.config.ts                    # Two projects: node (.test.ts) + react/jsdom (.test.tsx)
├── next.config.ts                    # output: "standalone" for Docker
├── package.json                      # Next.js 16, React 19, better-sqlite3, recharts, slugify
└── tsconfig.json                     # Path alias @/* → src/*
```

## Entry Points

- **Dev server**: `npm run dev` → localhost:3000
- **Production (Docker)**: `docker compose up -d` → localhost:80
- **Batch pipeline**: `npx tsx scripts/batch.ts`
- **Seed data**: `npx tsx scripts/seed.ts`
- **Tests**: `npx jest`

## API Endpoints

| Endpoint | Params | Response |
|----------|--------|----------|
| `GET /api/topics` | `?urgency=`, `?category=` | `{ topics: Topic[] }` with sparkline arrays |
| `GET /api/topics/[slug]` | — | `{ topic, articles, scoreHistory }` or 404 |
| `GET /api/ticker` | — | `{ items: TickerItem[] }` top 15 |
| `GET /api/movers` | — | `{ movers[] }` top 5 by abs(change) |

## Database Schema

| Table | Key Columns | Notes |
|-------|-------------|-------|
| topics | slug (UQ), current_score, previous_score, urgency, category, region | Upsert rotates previous_score |
| articles | topic_id (FK), url (UQ), title, source, summary | INSERT OR IGNORE dedup |
| score_history | topic_id (FK), score, health/eco/econ_score, recorded_at | Daily sub-score snapshots |
| topic_keywords | topic_id (FK), keyword | LLM-generated aliases for cross-batch matching |

## External APIs

| API | Purpose | Config |
|-----|---------|--------|
| NewsAPI | Fetch environmental news | `NEWSAPI_KEY` |
| OpenRouter | LLM classify + score | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |

## Dependencies

**Runtime**: next 16.1.6, react 19.2.3, better-sqlite3, recharts 3.7, slugify
**Dev**: typescript 5, jest 30, ts-jest, @testing-library/react, tailwindcss 4, tsx, eslint

## Docker Services

| Service | Image | Purpose |
|---------|-------|---------|
| app | Dockerfile (standalone) | Next.js on :3000, mem_limit 1g |
| nginx | nginx:alpine | Reverse proxy :80, gzip, static cache |
| cron | Dockerfile (crond) | Daily batch at 6AM, shared volume |

Volume: `ecoticker-data` (SQLite persistence, shared between app + cron)

## Build Status

All 4 phases complete. 114 tests passing, 98.6% coverage. Docker builds successfully.
