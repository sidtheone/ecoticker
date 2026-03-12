# EcoTicker Architecture

Environmental news impact tracker. Aggregates news via GNews API and RSS feeds, scores severity with LLMs, displays a stock-ticker style UI with sparklines and trend indicators.

---

## System Overview

```
                        ┌─────────────────────────────────────┐
                        │           External Sources           │
                        │  GNews API      RSS Feeds (10)       │
                        └────────────┬────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │     Batch Pipeline       │  ← triggered by:
                        │  src/lib/batch-pipeline  │    - GitHub Actions (every 4h)
                        │                          │    - Docker crond (6 AM UTC)
                        │  1. Fetch + dedup        │    - POST /api/batch (manual)
                        │  2. LLM classify         │    - scripts/batch.ts (CLI)
                        │  3. LLM score            │
                        │  4. Persist to DB        │
                        └───────────┬─────────────┘
                                    │
                                    ▼
                        ┌─────────────────────────┐
                        │      PostgreSQL 17        │
                        │                          │
                        │  topics                  │
                        │  articles                │
                        │  score_history           │
                        │  topic_keywords          │
                        │  audit_logs              │
                        │  tracked_keywords        │
                        │  topic_views             │
                        │  score_feedback          │
                        └───────────┬─────────────┘
                                    │
                                    ▼
                        ┌─────────────────────────┐
                        │      Next.js 16 App      │
                        │  (App Router, TypeScript) │
                        │                          │
                        │  Server pages → Drizzle  │
                        │  API routes → Drizzle    │
                        └───────────┬─────────────┘
                                    │
                                    ▼
                        ┌─────────────────────────┐
                        │      Nginx (:80)         │
                        │  reverse proxy + gzip    │
                        │  security headers        │
                        │  static asset caching    │
                        └───────────┬─────────────┘
                                    │
                                    ▼
                              Browser / Client
```

---

## Deployment Targets

Two independent deployment configurations share the same codebase:

### Docker Compose (self-hosted)

```
Host :80
  └── nginx (nginx:alpine)
        └── proxy → app:3000
                     app (node:20-alpine, standalone Next.js)
                       ├── depends_on: postgres (healthy)
                       └── exposes :3000 (internal only)
                     cron (same image, crond entrypoint)
                       └── 0 6 * * * → tsx scripts/batch.ts
                     postgres (postgres:17-alpine)
                       └── volume: pgdata @ /var/lib/postgresql/data
                           port: 5433:5432 (host:container)
```

### Railway (managed)

```
Railway Platform
  ├── App service (Dockerfile, CMD: node server.js)
  │     └── healthcheck: GET /api/health (30s timeout)
  ├── Postgres addon (auto-injects DATABASE_URL)
  └── GitHub Actions cron (every 4h)
        └── curl GET /api/cron/batch  (Authorization: Bearer CRON_SECRET)
```

**Key difference:** Docker uses in-container crond (daily), Railway uses GitHub Actions (every 4 hours).

---

## Batch Pipeline

The entire pipeline is `runBatchPipeline()` in `src/lib/batch-pipeline.ts`. Three modes: `api` (POST /api/batch), `cron` (GET /api/cron/batch), `cli` (scripts/batch.ts). All share the same code path; only logging and error handling differ.

```
runBatchPipeline()
│
├── Step 1: Fetch Articles
│     ├── fetchNews()          ← GNews API
│     │     - keywords grouped into batches of 4 (OR queries)
│     │     - 15s timeout per batch
│     │     - filters blocked domains inline
│     └── fetchRssFeeds()      ← 10 RSS feeds in parallel
│           - rss-parser singleton (module-level, reused)
│           - 15s timeout per feed
│           - skips items missing dates
│
├── mergeAndDedup()
│     - RSS takes priority on duplicate URLs
│     - removes blocked domains again
│     - builds sourceMap: Map<url, "rss" | "gnews">
│
├── Step 2: LLM Pass 1 — Classification
│     classifyArticles() [batches of 10 articles]
│     │
│     ├── buildClassificationPrompt()
│     │     - includes existing topic names + keywords from DB
│     │     - instructs model: filter non-environmental, assign topic or create new
│     │
│     ├── callLLM(prompt, { jsonMode: false })
│     │     - OpenRouter API, 15s timeout
│     │     - extracts JSON via regex (handles LLM preamble)
│     │
│     └── response: { classifications: [{articleIndex, topicName, isNew}], rejected: [] }
│           - fallback: if all batches fail → assign all to "Environmental News"
│
├── Group articles by topicName → Map<string, NewsArticle[]>
│
├── Step 3: LLM Pass 2 — Scoring + Persistence (per topic group)
│     scoreTopic()
│     │
│     ├── buildScoringPrompt()
│     │     - 4 calibration examples (one per severity level)
│     │     - instructs: reason per dimension → level → numeric score
│     │
│     ├── callLLM(prompt, { jsonMode: true })
│     │     - temperature: 0 (deterministic)
│     │     - 30s timeout (AbortSignal.timeout)
│     │
│     ├── processScoreResult() [src/lib/scoring.ts — pure functions]
│     │     ├── validateScore(level, score)
│     │     │     - clamps to level range: MINIMAL(0-25) MODERATE(26-50)
│     │     │                               SIGNIFICANT(51-75) SEVERE(76-100)
│     │     ├── computeOverallScore(health, eco, econ)
│     │     │     - weighted avg: eco=40%, health=35%, econ=25%
│     │     │     - excludes INSUFFICIENT_DATA(-1) dims, renormalizes weights
│     │     ├── deriveUrgency(score)
│     │     │     - ≥80: breaking  ≥60: critical  ≥30: moderate  <30: informational
│     │     └── detectAnomaly()
│     │           - flags if any dimension jumps >25 points from previous score
│     │
│     └── Persist to DB
│           ├── topics.upsert (onConflictDoUpdate on slug)
│           │     - on insert: previousScore = 0
│           │     - on update: previousScore ← currentScore, currentScore ← newScore
│           │     - articleCount += N (cumulative)
│           │     - imageUrl: COALESCE(new, existing)
│           ├── articles.insertMany (onConflictDoNothing on url)
│           └── score_history.insert (full rubric + raw LLM response as JSONB)
│
└── Step 4: Audit Log Purge
      - deletes audit_logs rows older than 90 days (GDPR minimization)
```

