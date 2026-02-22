# CLAUDE.md — EcoTicker

## Project Overview

Environmental news impact tracker. Aggregates news via GNews API, scores severity with OpenRouter LLMs, displays stock-ticker style UI with sparklines and trend indicators.

## ⚠️ CRITICAL: Pre-Commit Requirements

**ALWAYS build and check for errors before committing:**

1. **Automated (Recommended):** Git hooks run automatically after `npm install`
   ```bash
   # Hooks auto-installed via postinstall script
   # Pre-commit checks: TypeScript, Build, Lint
   ```

2. **Manual:** If hooks aren't installed:
   ```bash
   npm run setup:hooks
   ```

3. **Before Every Commit:**
   - ✅ TypeScript type check passes
   - ✅ Build completes successfully
   - ✅ No linting errors

4. **Bypass (Emergency Only):**
   ```bash
   git commit --no-verify  # Use sparingly!
   ```

**Why:** Prevents broken builds from reaching Railway/production.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **PostgreSQL 17** + **Drizzle ORM** (type-safe query builder)
- **Recharts** for sparklines and score charts
- **Zod** for input validation
- **Docker Compose** (app + nginx + cron + postgres)

## Key Commands

```bash
npm run dev          # Dev server on :3000
npx drizzle-kit push # Push schema changes to PostgreSQL
npx drizzle-kit studio # Open Drizzle Studio (GUI for DB)
npx jest             # Run all 604 tests (37 suites)
npx jest --coverage  # With coverage (98.6% stmts)
npx tsx scripts/seed.ts   # Seed sample data
npx tsx scripts/batch.ts  # Run batch pipeline
docker compose build      # Build Docker images
docker compose up -d      # Start production stack (app + postgres + nginx + cron)
```

## Project Structure

- `src/app/` — Pages (dashboard, topic detail) + API routes (topics, articles, ticker, movers, batch, seed, cleanup, audit-logs)
- `src/components/` — ThemeProvider, ThemeToggle, TickerBar, TopicGrid, TopicCard, BiggestMovers, Sparkline, ScoreChart, ArticleList, UrgencyBadge
- `src/lib/` — types.ts, utils.ts, auth.ts (API key auth), rate-limit.ts, validation.ts (Zod schemas), errors.ts, audit-log.ts
- `src/db/` — index.ts (Drizzle connection pool), schema.ts (Drizzle schema definitions)
- `scripts/` — batch.ts (daily pipeline), seed.ts (demo data)
- `drizzle.config.ts` — Drizzle Kit configuration for migrations
- `tests/` — Jest with two projects: node (.test.ts) and react/jsdom (.test.tsx)

## Security Features

- **Authentication:** X-API-Key header required for all write operations (POST/PUT/DELETE). Public read access (GET). ADMIN_API_KEY env var.
- **Rate Limiting:** In-memory rate limiter in middleware: 100/min (read), 10/min (write), 2/hour (batch/seed). Returns 429 with Retry-After header.
- **Input Validation:** Zod schemas for all write endpoints (articles, topics). Type-safe validation with detailed error messages.
- **SQL Injection Protection:** Parameterized queries with placeholders throughout. No string concatenation in SQL.
- **CSP:** Content-Security-Policy enabled with Next.js-compatible directives (unsafe-inline for hydration).
- **Audit Logging:** All write operations logged to audit_logs table with IP, timestamp, action, success/failure, details. Queryable via GET /api/audit-logs.
- **Error Sanitization:** Production errors hide implementation details. Development shows full error messages.

## Code Patterns

- API routes return camelCase JSON, DB uses snake_case columns
- Topic scores 0-100 with urgency: breaking (80+), critical (60-79), moderate (30-59), informational (<30)
- Colors: red=breaking/worsening, orange=critical, yellow=moderate, green=informational/improving
- Theme: class-based dark mode (`@custom-variant dark`), warm cream/beige light theme, localStorage persistence, OS preference fallback
- API input validation: urgency/category params validated against allowed enums (400 on invalid), write endpoints use Zod schemas
- Batch pipeline: 2-pass LLM (classify articles → score topics), 15s/30s request timeouts
- Database operations: All async/await with Drizzle query builder (e.g., `db.select().from(topics)`)
- Article dedup: UNIQUE constraint on articles.url with ON CONFLICT DO NOTHING
- Topic upsert: Use Drizzle's `.onConflictDoUpdate()` to rotate previous_score before updating current_score
- Connection pooling: PostgreSQL connection pool managed by Drizzle (pg library)
- Authentication: requireAdminKey() check at start of all write handlers, returns 401 if missing/invalid

## Testing

- Mock `next/link` as `<a>` in component tests
- Mock `recharts` as simple divs with data-testid in jsdom tests
- Mock `global.fetch` for component tests that fetch API data
- API tests mock `@/db` module (Drizzle queries) for unit tests; local integration tests use real PostgreSQL
- CI tests run with mocked database to avoid PostgreSQL dependency in GitHub Actions
- Jest config: two projects — "node" (ts-jest, node env) and "react" (ts-jest, jsdom env, @/ path alias)

## Docker

- Multi-stage Dockerfile with `output: "standalone"` in next.config.ts
- PostgreSQL 17 service with named volume `pgdata` for data persistence
- Named volume `ecoticker-data` removed (PostgreSQL replaces SQLite file storage)
- App and cron containers connect to postgres service via DATABASE_URL
- Alpine crond for daily batch at 6AM UTC
- Nginx reverse proxy on :80 with gzip, static asset caching, and security headers (CSP, X-Frame-Options, etc.)

## CI/CD

- GitHub Actions workflow (`.github/workflows/security.yml`) runs on push/PR to main
- Jobs: dependency audit, security linting (secrets, eval, SQL injection patterns), Dockerfile checks, full test suite
