# EcoTicker

Environmental news impact tracker. Aggregates news via GNews API, scores severity with OpenRouter LLMs, and displays a stock-ticker style UI with sparklines and trend indicators.

## Features

- **Stock-ticker bar** — scrolling marquee of environmental topics with live scores
- **Severity scoring** — AI-powered 0–100 composite scores with ecological, health, and economic sub-dimensions
- **Severity gauge** — visual gauge on dashboard hero and topic cards
- **Urgency levels** — breaking (red), critical (orange), moderate (yellow), informational (green)
- **Sparklines** — 7-day score trend on each topic card
- **Biggest movers** — highlights topics with the largest score changes
- **Topic detail pages** — full score history chart, dimension breakdown, impact summary, and source articles
- **Daily batch pipeline** — fetches news, classifies into topics, and scores using LLM
- **RSS fallback** — automatic fallback to RSS feeds when GNews API is unavailable
- **Dark mode** — class-based dark mode with OS preference detection
- **GDPR compliant** — no cookies, no tracking, no raw IPs stored

## Quick Start (Docker)

```bash
git clone <repo-url> && cd ecoticker
cp .env.example .env
# Edit .env with your API keys

docker compose up -d
docker compose exec app npx drizzle-kit push
docker compose exec app npx tsx scripts/seed.ts
```

App is available at `http://localhost`.

## Quick Start (Local Development)

Requires PostgreSQL 17 running locally.

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your API keys and DATABASE_URL

npm run dev
npx drizzle-kit push    # Push schema to database
npx tsx scripts/seed.ts  # Seed demo data
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GNEWS_API_KEY` | Yes | API key from [gnews.io](https://gnews.io) |
| `OPENROUTER_API_KEY` | Yes | API key from [openrouter.ai](https://openrouter.ai) |
| `OPENROUTER_MODEL` | No | Model ID (default: `meta-llama/llama-3.1-8b-instruct:free`) |
| `ADMIN_API_KEY` | Yes | Admin key for write operations (`openssl rand -base64 32`) |
| `BATCH_KEYWORDS` | No | Comma-separated keywords for GNews queries |
| `NODE_ENV` | No | `production` for deployed environments |

## Architecture

```
┌──────────── docker compose ─────────────┐
│                                         │
│  nginx:80 ──▶ app:3000 (Next.js)        │
│                    │                     │
│                    ▼                     │
│            PostgreSQL:5432 (pgdata)      │
│                    ▲                     │
│                    │                     │
│              cron (daily 6AM)            │
│              └─▶ batch.ts                │
│                   ├─▶ GNews API          │
│                   ├─▶ RSS feeds          │
│                   └─▶ OpenRouter LLM     │
└──────────────────────────────────────────┘
```

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind CSS 4) |
| Database | PostgreSQL 17 + Drizzle ORM |
| Charts | Recharts |
| AI Scoring | OpenRouter (free LLM models) |
| News Source | GNews API + RSS fallback |
| Validation | Zod |
| Deployment | Docker Compose (4 services) |

## Docker Services

| Service | Purpose | Port |
|---------|---------|------|
| `postgres` | PostgreSQL 17 database | 5432 (internal) |
| `app` | Next.js production server | 3000 (internal) |
| `nginx` | Reverse proxy, gzip, static caching | 80 (exposed) |
| `cron` | Daily batch pipeline at 6AM UTC | — |

Data persists in a named Docker volume (`pgdata`), surviving container restarts and image rebuilds.

## API Endpoints

### Public (No Authentication)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/topics` | GET | All topics sorted by score. Filters: `?urgency=`, `?category=` |
| `/api/topics/[slug]` | GET | Topic detail with articles and score history |
| `/api/ticker` | GET | Top 15 topics (lightweight payload for ticker bar) |
| `/api/movers` | GET | Top 5 topics by absolute score change |
| `/api/articles` | GET | List articles with pagination. Filters: `?topicId=`, `?source=`, `?url=` |

