# EcoTicker Deploy Workflow

How code goes from `git push` to live at `ecoticker.sidsinsights.com`.

## The Pipeline

```
git push origin main
        │
        ▼
┌─────────────────────┐
│  GitHub Actions CI   │  security.yml — runs on push to main
│                      │
│  1. npm audit        │  dependency vulnerabilities (prod only)
│  2. security lint    │  hardcoded secrets, eval(), SQL injection
│  3. Dockerfile check │  non-root user, no inline secrets
│  4. npx jest --ci    │  622 tests across 39 suites
│                      │
│  All 4 must pass     │
└──────────┬──────────┘
           │ (parallel)
           ▼
┌─────────────────────┐
│  Railway Detects     │  watches main branch
│  Push to main        │  auto-triggers build
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Railway Build (Dockerfile — 3-stage)        │
│                                              │
│  Stage 1: deps                               │
│    FROM node:20-alpine                       │
│    npm ci --omit=dev                         │
│                                              │
│  Stage 2: builder                            │
│    npm ci (all deps)                         │
│    npm run build → Next.js standalone output │
│                                              │
│  Stage 3: runner                             │
│    FROM node:20-alpine (clean image)         │
│    Copy standalone build + static assets     │
│    Copy scripts/, db schema, runtime deps    │
│    USER nextjs (non-root)                    │
│    CMD node server.js                        │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Railway Runtime                             │
│                                              │
│  Env vars (from Railway dashboard):          │
│    DATABASE_URL     ← auto-injected by Rail  │
│    GNEWS_API_KEY    ← GNews Essential tier   │
│    OPENROUTER_API_KEY ← free tier            │
│    OPENROUTER_MODEL ← llama-3.1-8b:free      │
│    ADMIN_API_KEY    ← write endpoint auth    │
│    CRON_SECRET      ← cron endpoint auth     │
│    BATCH_KEYWORDS   ← GNews search terms     │
│    NODE_ENV=production                       │
│                                              │
│  Healthcheck: GET /api/ticker every 30s      │
│    → 200 = healthy, else restart             │
└──────────┬──────────────────────────────────┘
           │
           ▼
    App live on :3000
    Railway routes ecoticker.sidsinsights.com → :3000
```

## The Daily Batch Pipeline

```
Railway Cron (0 6 * * * — 6AM UTC daily)
        │
        ▼
GET /api/cron/batch
  Authorization: Bearer $CRON_SECRET
        │
        ▼
┌─────────────────────────────────────────────┐
│  Cron Route (src/app/api/cron/batch/route.ts)│
│                                              │
│  1. Verify Bearer $CRON_SECRET               │
│     └─ 401 if missing/wrong                  │
│                                              │
│  2. Check API keys present?                  │
│     ├─ YES: real-data mode                   │
│     └─ NO:  demo-data mode (seeds fake data) │
│                                              │
│  3. Call runBatchPipeline({mode: "cron"})     │
│     └─ from src/lib/batch-pipeline.ts        │
│                                              │
│  4. Return {success, mode, stats, duration}  │
└──────────┬──────────────────────────────────┘
           │ (real-data mode)
           ▼
┌─────────────────────────────────────────────┐
│  Batch Route (src/app/api/batch/route.ts)    │
│                                              │
│  1. requireAdminKey(request)                 │
│     └─ crypto.timingSafeEqual check       ← THE FIX
│                                              │
│  2. Call runBatchPipeline({mode: "api"})      │
│     └─ from src/lib/batch-pipeline.ts        │
│                                              │
│  Pipeline handles all 4 steps internally:    │
│                                              │
│     [1/4] Fetch news                         │
│     ├─ fetchRssFeeds() — 10 curated sources  │
│     │   Guardian, Grist, Carbon Brief, etc.  │
│     │   15s timeout per feed                 │
│     │                                        │
│     └─ fetchNews() — GNews API v4            │
│         Keywords from $BATCH_KEYWORDS        │
│         Groups of 4, max 10 results each     │
│         15s timeout                          │
│                                              │
│     [2/4] Classify articles                  │
│     └─ callLLM() → OpenRouter                │
│        Model: $OPENROUTER_MODEL              │
│        Groups articles into topics           │
│        Plain text mode, temp=0               │
│        30s timeout                           │
│                                              │
│     [3/4] Score topics                       │
│     └─ callLLM() → OpenRouter (per topic)    │
│        JSON mode (response_format: json)     │
│        3 dimensions: ecological, health, econ│
│        Scores 0-100 per dimension            │
│        Overall = weighted average            │
│        Urgency derived from score            │
│        Fallback: score 50 on LLM failure     │
│                                              │
│     [4/4] Persist results                    │
│     └─ PostgreSQL via Drizzle ORM            │
│        Upsert topics (rotate previous_score) │
│        Insert articles (ON CONFLICT NOTHING) │
│        Insert keywords                       │
│        Insert score_history (with reasoning) │
│        Purge audit_logs > 90 days            │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Dashboard (ecoticker.sidsinsights.com)      │
│                                              │
│  GET /api/ticker  → scrolling ticker bar     │
│  GET /api/topics  → topic grid with scores   │
│  GET /api/movers  → biggest score changes    │
│                                              │
│  Each topic shows:                           │
│    Score (0-100), urgency badge, trend arrow  │
│    Sparkline (score history), sub-scores     │
│    Article count, last updated timestamp     │
│                                              │
│  Urgency mapping:                            │
│    80+ = breaking (red)                      │
│    60-79 = critical (orange)                 │
│    30-59 = moderate (yellow)                 │
│    <30 = informational (green)               │
└─────────────────────────────────────────────┘
```