---

## Database Schema

```
┌──────────────────────────────────────────────────────────────────┐
│ topics                                                           │
│  id (PK)  name  slug (UNIQUE)  category  region                  │
│  current_score  previous_score  urgency  impact_summary          │
│  image_url  article_count  hidden                                │
│  health_score  eco_score  econ_score  score_reasoning            │
│  created_at  updated_at                                          │
│  idx: urgency, category                                          │
└──────┬──────────────────────────────────────────────────────────┘
       │ 1
       │
       ├──< articles (topic_id FK)
       │      id  title  url (UNIQUE)  source  source_type
       │      summary  image_url  published_at  fetched_at
       │      idx: topic_id
       │
       ├──< score_history (topic_id FK)
       │      id  score  recorded_at (DATE)
       │      health_score  eco_score  econ_score
       │      health_level  eco_level  econ_level
       │      health_reasoning  eco_reasoning  econ_reasoning
       │      overall_summary  impact_summary
       │      raw_llm_response (JSONB)  anomaly_detected
       │      idx: topic_id, recorded_at
       │
       ├──< topic_keywords (topic_id FK)
       │      id  keyword
       │
       ├──< topic_views (topic_id FK)
       │      id  date  view_count
       │      UNIQUE (topic_id, date)
       │
       └──< score_feedback (topic_id FK, score_history_id FK)
              id  dimension  direction  comment  ip_address

┌──────────────────────────────────────────────────────────────────┐
│ audit_logs  (independent — no FK to topics)                      │
│  id  timestamp  ip_address (GDPR-truncated)                      │
│  endpoint  method  action  success  error_message  details       │
│  idx: timestamp, action                                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ tracked_keywords  (independent — global keyword pool)            │
│  id  keyword (UNIQUE)  active  status                            │
│  last_searched_at  result_count                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## API Routes

### Public (no auth)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/topics` | All topics with sparkline (last 7 scores via STRING_AGG subquery). Params: `?urgency=`, `?category=`. Cache: 5m/10m stale. |
| GET | `/api/topics/:slug` | Topic detail with eager-loaded articles + score history (single Drizzle relational query). |
| GET | `/api/ticker` | Top 15 topics (name, slug, score, change) for scrolling marquee. |
| GET | `/api/movers` | Up to 5 topics with largest score change (`ABS(current - previous) DESC`). |
| GET | `/api/health` | `{ lastBatchAt, isStale }` — reads MAX(recorded_at) from score_history. |

### Admin (X-API-Key header required)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/batch` | Manually trigger batch pipeline. Returns stats. |
| POST | `/api/articles` | Insert article (Zod-validated). Dedup via ON CONFLICT DO NOTHING. |
| DELETE | `/api/articles` | Batch delete by ids, url pattern, topicId, or source. Recalculates article_count. |
| DELETE | `/api/topics` | Batch delete by ids or articleCount threshold. Cascades in FK order. |
| POST | `/api/cleanup` | Delete seed/demo data heuristically. Supports `?dryRun=true`. |
| POST | `/api/seed` | Populate DB with demo topics and articles. |
| GET | `/api/audit-logs` | Paginated audit trail. `?stats=true` for aggregates. |

