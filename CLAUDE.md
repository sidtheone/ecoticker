# CLAUDE.md — EcoTicker

## Project Overview

Environmental news impact tracker. Aggregates news via NewsAPI, scores severity with OpenRouter LLMs, displays stock-ticker style UI with sparklines and trend indicators.

## 🚀 Efficient Context Loading

**IMPORTANT: Always read `PROJECT_INDEX.md` first to understand the codebase efficiently.**

### Token Efficiency

- **Without index:** Reading all files = ~57,000 tokens per session
- **With index:** Reading PROJECT_INDEX.md = ~3,500 tokens (94% reduction)
- **Savings:** 53,500 tokens per session

### Available Index Files

1. **`PROJECT_INDEX.md`** (12 KB) — Human-readable comprehensive index
   - Complete project structure with file purposes
   - All 11 API endpoints documented (public + protected)
   - All 10 React components mapped
   - Database schema (5 tables)
   - Security features, Docker services, CI/CD
   - 100% accuracy verified

2. **`PROJECT_INDEX.json`** (11 KB) — Machine-readable structured data
   - Programmatic access to project metadata
   - API definitions with parameters and responses
   - Stack information, metrics, quick start guide

3. **`docs/TOKEN_EFFICIENCY_REPORT.md`** — Detailed ROI analysis
   - Token savings calculations
   - Best practices and usage patterns

### Recommended Workflow

```bash
# 1. Start every session by reading the index
cat PROJECT_INDEX.md  # 3,500 tokens

# 2. Identify relevant files from the index
# Example: Need to modify auth? Index shows: src/lib/auth.ts

# 3. Read ONLY those specific files
cat src/lib/auth.ts  # 1,500 tokens

# Total: 5,000 tokens vs 57,000 tokens (91% savings)
```

### When to Use the Index

✅ **Use PROJECT_INDEX.md for:**
- Starting any new coding session
- Understanding project architecture
- Finding entry points (pages, APIs, components)
- Locating specific utilities or modules
- Understanding database schema
- Reviewing test coverage and security features

❌ **Don't use for:**
- Reading actual implementation code
- Line-by-line debugging
- Understanding complex algorithms

### Keeping the Index Updated

The index should be updated when:
- Adding new API routes or components
- Creating new database tables
- Significant architecture changes
- Major security features added

**Update command:** Re-run the index-repo tool (see docs/TOKEN_EFFICIENCY_REPORT.md)

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
- **PostgreSQL** via pg (node-postgres)
- **Recharts** for sparklines and score charts
- **Zod** for input validation
- **Docker Compose** (app + nginx + cron)

## Key Commands

```bash
npm run dev          # Dev server on :3000
npx jest             # Run all 132 tests (17 suites)
npx jest --coverage  # With coverage (98.6% stmts)
npx tsx scripts/seed.ts   # Seed sample data
npx tsx scripts/batch.ts  # Run batch pipeline
docker compose build      # Build Docker images
docker compose up -d      # Start production stack
```

## Project Structure

- `src/app/` — Pages (dashboard, topic detail) + API routes (topics, articles, ticker, movers, batch, seed, cleanup, audit-logs)
- `src/components/` — ThemeProvider, ThemeToggle, TickerBar, TopicGrid, TopicCard, BiggestMovers, Sparkline, ScoreChart, ArticleList, UrgencyBadge
- `src/lib/` — db.ts (pg Pool singleton), types.ts, utils.ts, auth.ts (API key auth), rate-limit.ts, validation.ts (Zod schemas), errors.ts, audit-log.ts
- `scripts/` — batch.ts (daily pipeline), seed.ts (demo data)
- `db/schema.sql` — 5 tables: topics, articles, score_history, topic_keywords, audit_logs
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
- PostgreSQL dedup: UNIQUE on articles.url with ON CONFLICT DO NOTHING
- Topic upsert rotates previous_score before updating current_score
- Authentication: requireAdminKey() check at start of all write handlers, returns 401 if missing/invalid

## Testing

- Mock `next/link` as `<a>` in component tests
- Mock `recharts` as simple divs with data-testid in jsdom tests
- Mock `global.fetch` for component tests that fetch API data
- API tests use a real PostgreSQL test database with schema loaded from db/schema.sql
- Jest config: two projects — "node" (ts-jest, node env) and "react" (ts-jest, jsdom env, @/ path alias)

## Docker

- Multi-stage Dockerfile with `output: "standalone"` in next.config.ts
- PostgreSQL service with named `pgdata` volume for persistence
- Alpine crond for daily batch at 6AM UTC
- Nginx reverse proxy on :80 with gzip, static asset caching, and security headers (CSP, X-Frame-Options, etc.)

## CI/CD

- GitHub Actions workflow (`.github/workflows/security.yml`) runs on push/PR to main
- Jobs: dependency audit, security linting (secrets, eval, SQL injection patterns), Dockerfile checks, full test suite
