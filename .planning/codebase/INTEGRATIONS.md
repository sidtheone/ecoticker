# External Integrations

**Analysis Date:** 2026-03-08

## APIs & External Services

**News Aggregation:**
- GNews API v4 - Primary news source for environmental articles
  - SDK/Client: Native `fetch()` with `AbortSignal.timeout(15000)`
  - Auth: `GNEWS_API_KEY` env var, passed as `token` query parameter
  - Endpoint: `https://gnews.io/api/v4/search`
  - Implementation: `src/lib/batch-pipeline.ts` (`fetchNews()`)
  - Rate limits: Batches keywords in groups of 4, max 10 results per query
  - Error handling: Per-query error logging, distinguishes 401 (auth) vs 429 (rate limit)

- RSS Feeds (10 curated environmental sources) - Secondary news source
  - SDK/Client: `rss-parser` package (singleton instance with 15s timeout)
  - Auth: None (public feeds)
  - Implementation: `src/lib/batch-pipeline.ts` (`fetchRssFeeds()`)
  - Default feeds configured in `DEFAULT_FEEDS` constant, overridable via `RSS_FEEDS` env var
  - Sources: The Guardian, Grist, Carbon Brief, Inside Climate News, EIA, EEA, EcoWatch, NPR, Down To Earth, Mongabay India
  - Health monitoring: Per-feed status tracking (`FeedHealth` interface) with duration, article count, and error reporting

**LLM Scoring:**
- OpenRouter API - LLM gateway for article classification and topic scoring
  - SDK/Client: Native `fetch()` with `AbortSignal.timeout(30000)`
  - Auth: `OPENROUTER_API_KEY` env var, passed as `Authorization: Bearer` header
  - Endpoint: `https://openrouter.ai/api/v1/chat/completions`
  - Model: `OPENROUTER_MODEL` env var (default: `meta-llama/llama-3.1-8b-instruct:free`)
  - Implementation: `src/lib/batch-pipeline.ts` (`callLLM()`)
  - Two-pass pipeline:
    - Pass 1 (Classification): Plain text mode, groups articles into topics (`classifyArticles()`)
    - Pass 2 (Scoring): JSON mode (`response_format: json_object`), scores topics on 3 dimensions (`scoreTopic()`)
  - Temperature: 0 (greedy decoding for consistency)
  - Fallback: Default scores (50/MODERATE) on LLM failure

## Data Storage

**Databases:**
- PostgreSQL 17
  - Connection: `DATABASE_URL` env var (e.g., `postgresql://postgres:postgres@localhost:5432/ecoticker`)
  - Client: Drizzle ORM over `pg` Pool
  - Pool config: max 10 connections, 30s idle timeout, 5s connection timeout (`src/db/index.ts`)
  - Schema: `src/db/schema.ts` (7 tables)
  - Tables:
    - `topics` - Environmental topics with scores, urgency, category
    - `articles` - News articles linked to topics (UNIQUE on URL)
    - `score_history` - Historical scores with LLM reasoning and raw responses (JSONB)
    - `topic_keywords` - Keywords associated with topics
    - `audit_logs` - GDPR-compliant write operation logs (90-day auto-purge)
    - `tracked_keywords` - User-tracked search keywords
    - `topic_views` - Daily view counts per topic
    - `score_feedback` - User feedback on topic scores

**File Storage:**
- None (no file uploads or blob storage)

**Caching:**
- In-memory rate limit store only (`src/lib/rate-limit.ts`)
- No dedicated cache layer (Redis, Memcached, etc.)

## Authentication & Identity

**API Key Auth (Custom):**
- Implementation: `src/lib/auth.ts` (`requireAdminKey()`, `getUnauthorizedResponse()`)
- Mechanism: `X-API-Key` header compared against `ADMIN_API_KEY` env var
- Scope: All write operations (POST/PUT/DELETE) require valid key
- Public: All read operations (GET) are unauthenticated
- Response: 401 with `WWW-Authenticate: API-Key` header on failure