### Protected (Require `X-API-Key` Header)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/seed` | POST | Seed database with demo data |
| `/api/batch` | POST | Run batch processing pipeline |
| `/api/cleanup` | POST | Clean up demo/seed data |
| `/api/audit-logs` | GET | View audit logs and statistics |

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "X-API-Key: your-admin-key-here"
```

## Security

- **Authentication:** API key required for all write operations (POST/PUT/DELETE)
- **Rate Limiting:** 100 req/min (read), 10 req/min (write), 2 req/hour (batch/seed)
- **Input Validation:** Zod schemas validate all write endpoint payloads
- **SQL Injection Protection:** Parameterized queries via Drizzle ORM
- **Content-Security-Policy:** XSS protection with Next.js-compatible directives
- **Audit Logging:** All write operations logged with IP, timestamp, action, details
- **Error Sanitization:** Production errors hide implementation details
- **GDPR:** No raw IPs stored (last octet truncated), no cookies, `/data-policy` page

## Batch Pipeline

Runs daily at 6AM UTC via the cron container:

1. **Fetch** — queries GNews API with environmental keywords (RSS fallback if unavailable)
2. **Classify** (LLM Pass 1) — groups articles into topics (existing or new)
3. **Score** (LLM Pass 2) — scores each topic 0–100 with sub-dimensions (Eco 40%, Health 35%, Econ 25%)
4. **Store** — upserts topics, deduplicates articles by URL, appends score history

## Tests

```bash
npx jest                # Run all tests
npx jest --coverage     # With coverage report
```

604 tests across 37 suites. Two Jest projects: `node` (ts-jest) and `react` (jsdom).

## Project Structure

```
ecoticker/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Dashboard
│   │   ├── layout.tsx                # Root layout + metadata
│   │   ├── topic/[slug]/page.tsx     # Topic detail page
│   │   ├── scoring-methodology/      # Scoring methodology page
│   │   ├── data-policy/              # GDPR data policy page
│   │   └── api/                      # API routes
│   ├── components/
│   │   ├── TickerBar.tsx             # Scrolling marquee
│   │   ├── TopicCard.tsx             # Topic card with severity gauge + sparkline
│   │   ├── TopicGrid.tsx             # Filterable topic grid
│   │   ├── BiggestMovers.tsx         # Top movers section
│   │   ├── HeroSection.tsx           # Dashboard hero with severity gauge
│   │   ├── Sparkline.tsx             # Mini line chart
│   │   ├── ScoreChart.tsx            # Full score history chart
│   │   ├── ArticleList.tsx           # Source articles with attribution badges
│   │   ├── UrgencyBadge.tsx          # Colored urgency pill
│   │   └── ThemeToggle.tsx           # Dark mode toggle
│   ├── lib/
│   │   ├── types.ts                  # TypeScript interfaces
│   │   ├── utils.ts                  # Helpers + severityColor utility
│   │   ├── batch-pipeline.ts         # Shared batch pipeline module
│   │   ├── auth.ts                   # API key authentication
│   │   ├── rate-limit.ts             # Rate limiting
│   │   ├── validation.ts             # Zod input validation schemas
│   │   ├── errors.ts                 # Centralized error handling
│   │   └── audit-log.ts             # Audit logging utilities
│   └── db/
│       ├── index.ts                  # Drizzle connection pool
│       └── schema.ts                 # Drizzle schema definitions (8 tables)
├── scripts/
│   ├── batch.ts                      # Daily batch pipeline
│   └── seed.ts                       # Sample data seeder
├── tests/                            # Jest test suites
├── docs/
│   ├── deployment/                   # Deployment guides
│   └── plans/                        # Planning documents
├── Dockerfile                        # Multi-stage build
├── docker-compose.yml                # 4 services (app + postgres + nginx + cron)
├── nginx.conf                        # Reverse proxy config
└── .env.example                      # Environment template
```

## Deployment

- **Docker Compose (self-hosted):** See [docs/deployment/deployment.md](docs/deployment/deployment.md)
- **Railway (managed):** See [docs/deployment/RAILWAY_QUICKSTART.md](docs/deployment/RAILWAY_QUICKSTART.md)
- **All options compared:** See [docs/deployment/DEPLOYMENT_OPTIONS.md](docs/deployment/DEPLOYMENT_OPTIONS.md)

## License

Private project.
