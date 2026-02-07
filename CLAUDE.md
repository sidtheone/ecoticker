# CLAUDE.md — EcoTicker

## Project Overview

Environmental news impact tracker. Aggregates news via NewsAPI, scores severity with OpenRouter LLMs, displays stock-ticker style UI with sparklines and trend indicators.

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
- **SQLite** via better-sqlite3 (WAL mode)
- **Recharts** for sparklines and score charts
- **Docker Compose** (app + nginx + cron)

## Key Commands

```bash
npm run dev          # Dev server on :3000
npx jest             # Run all 114 tests (16 suites)
npx jest --coverage  # With coverage (98.6% stmts)
npx tsx scripts/seed.ts   # Seed sample data
npx tsx scripts/batch.ts  # Run batch pipeline
docker compose build      # Build Docker images
docker compose up -d      # Start production stack
```

## Project Structure

- `src/app/` — Pages (dashboard, topic detail) + API routes (topics, ticker, movers)
- `src/components/` — ThemeProvider, ThemeToggle, TickerBar, TopicGrid, TopicCard, BiggestMovers, Sparkline, ScoreChart, ArticleList, UrgencyBadge
- `src/lib/` — db.ts (SQLite singleton), types.ts, utils.ts
- `scripts/` — batch.ts (daily pipeline), seed.ts (demo data)
- `db/schema.sql` — 4 tables: topics, articles, score_history, topic_keywords
- `tests/` — Jest with two projects: node (.test.ts) and react/jsdom (.test.tsx)

## Code Patterns

- API routes return camelCase JSON, DB uses snake_case columns
- Topic scores 0-100 with urgency: breaking (80+), critical (60-79), moderate (30-59), informational (<30)
- Colors: red=breaking/worsening, orange=critical, yellow=moderate, green=informational/improving
- Theme: class-based dark mode (`@custom-variant dark`), warm cream/beige light theme, localStorage persistence, OS preference fallback
- API input validation: urgency/category params validated against allowed enums (400 on invalid)
- Batch pipeline: 2-pass LLM (classify articles → score topics), 15s/30s request timeouts
- SQLite dedup: UNIQUE on articles.url with INSERT OR IGNORE
- Topic upsert rotates previous_score before updating current_score

## Testing

- Mock `next/link` as `<a>` in component tests
- Mock `recharts` as simple divs with data-testid in jsdom tests
- Mock `global.fetch` for component tests that fetch API data
- API tests use real SQLite in-memory DBs with schema loaded from db/schema.sql
- Jest config: two projects — "node" (ts-jest, node env) and "react" (ts-jest, jsdom env, @/ path alias)

## Docker

- Multi-stage Dockerfile with `output: "standalone"` in next.config.ts
- Named volume `ecoticker-data` shared between app and cron containers for SQLite
- Alpine crond for daily batch at 6AM UTC
- Nginx reverse proxy on :80 with gzip, static asset caching, and security headers (CSP, X-Frame-Options, etc.)

## CI/CD

- GitHub Actions workflow (`.github/workflows/security.yml`) runs on push/PR to main
- Jobs: dependency audit, security linting (secrets, eval, SQL injection patterns), Dockerfile checks, full test suite
