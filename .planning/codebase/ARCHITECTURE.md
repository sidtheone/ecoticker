# Architecture

**Analysis Date:** 2026-03-08

## Pattern Overview

**Overall:** Next.js App Router monolith with a 2-pass LLM batch pipeline

**Key Characteristics:**
- Server-rendered dashboard with client-side interactive components
- REST API routes colocated with pages in the App Router convention
- Batch data pipeline (fetch news -> classify -> score -> persist) runs via API endpoint or standalone script
- PostgreSQL as single data store with Drizzle ORM for type-safe queries
- No separate backend service -- everything runs inside the Next.js process

## Layers

**Presentation Layer (Pages + Components):**
- Purpose: Render the dashboard, topic detail pages, and static info pages
- Location: `src/app/` (pages), `src/components/` (shared UI)
- Contains: React Server Components (pages), Client Components (interactive widgets)
- Depends on: API routes (client-side fetch), `src/lib/types.ts`, `src/lib/utils.ts`, `src/lib/events.ts`
- Used by: End users via browser

**API Layer (Route Handlers):**
- Purpose: Serve JSON data, handle writes, orchestrate batch processing
- Location: `src/app/api/`
- Contains: Next.js Route Handler files (`route.ts`) for each endpoint
- Depends on: `src/db/` (Drizzle), `src/lib/auth.ts`, `src/lib/validation.ts`, `src/lib/errors.ts`, `src/lib/audit-log.ts`, `src/lib/batch-pipeline.ts`
- Used by: Presentation layer (fetch calls), cron jobs, external API consumers

**Business Logic Layer (lib):**
- Purpose: Shared domain logic, scoring, batch pipeline orchestration, utilities
- Location: `src/lib/`
- Contains: Batch pipeline (`batch-pipeline.ts`), scoring engine (`scoring.ts`), types, validation schemas, auth, rate limiting, error handling, audit logging
- Depends on: External APIs (GNews, OpenRouter), `src/db/schema.ts` (types only -- `batch-pipeline.ts` has no DB imports)
- Used by: API routes, standalone scripts

**Data Layer (Database):**
- Purpose: PostgreSQL connection pool and Drizzle schema definitions
- Location: `src/db/`
- Contains: Connection pool (`index.ts`), schema with relations (`schema.ts`)
- Depends on: PostgreSQL via `DATABASE_URL` env var
- Used by: API routes, `src/lib/audit-log.ts`

**Scripts Layer:**
- Purpose: Standalone CLI tools for batch processing, seeding, RSS testing
- Location: `scripts/`
- Contains: `batch.ts` (daily pipeline), `seed.ts` (demo data), `rss.ts` (feed testing)
- Depends on: `src/lib/batch-pipeline.ts`, `src/db/schema.ts` (creates its own DB connection)
- Used by: Docker cron container, developer CLI

**Middleware:**
- Purpose: Rate limiting and security headers for all requests
- Location: `src/middleware.ts`
- Contains: Rate limit checks (read/write/batch tiers), CSP and security headers
- Depends on: `src/lib/rate-limit.ts`
- Used by: Next.js runtime (runs before every matched request)

## Data Flow

**Dashboard Load (Server-Side):**

1. Browser requests `/` -> Next.js renders `src/app/page.tsx` (RSC)
2. Page queries `db.select().from(topics)` directly (server component)
3. Selects hero topic using `selectHeroTopic()` from `src/lib/utils.ts`
4. Renders `HeroSection` (server) + `TopicGrid` (client component)
5. `TopicGrid` mounts on client, fetches `GET /api/topics` for full topic list with sparklines
6. `TickerBar` fetches `GET /api/ticker` independently on mount

**Topic Detail (Client-Side):**

1. User clicks topic card -> navigates to `/topic/[slug]`
2. `src/app/topic/[slug]/page.tsx` (client component) mounts
3. Fetches `GET /api/topics/[slug]` which returns topic + articles + score history
4. Renders score hero, dimension breakdown, article list, score chart

**Batch Pipeline (News Ingestion):**

1. Triggered via `POST /api/batch` (API), `GET /api/cron/batch` (cron), or `npx tsx scripts/batch.ts` (CLI) -- all three delegate to `runBatchPipeline()` in `src/lib/batch-pipeline.ts`
2. **Fetch phase**: Parallel fetch from GNews API + 10 RSS feeds via `fetchNews()` + `fetchRssFeeds()`
3. **Merge phase**: `mergeAndDedup()` combines sources, RSS wins on URL duplicates, blocked domains filtered
4. **Pass 1 - Classification**: `classifyArticles()` sends article titles to OpenRouter LLM, returns topic groupings
5. **Pass 2 - Scoring**: `scoreTopic()` sends each topic's articles to LLM with rubric prompt, returns 3-dimension scores
6. **Validation**: `processScoreResult()` validates scores against level ranges, clamps, detects anomalies
7. **Persistence**: Upsert topics (rotate `previousScore`), insert articles (dedup on URL), insert score history, insert keywords
8. All three callers (API route, cron route, CLI script) delegate to `runBatchPipeline()` which handles orchestration; callers provide DB callbacks and mode-specific options

**UI Refresh Flow:**

1. User clicks RefreshButton -> `eventBus.emit('ui-refresh')`
2. All subscribed components (`TopicGrid`, `TickerBar`, `TopicDetailPage`) re-fetch their data
3. Event bus uses `window.CustomEvent` (defined in `src/lib/events.ts`)