### Cron (Authorization: Bearer CRON_SECRET)

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/cron/batch` | Triggers batch pipeline. Falls back to seed if API keys absent. Used by GitHub Actions. |

---

## Frontend Component Tree

```
RootLayout (server)
  └── ThemeProvider (client — context, syncs to localStorage + DOM class)
        ├── [fixed overlay: top-right]
        │     ├── RefreshButton  ← emits eventBus("ui-refresh")
        │     └── ThemeToggle
        ├── StaleDataWarning  ← polls /api/health, shows banner if stale
        ├── {children}           ← page slot
        └── Footer

Home Page (server component — SSR, force-dynamic)
  ├── direct DB query (Drizzle, no API hop)
  ├── selectHeroTopic()  ← score: 0.6*currentScore + 0.4*|change|
  ├── HeroSection (client)
  │     ├── UrgencyBadge
  │     └── SeverityGauge
  └── TopicList (server-safe)
        └── [per topic row]
              ├── UrgencyBadge
              └── SeverityGauge (compact)

Topic Detail Page /topic/[slug] (client — "use client")
  ├── fetch /api/topics/:slug on mount + eventBus("ui-refresh")
  ├── [score-hero]
  │     ├── UrgencyBadge
  │     └── SeverityGauge (full-width marker style)
  ├── [insight-lede]  ← latest scoreHistory.overallSummary
  ├── [dimension breakdown]  ← eco / health / econ rows
  │     └── SeverityGauge (compact)
  ├── ArticleList  ← flat rows: title, source, sourceType badge, date, summary
  └── ScoreChart (client — Recharts LineChart with dimension toggles)

TickerBar (client — independent)
  └── fetch /api/ticker on mount, auto-refresh every 5m + eventBus

BiggestMovers (client — independent)
  └── fetch /api/movers on mount + eventBus

TopicGrid (client — alternative to TopicList, not used on home currently)
  ├── fetch /api/topics with urgency/category params
  └── TopicCard (per topic)
        └── Sparkline (Recharts LineChart, 64x32)
```

### Event Bus

`src/lib/events.ts` — lightweight pub/sub singleton. `RefreshButton` emits `"ui-refresh"`. `TickerBar`, `TopicGrid`, `BiggestMovers`, and `TopicDetailPage` all subscribe. A single button press refreshes all live data without a page navigation.

---

## Severity / Color System

All visual theming flows through `severityColor(score)` in `src/lib/utils.ts`:

| Score | Urgency | Color |
|-------|---------|-------|
| 80–100 | breaking | `#dc2626` (red-600) |
| 60–79 | critical | `#c2410c` (orange-700) |
| 30–59 | moderate | `#a16207` (yellow-700) |
| 0–29 | informational | `#15803d` (green-700) |

The same thresholds are used in: `scoreToUrgency()`, `deriveUrgency()` (scoring.ts), `urgency` column on the `topics` table, and every UI component.

---

## Security

| Layer | Mechanism |
|-------|-----------|
| **Write auth** | `requireAdminKey()` — timing-safe compare of `X-API-Key` against `ADMIN_API_KEY` env var |
| **Cron auth** | `Authorization: Bearer CRON_SECRET` header on `/api/cron/batch` |
| **Rate limiting** | In-memory: 100/min (read), 10/min (write), 2/hr (batch/seed). Returns 429 + Retry-After. |
| **Input validation** | Zod schemas on all write endpoints. Invalid enum params return 400. |
| **SQL injection** | Drizzle parameterized queries throughout. No string concatenation in SQL. |
| **Audit logging** | All write ops logged to `audit_logs`. IP GDPR-truncated at write time. Never throws. |
| **Error sanitization** | Production hides implementation details. Dev shows full errors. |
| **Nginx headers** | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, CSP, Permissions-Policy |
| **Dockerfile** | Final stage runs as non-root `nextjs` user (uid 1001) via `USER nextjs` |
| **CI** | npm audit, secret pattern scan, Dockerfile USER check, full test suite on every push |

---

## CI/CD

```
GitHub Actions (security.yml) — triggers: push + PR to main
  ├── audit       → npm audit --omit=dev
  ├── lint-security → regex scan: secrets, eval(), SQL interpolation, .env files
  ├── docker-security → Dockerfile: USER directive present, no secrets in ARG/ENV
  └── tests       → npx jest --ci (mocked DB, no Postgres dependency)

Railway — auto-deploys on push to main via GitHub integration
GitHub Actions (cron-batch.yml) — schedule: every 4 hours
  └── curl GET ${APP_URL}/api/cron/batch  (Bearer token auth)
```

---

## Key Libraries

| Library | Role |
|---------|------|
| Next.js 16 | App Router, SSR, standalone build |
| Drizzle ORM | Type-safe query builder + schema definitions |
| PostgreSQL 17 | Primary data store (pg connection pool) |
| Recharts | Sparklines, ScoreChart (line chart), SeverityGauge |
| Zod | Input validation schemas for write endpoints |
| rss-parser | RSS feed fetching (singleton, reused across pipeline runs) |
| OpenRouter | LLM gateway for classification + scoring (via fetch) |
| GNews API | News article search API |
| tsx | TypeScript execution for batch CLI script |