## Auth Flow (2 layers)

```
External request
        │
        ▼
┌─────────────────────┐
│  middleware.ts       │  Runs on ALL requests
│                      │
│  Rate limiting:      │
│    GET:  100/min/IP  │
│    POST: 10/min/IP   │
│    Batch: 2/hour/IP  │
│                      │
│  Security headers:   │
│    CSP, X-Frame,     │
│    HSTS, etc.        │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  Route-level auth                         │
│                                           │
│  Cron endpoints:                          │
│    Authorization: Bearer $CRON_SECRET     │
│    └─ Only Railway cron should know this  │
│                                           │
│  Write endpoints (POST/PUT/DELETE):       │
│    X-API-Key: $ADMIN_API_KEY              │
│    └─ requireAdminKey() in auth.ts        │
│    └─ timingSafeEqual comparison          │
│                                           │
│  Read endpoints (GET):                    │
│    No auth — public access                │
└──────────────────────────────────────────┘
```

## Docker Compose (self-hosted alternative)

```
docker compose up -d
        │
        ├─ postgres (17-alpine)
        │    Port 5433, volume: pgdata
        │    Healthcheck: pg_isready
        │
        ├─ app (Dockerfile)
        │    Port 3000 (internal)
        │    Depends on: postgres healthy
        │
        ├─ nginx (alpine)
        │    Port 80 (public)
        │    Reverse proxy → app:3000
        │    Gzip, static caching, security headers
        │
        └─ cron (same Dockerfile, different entrypoint)
             crond -f → runs scripts/batch.ts
             Schedule: 0 6 * * * (6AM UTC)
             Logs to stdout (docker logs)
```

## What We Fixed (Phase 1)

```
BEFORE:
  Cron → NextRequest(url, {method: "POST"})     ← no X-API-Key header
       → batchPOST(request)
       → requireAdminKey() → apiKey === adminKey ← timing-unsafe, returns false
       → 401 Unauthorized                        ← pipeline broken

AFTER:
  Cron → NextRequest(url, {method: "POST",
           headers: {"x-api-key": $ADMIN_API_KEY}})  ← header injected
       → batchPOST(request)
       → requireAdminKey() → timingSafeEqual(buf, buf) ← constant-time
       → 200 OK                                       ← pipeline works

REFACTOR (Phase 1, Step 3):
  BEFORE:
    api/batch/route.ts    ← 366 lines, all logic inline
    api/cron/batch/route.ts ← builds fake NextRequest, calls batchPOST()
    scripts/batch.ts       ← 312 lines, duplicated pipeline logic

  AFTER:
    src/lib/batch-pipeline.ts ← runBatchPipeline() — one function, three modes
    api/batch/route.ts        ← 68 lines, delegates to runBatchPipeline({mode: "api"})
    api/cron/batch/route.ts   ← 153 lines, delegates to runBatchPipeline({mode: "cron"})
    scripts/batch.ts          ← 76 lines, delegates to runBatchPipeline({mode: "cli"})
    Net: -114 lines, zero duplication
```