**State Management:**
- No global state management library -- each component manages its own state via `useState`/`useEffect`
- Cross-component coordination via lightweight event bus (`src/lib/events.ts`)
- Server components query DB directly; client components fetch from API routes
- Theme state persisted in localStorage, read via inline script to prevent flash

## Key Abstractions

**Topic:**
- Purpose: Central domain entity -- an environmental issue being tracked
- Examples: `src/lib/types.ts` (TypeScript interface), `src/db/schema.ts` (DB table)
- Pattern: Score 0-100 mapped to urgency levels (breaking/critical/moderate/informational)

**Scoring Pipeline:**
- Purpose: 3-dimension severity scoring (health, ecological, economic) with weighted aggregation
- Examples: `src/lib/scoring.ts` (validation, aggregation), `src/lib/batch-pipeline.ts` (LLM integration)
- Pattern: LLM returns per-dimension level + score -> server validates/clamps -> computes weighted overall score -> derives urgency

**Drizzle Schema + Relations:**
- Purpose: Type-safe database schema with relational queries
- Examples: `src/db/schema.ts` (7 tables), `src/db/index.ts` (connection pool)
- Pattern: `pgTable()` definitions with `relations()` for Drizzle relational query API

**API Route Pattern:**
- Purpose: Consistent request handling across all endpoints
- Examples: `src/app/api/topics/route.ts`, `src/app/api/batch/route.ts`
- Pattern: Auth check -> Zod validation -> DB operation -> audit log -> JSON response with Cache-Control

## Entry Points

**Web Application:**
- Location: `src/app/layout.tsx` (root layout), `src/app/page.tsx` (dashboard)
- Triggers: Browser navigation
- Responsibilities: Render shell (TickerBar, ThemeProvider, Footer), load dashboard content

**API Endpoints:**
- Location: `src/app/api/*/route.ts`
- Triggers: Client-side fetch, external HTTP requests, cron jobs
- Responsibilities:
  - `GET /api/topics` - List all topics with sparklines, supports urgency/category filters
  - `GET /api/topics/[slug]` - Topic detail with articles and score history (relational query)
  - `GET /api/ticker` - Top 15 topics for scrolling ticker bar
  - `GET /api/movers` - Top 5 topics with largest score changes
  - `POST /api/batch` - Run full batch pipeline (admin auth required)
  - `POST /api/seed` - Seed demo data (admin auth required)
  - `POST /api/articles` - CRUD for articles (admin auth required)
  - `GET /api/audit-logs` - Query audit trail with stats
  - `GET /api/health` - Health check endpoint
  - `POST /api/cleanup` - Data cleanup (admin auth required)
  - `GET /api/cron/batch` - Cron-triggered batch (used by Docker cron container)

**Standalone Scripts:**
- Location: `scripts/batch.ts`
- Triggers: `npx tsx scripts/batch.ts` (CLI) or Docker cron at 6AM UTC
- Responsibilities: Thin CLI wrapper (~76 lines) that parses CLI args, creates own DB connection, and delegates to `runBatchPipeline()` from `src/lib/batch-pipeline.ts`; includes GDPR audit log purge

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every matched request (excludes static assets)
- Responsibilities: Rate limiting (3 tiers), security headers (CSP, X-Frame-Options, etc.)

## Error Handling

**Strategy:** Environment-aware error sanitization with request-scoped IDs

**Patterns:**
- `createErrorResponse()` in `src/lib/errors.ts` generates a unique `requestId`, logs full error server-side, returns sanitized message in production
- API routes use try/catch with `createErrorResponse()` for all DB and external API errors
- Batch pipeline logs per-step failures but continues processing remaining topics
- Audit logging failures are caught and logged to console -- never break the main operation (`src/lib/audit-log.ts` line 84-88)
- Classification LLM failures return empty array; callers decide fallback behavior (script falls back to "Environmental News" grouping)
- Scoring LLM failures return default scores (50 across all dimensions)

## Cross-Cutting Concerns

**Logging:** Console-based (`console.log`, `console.warn`, `console.error`). Batch pipeline uses step-numbered output (`[1/4]`, `[2/4]`, etc.). No structured logging framework.

**Validation:** Zod schemas for write endpoints (`src/lib/validation.ts`). Enum validation for query params (urgency, category) in route handlers. Score clamping against severity level ranges (`src/lib/scoring.ts`).

**Authentication:** API key via `X-API-Key` header, checked by `requireAdminKey()` in `src/lib/auth.ts`. Required for all write operations (POST/PUT/DELETE). Read endpoints are public. Returns 401 with `WWW-Authenticate: API-Key` header.

**Rate Limiting:** In-memory sliding window (`src/lib/rate-limit.ts`). Three tiers: read (100/min), write (10/min), batch (2/hour). Applied in `src/middleware.ts`. Returns 429 with `Retry-After` header.

**Audit Trail:** All write operations logged to `audit_logs` table via `logSuccess()`/`logFailure()` in `src/lib/audit-log.ts`. GDPR-compliant: IP addresses truncated before storage, auto-purged after 90 days.

**Caching:** API responses include `Cache-Control: public, max-age=300, stale-while-revalidate=600` for read endpoints. Dashboard page uses `dynamic = "force-dynamic"` to bypass Next.js cache.

---

*Architecture analysis: 2026-03-08*
