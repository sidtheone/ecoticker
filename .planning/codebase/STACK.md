# Technology Stack

**Analysis Date:** 2026-03-08

## Languages

**Primary:**
- TypeScript 5.x - All application code (`src/`, `scripts/`, `tests/`)
- Target: ES2017, strict mode enabled

**Secondary:**
- SQL (PostgreSQL 17) - Via Drizzle ORM query builder, no raw SQL files
- Shell (Bash) - Git hooks setup script (`scripts/setup-git-hooks.sh`)

## Runtime

**Environment:**
- Node.js 20 (Alpine variant in Docker, specified in `Dockerfile` and `.github/workflows/security.yml`)
- No `.nvmrc` file present

**Package Manager:**
- npm (lockfile: `package-lock.json` present)
- Uses `npm ci` for deterministic installs in CI and Docker

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework (App Router)
  - Config: `next.config.ts` with `output: "standalone"` for Docker
  - Middleware: `src/middleware.ts` (rate limiting, security headers, CSP)
- React 19.2.3 / React DOM 19.2.3 - UI rendering
- Tailwind CSS 4 - Utility-first styling via PostCSS plugin
  - Config: `postcss.config.mjs` with `@tailwindcss/postcss`

**ORM / Database:**
- Drizzle ORM 0.45.1 - Type-safe PostgreSQL query builder
  - Schema: `src/db/schema.ts`
  - Connection: `src/db/index.ts` (pg Pool, max 10 connections)
  - Config: `drizzle.config.ts` (migrations output to `./drizzle/`)
- Drizzle Kit 0.31.9 - Schema push and studio tooling (dev dependency)

**Testing:**
- Jest 30.2.0 - Test runner with two project configs (`jest.config.ts`)
  - "node" project: `tests/**/*.test.ts` (node environment)
  - "react" project: `tests/**/*.test.tsx` (jsdom environment)
- ts-jest 29.4.6 - TypeScript transform for Jest
- jest-environment-jsdom 30.2.0 - Browser environment for React tests
- @testing-library/react 16.3.2 - React component testing
- @testing-library/jest-dom 6.9.1 - DOM assertion matchers

**Build/Dev:**
- ESLint 9 + eslint-config-next 16.1.6 - Linting (`eslint.config.mjs`)
- tsx 4.21.0 - TypeScript script runner (for `scripts/batch.ts`, `scripts/seed.ts`)
- ts-node 10.9.2 - TypeScript execution (Jest config loading)
- dotenv 17.3.1 - Environment variable loading for standalone scripts

## Key Dependencies

**Critical (Production):**
- `pg` 8.18.0 - PostgreSQL client (connection pooling, parameterized queries)
- `drizzle-orm` 0.45.1 - Type-safe ORM layer over pg
- `zod` 4.3.6 - Runtime input validation for API endpoints (`src/lib/validation.ts`)
- `recharts` 3.7.0 - Sparkline and score charts in dashboard UI
- `rss-parser` 3.13.0 - RSS feed parsing for news aggregation (`src/lib/batch-pipeline.ts`)
- `slugify` 1.6.6 - URL-safe slug generation for topic names

**Infrastructure (Dev):**
- `@tailwindcss/postcss` 4.x - Tailwind CSS PostCSS plugin
- `drizzle-kit` 0.31.9 - Database migration and studio tool

**Overrides:**
- `esbuild` >= 0.25.0 - Forced minimum version (in `package.json` overrides)

## Configuration

**Environment:**
- `.env.example` - Local development template (9 variables)
- `.env.railway.example` - Railway production template (7 variables)
- Required env vars for full operation:
  - `DATABASE_URL` - PostgreSQL connection string
  - `GNEWS_API_KEY` - GNews API authentication
  - `OPENROUTER_API_KEY` - OpenRouter LLM API key
  - `OPENROUTER_MODEL` - LLM model identifier (default: `meta-llama/llama-3.1-8b-instruct:free`)
  - `ADMIN_API_KEY` - API key for write endpoint authentication
  - `BATCH_KEYWORDS` - Comma-separated search terms for GNews
  - `RSS_FEEDS` - Comma-separated RSS feed URLs (defaults to 10 curated feeds)
  - `CRON_SECRET` - Bearer token for cron endpoint authentication
  - `NEXT_PUBLIC_BASE_URL` - Public URL for OG meta tags

**TypeScript:**
- `tsconfig.json` - Strict mode, bundler module resolution, `@/*` path alias to `./src/*`

**Build:**
- `next.config.ts` - Standalone output for Docker deployment
- `postcss.config.mjs` - Tailwind CSS via PostCSS
- `drizzle.config.ts` - PostgreSQL dialect, schema at `./src/db/schema.ts`

**Git Hooks:**
- Auto-installed via `postinstall` script (`scripts/setup-git-hooks.sh`)
- Pre-commit: TypeScript type check, build, lint

## Docker

**Multi-stage Build (`Dockerfile`):**
- Stage 1 (`deps`): `node:20-alpine`, production dependencies only
- Stage 2 (`builder`): `node:20-alpine`, full install + `next build`
- Stage 3 (`runner`): `node:20-alpine`, standalone output + batch script dependencies
- Runs as non-root user `nextjs` (UID 1001)
- Healthcheck: HTTP GET to `/api/ticker` every 30s

**Docker Compose (`docker-compose.yml`):**
- 4 services: `postgres`, `app`, `nginx`, `cron`
- PostgreSQL 17 Alpine with healthcheck and 512MB memory limit
- App container: 1GB memory limit, depends on healthy postgres
- Nginx Alpine: reverse proxy on port 80
- Cron container: Alpine crond for scheduled batch jobs (daily 6AM UTC)
- Named volume: `pgdata` for PostgreSQL data persistence

## Platform Requirements

**Development:**
- Node.js 20+
- PostgreSQL 17 (local or via Docker Compose on port 5433)
- npm for package management

**Production:**
- Railway (primary deployment target, auto-injects `DATABASE_URL`)
- Docker with standalone Next.js output
- PostgreSQL 17 (Railway managed or Docker Compose service)

## CI/CD

**GitHub Actions (`.github/workflows/security.yml`):**
- Triggers: push to main, PR to main
- Jobs: dependency audit, security linting (secrets/eval/SQL injection), Dockerfile checks, full test suite
- Node.js 20 with npm cache
- Tests run with mocked database (no PostgreSQL in CI)

---

*Stack analysis: 2026-03-08*
