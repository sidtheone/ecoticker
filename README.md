# EcoTicker

Environmental news impact tracker with a stock-ticker style UI. Aggregates news from GNews API, scores severity using AI via OpenRouter, and displays topics with real-time severity scores, sparklines, and trend indicators.

## Features

- **Stock-ticker bar** — scrolling marquee of environmental topics with live scores
- **Severity scoring** — AI-powered 0-100 composite scores with health, ecological, and economic sub-dimensions
- **Urgency levels** — breaking (red), critical (orange), moderate (yellow), informational (green)
- **Sparklines** — 7-day score trend on each topic card
- **Biggest movers** — highlights topics with the largest score changes
- **Topic detail pages** — full score history chart, impact summary, and source articles
- **Daily batch pipeline** — fetches news, classifies into topics, and scores using LLM

## Quick Start (Docker)

```bash
git clone <repo-url> && cd ecoticker
cp .env.example .env
# Edit .env with your API keys

docker compose up -d
```

App is available at `http://localhost`.

To seed sample data without API keys:

```bash
docker compose exec app node node_modules/tsx/dist/esm/cli.mjs scripts/seed.ts
```

To stop:

```bash
docker compose down
```

## Quick Start (Local Development)

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your API keys

npm run dev
```

Seed the database with sample data (no API keys needed):

```bash
npx tsx scripts/seed.ts
```

Run the batch pipeline manually:

```bash
npx tsx scripts/batch.ts
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GNEWS_API_KEY` | Yes | API key from [gnews.io](https://gnews.io) (Essential plan for production) |
| `OPENROUTER_API_KEY` | Yes | API key from [openrouter.ai](https://openrouter.ai) (free models available) |
| `OPENROUTER_MODEL` | No | Model ID (default: `meta-llama/llama-3.1-8b-instruct:free`) |
| `ADMIN_API_KEY` | **Yes** | Admin API key for write operations (generate: `openssl rand -base64 32`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Railway auto-injects in production) |
| `BATCH_KEYWORDS` | No | Comma-separated keywords for GNews queries |

**Security Note:** The `ADMIN_API_KEY` is required for all write operations (POST/PUT/DELETE). Generate a secure key and never commit it to version control.

## Architecture

```
┌──────────── docker compose ─────────────┐
│                                         │
│  nginx:80 ──▶ app:3000 (Next.js)        │
│                    │                    │
│                    ▼                    │
│               SQLite (volume)           │
│                    ▲                    │
│                    │                    │
│              cron (daily 6AM)           │
│              └─▶ batch.ts              │
│                   ├─▶ NewsAPI           │
│                   └─▶ OpenRouter LLM    │
└─────────────────────────────────────────┘
```

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Charts | Recharts |
| AI Scoring | OpenRouter (free LLM models) |
| News Source | GNews API (Essential plan, 1,000 req/day) |
| Deployment | Docker Compose (3 services) |

## Docker Services

| Service | Purpose | Port |
|---------|---------|------|
| `app` | Next.js production server | 3000 (internal) |
| `nginx` | Reverse proxy, gzip, static caching | 80 (exposed) |
| `cron` | Daily batch pipeline at 6AM UTC | — |

Data persists in a named Docker volume (`ecoticker-data`), surviving container restarts and image rebuilds.

## API Endpoints

### Public Endpoints (No Authentication)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/topics` | GET | All topics sorted by score. Filters: `?urgency=`, `?category=` |
| `/api/topics/[slug]` | GET | Topic detail with articles and score history |
| `/api/ticker` | GET | Top 15 topics (lightweight payload for ticker bar) |
| `/api/movers` | GET | Top 5 topics by absolute score change |
| `/api/articles` | GET | List articles with pagination. Filters: `?topicId=`, `?source=`, `?url=` |
| `/api/articles/[id]` | GET | Get single article by ID |

### Protected Endpoints (Require X-API-Key Header)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/seed` | POST | Seed database with demo data |
| `/api/batch` | POST | Run batch processing pipeline manually |
| `/api/cleanup` | POST | Clean up demo/seed data |
| `/api/articles` | POST | Create new article |
| `/api/articles` | DELETE | Batch delete articles by filters |
| `/api/articles/[id]` | PUT | Update article |
| `/api/articles/[id]` | DELETE | Delete single article |
| `/api/topics` | DELETE | Batch delete topics |
| `/api/audit-logs` | GET | View audit logs and statistics |

**Authentication Example:**
```bash
curl -X POST http://localhost:3000/api/seed \
  -H "X-API-Key: your-admin-key-here"
```

## Security Features

- **🔐 Authentication:** API key required for all write operations (POST/PUT/DELETE)
- **⏱️ Rate Limiting:** 100 req/min (read), 10 req/min (write), 2 req/hour (batch/seed)
- **✅ Input Validation:** Zod schemas validate all write endpoint payloads
- **🛡️ SQL Injection Protection:** Parameterized queries throughout
- **🔒 Content-Security-Policy:** XSS protection with Next.js-compatible directives
- **📊 Audit Logging:** All write operations logged to database with IP, timestamp, action, details
- **🚫 Error Sanitization:** Production errors hide implementation details

## Batch Pipeline

Runs daily at 6AM UTC via the cron container:

1. **Fetch** — queries GNews API with environmental keywords (~2-5 requests)
2. **Classify** (LLM Pass 1) — groups articles into topics (existing or new)
3. **Score** (LLM Pass 2) — scores each topic 0-100 with sub-dimensions
4. **Store** — upserts topics, deduplicates articles by URL, appends score history

## Tests

```bash
# Run all tests
npx jest

# Run with coverage
npx jest --coverage
```

132 tests across 17 suites. Coverage: 98.6% statements, 94% branches.

## Project Structure

```
ecoticker/
├── src/
│   ├── app/
│   │   ├── page.tsx                # Dashboard
│   │   ├── topic/[slug]/page.tsx   # Topic detail page
│   │   ├── api/
│   │   │   ├── topics/route.ts     # GET /api/topics
│   │   │   ├── topics/[slug]/route.ts
│   │   │   ├── ticker/route.ts     # GET /api/ticker
│   │   │   └── movers/route.ts     # GET /api/movers
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── TickerBar.tsx           # Scrolling marquee
│   │   ├── TopicCard.tsx           # Topic card with score + sparkline
│   │   ├── TopicGrid.tsx           # Filterable topic grid
│   │   ├── BiggestMovers.tsx       # Top movers section
│   │   ├── Sparkline.tsx           # Mini line chart
│   │   ├── ScoreChart.tsx          # Full score history chart
│   │   ├── ArticleList.tsx         # Source article list
│   │   └── UrgencyBadge.tsx        # Colored urgency pill
│   └── lib/
│       ├── db.ts                   # SQLite singleton
│       ├── types.ts                # TypeScript interfaces
│       ├── utils.ts                # Helpers
│       ├── auth.ts                 # API key authentication
│       ├── rate-limit.ts           # Rate limiting
│       ├── validation.ts           # Zod input validation schemas
│       ├── errors.ts               # Centralized error handling
│       └── audit-log.ts            # Audit logging utilities
├── scripts/
│   ├── batch.ts                    # Daily batch pipeline
│   └── seed.ts                     # Sample data seeder
├── db/
│   └── schema.sql                  # Database schema
├── tests/                          # 16 test suites
├── Dockerfile                      # Multi-stage build
├── docker-compose.yml              # 3 services
├── nginx.conf                      # Reverse proxy config
├── crontab                         # Batch schedule
└── .env.example                    # Environment template
```

## License

MIT
