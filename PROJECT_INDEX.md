# Project Index: EcoTicker

Generated: 2026-02-13 | Branch: v2

## Project Structure

```
ecoticker/
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout: ThemeProvider + TickerBar + ThemeToggle + FOUC script
│   │   ├── page.tsx                  # Dashboard: heading + BiggestMovers + TopicGrid
│   │   ├── globals.css               # Tailwind, @custom-variant dark, CSS vars, ticker animation
│   │   ├── topic/[slug]/page.tsx     # Topic detail: score chart, impact summary, articles
│   │   └── api/
│   │       ├── topics/route.ts       # GET /api/topics, DELETE /api/topics (auth)
│   │       ├── topics/[slug]/route.ts # GET /api/topics/[slug] — detail + articles + history
│   │       ├── ticker/route.ts       # GET /api/ticker — top 15, lightweight payload
│   │       ├── movers/route.ts       # GET /api/movers — top 5 by abs(change)
│   │       ├── articles/route.ts     # GET, POST (auth), DELETE (auth) — CRUD articles
│   │       ├── articles/[id]/route.ts # GET, PUT (auth), DELETE (auth) — single article CRUD
│   │       ├── batch/route.ts        # POST (auth) — manual batch processing
│   │       ├── seed/route.ts         # POST (auth) — seed demo data
│   │       ├── cleanup/route.ts      # POST (auth) — clean up demo data
│   │       ├── audit-logs/route.ts   # GET (auth) — view audit logs and statistics
│   │       └── cron/batch/route.ts   # GET/POST (bearer token) — cron trigger
│   ├── components/
│   │   ├── ThemeProvider.tsx          # Dark/light context + useTheme() hook + localStorage
│   │   ├── ThemeToggle.tsx           # Sun/moon icon button, fixed top-right
│   │   ├── TickerBar.tsx             # Sticky scrolling marquee, auto-refresh 5min
│   │   ├── TopicGrid.tsx             # Filterable grid (All/Breaking/Critical/Moderate/Info)
│   │   ├── TopicCard.tsx             # Card: score, change, urgency badge, sparkline, region
│   │   ├── BiggestMovers.tsx         # Horizontal scroll of top movers
│   │   ├── RefreshButton.tsx         # Manual data refresh trigger button
│   │   ├── Sparkline.tsx             # Mini Recharts line chart (w-16 h-8)
│   │   ├── ScoreChart.tsx            # Full history chart (4 lines: overall, health, eco, econ)
│   │   ├── ArticleList.tsx           # External article links with source, date, summary
│   │   └── UrgencyBadge.tsx          # Color-coded urgency pill
│   ├── lib/
│   │   ├── types.ts                  # Topic, Article, ScoreHistoryEntry, TickerItem, TopicDetail
│   │   ├── utils.ts                  # urgencyColor, changeColor, formatChange, scoreToUrgency
│   │   ├── scoring.ts                # Multi-dimensional scoring: validateScore, computeOverallScore, deriveUrgency, detectAnomaly
│   │   ├── auth.ts                   # requireAdminKey(), getUnauthorizedResponse() — API key auth
│   │   ├── rate-limit.ts             # RateLimiter class — in-memory rate limiting
│   │   ├── validation.ts             # Zod schemas — articleCreate/Update/Delete, topicDelete
│   │   ├── errors.ts                 # createErrorResponse() — centralized error handling
│   │   ├── events.ts                 # EventMap type + eventBus — cross-component event system
│   │   └── audit-log.ts             # logSuccess/Failure(), getAuditLogs/Stats()
│   ├── db/
│   │   ├── index.ts                  # Drizzle connection pool (PostgreSQL via pg library)
│   │   └── schema.ts                 # Drizzle schema: topics, articles, score_history, topic_keywords, audit_logs
│   └── middleware.ts                 # Next.js middleware — CSP headers, rate limiting
├── scripts/
│   ├── batch.ts                      # Daily pipeline: NewsAPI → LLM filter/classify → LLM score → DB (w/ quality filtering)
│   ├── seed.ts                       # Seeds 12 topics, 36 articles, 84 score history entries
│   └── setup-git-hooks.sh           # Installs pre-commit hooks (tsc, build, lint)
├── drizzle.config.ts                 # Drizzle Kit configuration for schema migrations
├── tests/                            # 18 suites, 163+ tests
│   ├── db.test.ts                    # 10 tests — schema, constraints, upserts
│   ├── utils.test.ts                 # 14 tests — all utility functions
│   ├── scoring.test.ts               # 31 tests — validateScore, computeOverallScore, deriveUrgency, detectAnomaly, scoreToLevel
│   ├── batch.test.ts                 # 7 tests — batch DB ops, JSON extraction
│   ├── seed.test.ts                  # 1 test — end-to-end seed verification
│   ├── api-topics.test.ts            # 7 tests — topic listing, filters, sparkline query
│   ├── api-topic-detail.test.ts      # 6 tests — detail endpoint, 404, sub-scores
│   ├── api-ticker.test.ts            # 5 tests — ticker payload, sorting, limit
│   ├── api-movers.test.ts            # 5 tests — abs sorting, positive/negative movers
│   ├── api-cron-batch.test.ts        # Cron batch endpoint tests
│   ├── TickerBar.test.tsx            # 7 tests — render, fetch, doubling, links
│   ├── TopicCard.test.tsx            # 13 tests — score colors, change, badge, region, link
│   ├── TopicGrid.test.tsx            # 8 tests — filters, loading, empty, fetch params
│   ├── BiggestMovers.test.tsx        # 7 tests — loading, cards, scores, links, empty
│   ├── Sparkline.test.tsx            # 5 tests — render, min data, color prop
│   ├── ScoreChart.test.tsx           # 3 tests — chart lines, empty state
│   ├── ArticleList.test.tsx          # 7 tests — titles, source, links, empty
│   └── TopicDetail.test.tsx          # 9 tests — loading, error, score, chart, articles
├── docs/
│   ├── TOKEN_EFFICIENCY_REPORT.md    # Token savings analysis and ROI
│   ├── NEWSAPI_QUALITY_SOLUTION.md   # NewsAPI quality improvement: LLM filtering design (4 solutions)
│   ├── BATCH_KEYWORDS_RESEARCH.md    # Event-based keyword strategy research
│   ├── IMPLEMENTATION_STATUS.md      # NewsAPI quality solution status and testing plan
│   ├── real-data-setup.md            # Guide for connecting real NewsAPI data
│   ├── refresh-button-design.md      # RefreshButton component design
│   ├── refresh-button-implementation-summary.md # RefreshButton implementation notes
│   ├── ui-refresh-design.md          # UI refresh feature design
│   └── plans/
│       ├── 2026-02-09-business-panel-analysis.md       # 9-expert business panel, 10 recommendations
│       ├── 2026-02-09-user-stories.md                  # Original 23 user stories (SUPERSEDED)
│       ├── 2026-02-09-llm-scoring-research.md          # LLM scoring strategy (v3, 30+ sources)
│       ├── 2026-02-12-user-stories-v2.md               # Deep revision: 21 stories, personas + journeys
│       ├── 2026-02-12-postgresql-drizzle-design.md     # PostgreSQL + Drizzle ORM design for v2
│       ├── 2026-02-13-phase0-workflow.md               # Phase 0 implementation workflow (4 sub-phases)
│       ├── 2026-02-13-us1.1-workflow.md                # US-1.1 scoring workflow (4 phases)
│       └── 2026-02-13-us1.1-functional-validation.md   # US-1.1 validation guide (10 phases)
├── Dockerfile                        # Multi-stage: deps → build → slim production
├── docker-compose.yml                # 3 services: app, nginx, cron + named volume
├── nginx.conf                        # Reverse proxy, gzip, static cache, security headers
├── crontab                           # Daily batch at 6AM UTC
├── .env.example                      # Environment variable template
├── .github/workflows/security.yml    # CI: dependency audit, security lint, Dockerfile check, tests
├── CLAUDE.md                         # AI assistant instructions and project context
├── CONTRIBUTING.md                   # Contribution guidelines
├── DEPLOYMENT_OPTIONS.md             # Deployment strategy comparison
├── RAILWAY_CHECKLIST.md              # Railway deployment checklist
├── RAILWAY_DEPLOYMENT_PLAN.md        # Railway deployment plan
├── RAILWAY_IMPLEMENTATION_SUMMARY.md # Railway implementation summary
├── RAILWAY_QUICKSTART.md             # Railway quick start guide
├── README.md                         # Project readme
├── deployment.md                     # Production deployment guide
├── jest.config.ts                    # Two projects: node (.test.ts) + react/jsdom (.test.tsx)
├── next.config.ts                    # output: "standalone" for Docker
├── package.json                      # Next.js 16, React 19, pg, drizzle-orm, drizzle-kit, recharts, slugify
└── tsconfig.json                     # Path alias @/* → src/*
```