**Cron Auth:**
- Implementation: `src/app/api/cron/batch/route.ts`
- Mechanism: `Authorization: Bearer <CRON_SECRET>` header
- Scope: Cron batch endpoint only (`/api/cron/batch`)

**No user authentication system** - No login, sessions, JWT, or OAuth. Single admin key model.

## Rate Limiting

**In-Memory Rate Limiter (`src/lib/rate-limit.ts`, `src/middleware.ts`):**
- Read endpoints (GET): 100 requests/minute per IP
- Write endpoints (POST/PUT/DELETE): 10 requests/minute per IP
- Batch/Seed endpoints: 2 requests/hour per IP
- Response: 429 with `Retry-After` and `X-RateLimit-Reset` headers
- IP detection: `x-forwarded-for` > `x-real-ip` > `"unknown"`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)
- Console logging only

**Logs:**
- `console.log/warn/error` throughout
- Structured batch pipeline logging with step markers (`[1/4]`, `[2/4]`, etc.)
- Feed health reporting per RSS source
- Anomaly detection warnings for score jumps > 25 points

**Audit Trail:**
- `audit_logs` table in PostgreSQL (`src/db/schema.ts`)
- Queryable via `GET /api/audit-logs`
- GDPR-compliant: IP addresses truncated, auto-purged after 90 days
- Records: endpoint, method, action, success/failure, error message, details

**Health Check:**
- Docker healthcheck: `GET /api/ticker` every 30s
- Dedicated health endpoint: `GET /api/health` (`src/app/api/health/route.ts`)

## CI/CD & Deployment

**Hosting:**
- Railway (primary production target)
  - Auto-injects `DATABASE_URL` for managed PostgreSQL
  - Environment variables configured via Railway dashboard
  - `.env.railway.example` documents required variables

**CI Pipeline:**
- GitHub Actions (`.github/workflows/security.yml`)
  - Dependency audit (`npm audit --omit=dev`)
  - Security linting (hardcoded secrets, eval, SQL injection, .env files)
  - Dockerfile security (non-root user, no inline secrets)
  - Full test suite (`npx jest --ci`)

**Docker Deployment:**
- `docker-compose.yml` for self-hosted deployment
  - 4 services: postgres, app, nginx (reverse proxy), cron
  - Nginx on port 80 with gzip, static caching, security headers
  - Alpine crond for daily batch at 6AM UTC

## Environment Configuration

**Required env vars (minimum viable):**
- `DATABASE_URL` - PostgreSQL connection string

**Required for real data processing:**
- `GNEWS_API_KEY` - GNews API key (falls back to demo seed data without it)
- `OPENROUTER_API_KEY` - OpenRouter LLM key (falls back to demo seed data without it)
- `ADMIN_API_KEY` - Admin authentication for write endpoints

**Required for production cron:**
- `CRON_SECRET` - Bearer token for cron endpoint

**Optional:**
- `OPENROUTER_MODEL` - LLM model (default: `meta-llama/llama-3.1-8b-instruct:free`)
- `BATCH_KEYWORDS` - GNews search keywords (has sensible defaults)
- `RSS_FEEDS` - Custom RSS feeds (defaults to 10 curated environmental feeds)
- `NEXT_PUBLIC_BASE_URL` - Public URL for OG meta tags

**Secrets location:**
- `.env` file locally (gitignored)
- Railway dashboard in production
- `.env.example` and `.env.railway.example` document required variables (no actual secrets)

## Webhooks & Callbacks

**Incoming:**
- `GET /api/cron/batch` - Cron webhook for scheduled batch processing (Bearer auth)
- `POST /api/cron/batch` - Manual batch trigger (Bearer auth)

**Outgoing:**
- None (no webhook dispatch to external services)

## Security Headers

**Applied via middleware (`src/middleware.ts`):**
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Content-Security-Policy` with `unsafe-inline` for Next.js hydration and Tailwind

## Blocked Domains

**Domain blocklist (`src/lib/batch-pipeline.ts`):**
- `lifesciencesworld.com` - Q&A/educational junk content
- `alltoc.com` - Q&A/educational junk content
- Articles from these domains are rejected before LLM classification

---

*Integration audit: 2026-03-08*
