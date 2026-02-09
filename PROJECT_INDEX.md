# Project Index: EcoTicker

Generated: 2026-02-09 (Updated with security features)

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
│   │   ├── Sparkline.tsx             # Mini Recharts line chart (w-16 h-8)
│   │   ├── ScoreChart.tsx            # Full history chart (4 lines: overall, health, eco, econ)
│   │   ├── ArticleList.tsx           # External article links with source, date, summary
│   │   └── UrgencyBadge.tsx          # Color-coded urgency pill
│   └── lib/
│       ├── db.ts                     # PostgreSQL Pool singleton (pg, auto-schema)
│       ├── types.ts                  # Topic, Article, ScoreHistoryEntry, TickerItem, TopicDetail
│       ├── utils.ts                  # urgencyColor, changeColor, formatChange, scoreToUrgency
│       ├── auth.ts                   # requireAdminKey(), getUnauthorizedResponse() — API key auth
│       ├── rate-limit.ts             # RateLimiter class — in-memory rate limiting
│       ├── validation.ts             # Zod schemas — articleCreate/Update/Delete, topicDelete
│       ├── errors.ts                 # createErrorResponse() — centralized error handling
│       └── audit-log.ts              # logSuccess/Failure(), getAuditLogs/Stats()
├── scripts/
│   ├── batch.ts                      # Daily pipeline: NewsAPI → LLM classify → LLM score → DB
│   └── seed.ts                       # Seeds 12 topics, 36 articles, 84 score history entries
├── db/
│   └── schema.sql                    # 5 tables: topics, articles, score_history, topic_keywords, audit_logs
├── tests/                            # 17 suites, 132 tests (pg-mem in-memory DB)
│   ├── test-db.ts                    # Shared helper: pg-mem setup, schema load, backup/restore
│   ├── db.test.ts                    # 10 tests — schema, constraints, upserts
│   ├── utils.test.ts                 # 14 tests — all utility functions
│   ├── batch.test.ts                 # 7 tests — batch DB ops, JSON extraction
│   ├── seed.test.ts                  # 1 test — seed integration (requires TEST_DATABASE_URL)
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
├── docker-compose.yml                # 4 services: app, nginx, cron, postgres
├── nginx.conf                        # Reverse proxy, gzip, static cache, security headers
├── crontab                           # Daily batch at 6AM UTC
├── .env.example                      # Environment variable template
├── .github/workflows/security.yml    # CI: dependency audit, security lint, Dockerfile check, tests
├── .dockerignore                     # Excludes node_modules, .next, tests, db/*.db
├── deployment.md                     # Production deployment guide
├── jest.config.ts                    # Two projects: node (.test.ts) + react/jsdom (.test.tsx)
├── next.config.ts                    # output: "standalone" for Docker
├── package.json                      # Next.js 16, React 19, pg, recharts, slugify
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

## Database Schema

| Table | Key Columns | Notes |
|-------|-------------|-------|
| topics | slug (UQ), current_score, previous_score, urgency, category, region | Upsert rotates previous_score |
| articles | topic_id (FK), url (UQ), title, source, summary | ON CONFLICT DO NOTHING dedup |
| score_history | topic_id (FK), score, health/eco/econ_score, recorded_at | Daily sub-score snapshots |
| topic_keywords | topic_id (FK), keyword | LLM-generated aliases for cross-batch matching |
| audit_logs | timestamp, ip_address, endpoint, method, action, success, details | Tracks all write operations |

## External APIs

| API | Purpose | Config |
|-----|---------|--------|
| NewsAPI | Fetch environmental news | `NEWSAPI_KEY` |
| OpenRouter | LLM classify + score | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |

## Dependencies

**Runtime**: next 16.1.6, react 19.2.3, pg 8.13, recharts 3.7, slugify, zod 4.3
**Dev**: typescript 5, jest 30, ts-jest, pg-mem 3, @testing-library/react, tailwindcss 4, tsx, eslint

## Docker Services

| Service | Image | Purpose |
|---------|-------|---------|
| app | Dockerfile (standalone) | Next.js on :3000, mem_limit 1g |
| nginx | nginx:alpine | Reverse proxy :80, gzip, static cache |
| cron | Dockerfile (crond) | Daily batch at 6AM |
| postgres | postgres:16-alpine | PostgreSQL database with healthcheck |

Volume: `pgdata` (PostgreSQL data persistence)

## Build Status

All 4 phases complete + security hardening + PostgreSQL migration. 132 tests passing (pg-mem). Docker builds successfully.

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
- **In-memory implementation:** Resets on server restart (acceptable for demo/personal projects)

### Input Validation
- **Zod schemas:** All write endpoints validated with type-safe schemas
- **Article operations:** Validated fields include topicId, title, url, source, summary, imageUrl, publishedAt
- **Topic operations:** Validated filters for batch deletion
- **Query params:** Urgency/category enum whitelist (400 on invalid)

### SQL Injection Protection
- **Parameterized queries:** All SQL uses prepared statements with placeholders
- **No string concatenation:** Fixed critical vulnerabilities in /api/cleanup and /api/articles
- **LIKE pattern safety:** Changed to exact match or escaped wildcards

### Content-Security-Policy
- **CSP enabled:** Middleware sets strict CSP directives
- **Next.js compatible:** Allows unsafe-inline for hydration (required by framework)
- **Restricts sources:** default-src 'self', external images allowed, scripts/styles scoped

### Audit Logging
- **Comprehensive tracking:** All write operations logged to audit_logs table
- **Logged details:** IP address, endpoint, method, action, success/failure, error messages, request details, user agent
- **Queryable API:** GET /api/audit-logs with pagination and statistics
- **Statistics:** Total operations, success rate, unique IPs, recent failures, top actions

### Error Handling
- **Environment-aware:** Production hides implementation details, development shows full errors
- **Request IDs:** Each error includes unique request ID for debugging
- **Centralized:** All endpoints use createErrorResponse() utility
- **No information disclosure:** Prevents leaking database schema or internal paths

### Additional Security
- **Nginx headers:** X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **Timeouts:** 15s (NewsAPI), 30s (OpenRouter) to prevent hanging requests
- **GitHub Actions CI:** Dependency audit, secret scanning, dangerous pattern detection, Dockerfile checks
