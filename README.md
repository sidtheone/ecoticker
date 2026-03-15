# EcoTicker

**Environmental news impact tracker.** Aggregates news from 10+ sources, scores severity with AI across health, ecology, and economy dimensions, and displays it in a stock-ticker style dashboard.

**Live:** [ecoticker.sidsinsights.com](https://ecoticker.sidsinsights.com)

## What it does

EcoTicker fetches environmental news twice daily from RSS feeds and news APIs, then uses an LLM to:

1. **Classify** articles into environmental topics (climate policy, wildfires, ocean pollution, etc.)
2. **Score** each topic 0-100 across three dimensions: ecological impact, health impact, economic impact
3. **Track trends** over time with sparklines and score history

The result is a real-time severity dashboard for environmental issues — like a stock ticker, but for the planet.

## Features

- **Severity scoring** — AI-powered 0-100 scores with eco/health/econ sub-dimensions
- **4 urgency levels** — Breaking (red), Critical (orange), Moderate (yellow), Informational (green)
- **Sparklines** — 7-day score trends on each topic
- **Biggest movers** — highlights topics with the largest score swings
- **Topic detail pages** — full score history, dimension breakdown, source articles
- **Dark mode** — OS preference detection + manual toggle
- **Scoring methodology** — transparent rubric at `/scoring`
- **GDPR compliant** — no cookies, no tracking, no raw IPs stored

## How scoring works

Each topic is scored across three weighted dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Ecological | 40% | Ecosystem damage, biodiversity loss, habitat destruction |
| Health | 35% | Air/water quality, disease risk, human safety |
| Economic | 25% | Cleanup costs, job losses, supply chain disruption |

The LLM assigns a severity level (Minimal/Moderate/Significant/Severe) with a numeric score per dimension. The weighted average becomes the overall severity score.

Full methodology: [`/scoring`](https://ecoticker.sidsinsights.com/scoring)

## Tech stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind CSS 4) |
| Database | PostgreSQL 17 + Drizzle ORM |
| Charts | Recharts |
| AI Scoring | OpenRouter (configurable model) |
| News Sources | RSS feeds (10 sources) + GNews API |
| Validation | Zod |
| Hosting | Railway |
| CI | GitHub Actions |

## Architecture

```
GitHub Actions Cron (6 AM / 6 PM UTC)
       │
       ▼
  /api/cron/batch
       │
       ├── Fetch news (RSS + GNews)
       ├── LLM Pass 1: Classify articles → topics
       ├── LLM Pass 2: Score each topic (eco/health/econ)
       └── Store: upsert topics, dedup articles, append score history
       │
       ▼
  PostgreSQL 17 ◄── Next.js App Router ──► Dashboard UI
```

## News sources

| Source | Type |
|--------|------|
| The Guardian Environment | RSS |
| Grist | RSS |
| Carbon Brief | RSS |
| Inside Climate News | RSS |
| EcoWatch | RSS |
| NPR Environment | RSS |
| Down to Earth | RSS |
| Mongabay India | RSS |
| GNews API | API (supplementary) |

## Running locally

Requires Node.js 18+ and PostgreSQL 17.

```bash
git clone https://github.com/sidtheone/ecoticker.git
cd ecoticker
npm install
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and API keys

npm run dev              # Dev server on :3000
npx drizzle-kit push    # Push schema to database
npx tsx scripts/seed.ts  # Seed demo data
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | Yes | API key from [openrouter.ai](https://openrouter.ai) |
| `OPENROUTER_MODEL` | No | Model ID (default: `meta-llama/llama-3.1-8b-instruct:free`) |
| `GNEWS_API_KEY` | No | API key from [gnews.io](https://gnews.io) — optional, RSS works without it |
| `ADMIN_API_KEY` | Yes | Admin key for write operations |

### Docker

```bash
cp .env.example .env
docker compose up -d
docker compose exec app npx drizzle-kit push
docker compose exec app npx tsx scripts/seed.ts
```

## Tests

```bash
npx jest                # Run all tests
npx jest --coverage     # With coverage report
```

680+ tests across 39 suites (98%+ statement coverage).

## Security

- API key auth on all write endpoints
- Rate limiting (100/min read, 10/min write)
- Zod input validation
- Parameterized queries (no SQL injection)
- Content-Security-Policy headers
- Audit logging on all write operations
- GDPR: no cookies, truncated IPs, `/data-policy` page

## License

MIT

## Built with

Built by [Sidharth Arora](https://github.com/sidtheone) with [Claude Code](https://claude.com/claude-code).