## Entry Points

- **Dev server**: `npm run dev` → localhost:3000
- **Production (Docker)**: `docker compose up -d` → localhost:80
- **Batch pipeline**: `npx tsx scripts/batch.ts`
- **Seed data**: `npx tsx scripts/seed.ts`
- **Tests**: `npx jest`

## API Endpoints

### Public (No Auth Required)
| Endpoint | Params | Response |
|----------|--------|----------|
| `GET /api/topics` | `?urgency=`, `?category=` (validated) | `{ topics: Topic[] }` with sparkline arrays |
| `GET /api/topics/[slug]` | — | `{ topic, articles, scoreHistory }` or 404 |
| `GET /api/ticker` | — | `{ items: TickerItem[] }` top 15 |
| `GET /api/movers` | — | `{ movers[] }` top 5 by abs(change) |
| `GET /api/articles` | `?topicId=`, `?source=`, `?url=`, `?limit=`, `?offset=` | `{ articles[], pagination }` |
| `GET /api/articles/[id]` | — | `{ article, topic }` or 404 |

### Protected (Requires X-API-Key Header)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/seed` | POST | Seed database with demo data |
| `/api/batch` | POST | Run batch processing manually |
| `/api/cleanup` | POST | Clean up demo/seed data |
| `/api/articles` | POST | Create new article (Zod validated) |
| `/api/articles` | DELETE | Batch delete articles by filters (Zod validated) |
| `/api/articles/[id]` | PUT | Update article (Zod validated) |
| `/api/articles/[id]` | DELETE | Delete single article |
| `/api/topics` | DELETE | Batch delete topics (Zod validated) |
| `/api/audit-logs` | GET | View audit logs and statistics |

### Cron (Bearer Token)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/batch` | GET/POST | Cron-triggered batch processing |

## Database Schema

Defined in `src/db/schema.ts` using Drizzle ORM:

| Table | Key Columns | Notes |
|-------|-------------|-------|
| topics | slug (UQ), current_score, previous_score, urgency, category, region | Drizzle upsert with onConflictDoUpdate |
| articles | topic_id (FK), url (UQ), title, source, summary | ON CONFLICT DO NOTHING dedup |
| score_history | topic_id (FK), score, health/eco/econ_score, recorded_at | Daily sub-score snapshots |
| topic_keywords | topic_id (FK), keyword | LLM-generated aliases for cross-batch matching |
| audit_logs | timestamp, ip_address, endpoint, method, action, success, details | Tracks all write operations |

## External APIs

| API | Purpose | Config |
|-----|---------|--------|
| NewsAPI | Fetch environmental news (free tier, 100 req/day) | `NEWSAPI_KEY`, `BATCH_KEYWORDS` |
| OpenRouter | LLM filter/classify + score | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |

**NewsAPI Quality Improvement (v2):**
- 2-step LLM filtering: TASK 1 (reject non-environmental) → TASK 2 (classify environmental)
- Rejection criteria: celebrity/entertainment, sports, general politics, business, pet care, shopping
- Event-based keywords: wildfire, coral bleaching, drought, deforestation, emissions, oil spill, etc.
- Test results: 55-60% relevance rate (up from 20-30% baseline)

## Dependencies

**Runtime**: next 16.1.6, react 19.2.3, pg 8.x, drizzle-orm 0.37.x, recharts 3.7, slugify 1.6, zod 4.3
**Dev**: typescript 5, drizzle-kit 0.29.x, jest 30, ts-jest 29.4, @testing-library/react 16.3, tailwindcss 4, tsx 4.21, eslint 9

## Docker Services

| Service | Image | Purpose |
|---------|-------|---------|
| postgres | postgres:17-alpine | PostgreSQL database on :5432, pgdata volume |
| app | Dockerfile (standalone) | Next.js on :3000, mem_limit 1g, connects to postgres |
| nginx | nginx:alpine | Reverse proxy :80, gzip, static cache |
| cron | Dockerfile (crond) | Daily batch at 6AM, connects to postgres |

Volumes: `pgdata` (PostgreSQL data persistence)

## Build Status

**v1:** Complete (4 phases + security hardening). 132 tests, 98.6% coverage. Docker builds successfully.

**v2 Phase 0:** ✅ COMPLETE (Commit: d25ebb0)
- PostgreSQL 17 + Drizzle ORM migration complete
- 141 tests passing, 87.35% coverage
- 47 files changed (+5,996/-3,170 lines)
- All infrastructure, API routes, tests, Docker updated

**v2 US-1.1:** ✅ COMPLETE (Commits: 9f351f1, 9d33fc3)
- Multi-dimensional LLM scoring implementation complete
- New scoring library: src/lib/scoring.ts (235 lines, 5 core functions)
- Batch pipeline rewritten: scripts/batch.ts (708 lines, Drizzle + rubric prompt)
- Seed script rewritten: scripts/seed.ts (403 lines, realistic v2 data)
- 31 new unit tests: tests/scoring.test.ts (363 lines)
- 8 files changed (+2,669/-253 lines)
- Functional validation plan created (10 phases)

**NewsAPI Quality Solution:** ✅ COMPLETE (Commit: 175d848)
- LLM-based article filtering implemented (2-step: filter → classify)
- Rejection statistics logging (relevance rate, article titles, reasons)
- Test results: 55-60% relevance (target: 40-60%) ✅
- Event-based keywords configured (wildfire, coral bleaching, etc.)
- 6 files changed (+1,056 lines): batch.ts, 3 new docs, docker-compose, .gitignore
- Cost: $0.027/month (+25% tokens, effectively free)

## v2 Implementation Status

| Phase | Status | Details |
|-------|--------|---------|
| **Planning** | ✅ Done | Business panel, LLM research, user stories v2, DB design |
| **Phase 0A-D** | ✅ Done | PostgreSQL + Drizzle ORM migration (commit: d25ebb0) |
| **US-1.1** | ✅ Done | Multi-dimensional scoring (commits: 9f351f1, 9d33fc3) |
| **Quality** | ✅ Done | NewsAPI filtering solution (commit: 175d848) |
| **US-1.2** | ⏸️ Next | UI for sub-scores and reasoning display |

## Theme System

- Class-based dark mode via Tailwind v4 `@custom-variant dark`
- `ThemeProvider` context with `useTheme()` hook
- Inline `<script>` in layout prevents FOUC (flash of unstyled content)
- Priority: localStorage → OS `prefers-color-scheme` → light default
- All components use `dark:` Tailwind variants for dual-theme support
- ScoreChart uses `useTheme()` for Recharts color props (not Tailwind-driven)
- Light theme: warm cream/beige palette (#faf7f2 bg, #f5f0e8 cards, stone-* text)

## Security

### Authentication & Authorization
- **API Key Authentication:** X-API-Key header required for all write operations (POST/PUT/DELETE)
- **ADMIN_API_KEY env var:** Configured per deployment (generate with `openssl rand -base64 32`)
- **Public read access:** All GET endpoints remain public for dashboard functionality

### Rate Limiting
- **Read operations:** 100 requests/minute per IP
- **Write operations:** 10 requests/minute per IP
- **Batch/Seed operations:** 2 requests/hour per IP
- **429 responses:** Include Retry-After and X-RateLimit-Reset headers
- **In-memory implementation:** Resets on server restart

### Input Validation
- **Zod schemas:** All write endpoints validated with type-safe schemas
- **Query params:** Urgency/category enum whitelist (400 on invalid)

### SQL Injection Protection
- **Parameterized queries:** All SQL uses prepared statements with placeholders
- **No string concatenation:** No dynamic SQL construction

### Content-Security-Policy
- **Middleware-applied CSP:** Strict directives, Next.js-compatible (unsafe-inline for hydration)

### Audit Logging
- All write operations logged to audit_logs table
- Queryable API: GET /api/audit-logs with pagination and statistics

### Error Handling
- Environment-aware (production hides details, dev shows full errors)
- Unique request IDs, centralized via createErrorResponse()

### Additional Security
- Nginx headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- Request timeouts: 15s (NewsAPI), 30s (OpenRouter)
- GitHub Actions CI: dependency audit, secret scanning, Dockerfile checks
