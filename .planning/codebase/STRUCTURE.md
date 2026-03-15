# Codebase Structure

**Analysis Date:** 2026-03-08

## Directory Layout

```
ecoticker/
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   │   ├── layout.tsx          # Root layout (shell, theme, ticker)
│   │   ├── page.tsx            # Dashboard homepage (RSC)
│   │   ├── globals.css         # Tailwind CSS 4 imports
│   │   ├── data-policy/        # Static page
│   │   │   └── page.tsx
│   │   ├── scoring/            # Static page (scoring methodology)
│   │   │   └── page.tsx
│   │   ├── topic/
│   │   │   └── [slug]/         # Topic detail (client component)
│   │   │       ├── layout.tsx
│   │   │       └── page.tsx
│   │   └── api/                # REST API route handlers
│   │       ├── articles/
│   │       │   ├── route.ts    # GET/POST/DELETE articles
│   │       │   └── [id]/
│   │       │       └── route.ts # GET/PUT/DELETE single article
│   │       ├── audit-logs/
│   │       │   └── route.ts    # GET audit logs + stats
│   │       ├── batch/
│   │       │   └── route.ts    # POST batch pipeline (thin wrapper -> runBatchPipeline)
│   │       ├── cleanup/
│   │       │   └── route.ts    # POST data cleanup (admin)
│   │       ├── cron/
│   │       │   └── batch/
│   │       │       └── route.ts # GET cron-triggered batch
│   │       ├── health/
│   │       │   └── route.ts    # GET health check
│   │       ├── movers/
│   │       │   └── route.ts    # GET biggest movers
│   │       ├── seed/
│   │       │   └── route.ts    # POST seed data (admin)
│   │       ├── ticker/
│   │       │   └── route.ts    # GET ticker data
│   │       └── topics/
│   │           ├── route.ts    # GET/DELETE topics
│   │           └── [slug]/
│   │               └── route.ts # GET topic detail
│   ├── components/             # Shared React components
│   │   ├── ArticleList.tsx     # Article source citations list
│   │   ├── BiggestMovers.tsx   # Top score movers widget
│   │   ├── Footer.tsx          # Site footer
│   │   ├── HeroSection.tsx     # Hero topic highlight
│   │   ├── RefreshButton.tsx   # Manual refresh trigger
│   │   ├── ScoreChart.tsx      # Score history chart (Recharts)
│   │   ├── ScoreInfoIcon.tsx   # Score explanation tooltip
│   │   ├── SeverityGauge.tsx   # Horizontal severity bar
│   │   ├── Sparkline.tsx       # Mini sparkline chart (Recharts)
│   │   ├── StaleDataWarning.tsx # Stale data notification
│   │   ├── ThemeProvider.tsx   # Dark/light theme context
│   │   ├── ThemeToggle.tsx     # Theme switch button
│   │   ├── TickerBar.tsx       # Scrolling stock-ticker bar
│   │   ├── TopicCard.tsx       # Topic summary card
│   │   ├── TopicGrid.tsx       # Filterable topic grid
│   │   └── UrgencyBadge.tsx    # Colored urgency label
│   ├── db/                     # Database layer
│   │   ├── index.ts            # Drizzle + pg Pool connection
│   │   └── schema.ts           # 7 tables, relations, indexes
│   ├── lib/                    # Shared business logic
│   │   ├── audit-log.ts        # Audit logging (GDPR-compliant)
│   │   ├── auth.ts             # API key authentication
│   │   ├── batch-pipeline.ts   # News fetch, classify, score (no DB deps)
│   │   ├── errors.ts           # Centralized error responses
│   │   ├── events.ts           # Client-side event bus
│   │   ├── rate-limit.ts       # In-memory rate limiter
│   │   ├── scoring.ts          # Score validation, aggregation, anomaly detection
│   │   ├── types.ts            # TypeScript interfaces (Topic, Article, etc.)
│   │   ├── utils.ts            # UI helpers (colors, formatting, urgency)
│   │   └── validation.ts       # Zod schemas for API input
│   └── middleware.ts           # Rate limiting + security headers
├── scripts/                    # Standalone CLI scripts
│   ├── batch.ts                # Thin CLI wrapper -> runBatchPipeline (cron)
│   ├── seed.ts                 # Seed demo data
│   ├── rss.ts                  # RSS feed testing
│   └── setup-git-hooks.sh      # Git hooks installer
├── tests/                      # All test files (flat structure)
│   ├── helpers/                # Test utilities
│   └── *.test.ts / *.test.tsx  # 39 test suites, 622 tests
├── db/                         # Database migrations (Drizzle Kit)
├── docs/                       # Project documentation
│   ├── deployment/             # Deployment guides
│   └── plans/                  # Feature planning docs
├── public/                     # Static assets
├── _bmad-output/                # BMAD planning/implementation artifacts
├── .github/
│   └── workflows/
│       └── security.yml        # CI: audit, lint, test
├── CLAUDE.md                   # AI assistant instructions
├── VALUES.md                   # Team principles
├── docker-compose.yml          # Production stack definition
├── Dockerfile                  # Multi-stage Next.js build
├── nginx.conf                  # Reverse proxy config
├── crontab                     # Cron schedule (6AM UTC batch)
├── drizzle.config.ts           # Drizzle Kit migration config
├── jest.config.ts              # Jest: node + jsdom projects
├── next.config.ts              # Next.js config (standalone output)
├── tsconfig.json               # TypeScript config
├── eslint.config.mjs           # ESLint flat config
├── postcss.config.mjs          # PostCSS for Tailwind
└── package.json                # Dependencies + scripts
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components (`page.tsx`), layouts (`layout.tsx`), route handlers (`route.ts`)
- Key files: `layout.tsx` (root shell), `page.tsx` (dashboard), `api/batch/route.ts` (thin wrapper to pipeline)

**`src/components/`:**
- Purpose: Reusable React UI components
- Contains: All 16 shared components, mix of client ("use client") and server components
- Key files: `TopicGrid.tsx` (main dashboard grid), `TickerBar.tsx` (scrolling ticker), `TopicCard.tsx` (card widget)

**`src/db/`:**
- Purpose: Database connection and schema definitions
- Contains: Drizzle ORM setup with PostgreSQL connection pool
- Key files: `schema.ts` (7 tables: topics, articles, score_history, topic_keywords, audit_logs, tracked_keywords, topic_views, score_feedback), `index.ts` (pool + drizzle instance)

**`src/lib/`:**
- Purpose: Shared business logic, utilities, and infrastructure
- Contains: Domain logic (scoring, batch pipeline), cross-cutting concerns (auth, rate limiting, validation, errors, audit)
- Key files: `batch-pipeline.ts` (783 lines, core pipeline logic), `scoring.ts` (score validation/aggregation), `types.ts` (domain interfaces)

**`scripts/`:**
- Purpose: Standalone CLI tools that run outside Next.js
- Contains: Batch pipeline script, seed script, RSS testing script
- Key files: `batch.ts` (thin CLI wrapper ~76 lines, creates own DB connection, delegates to `runBatchPipeline()`)

**`tests/`:**
- Purpose: All test files in a flat structure
- Contains: 39 test suites covering API routes, components, lib functions, scripts
- Key files: Named by convention `{feature}.test.ts` or `{Component}.test.tsx`

**`_bmad-output/`:**
- Purpose: BMAD framework planning and implementation artifacts
- Contains: Planning documents, research, implementation test specs
- Generated: Partially (by BMAD methodology)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout -- shell with TickerBar, ThemeProvider, Footer
- `src/app/page.tsx`: Dashboard homepage (server component, queries DB directly)
- `src/app/topic/[slug]/page.tsx`: Topic detail page (client component)
- `src/middleware.ts`: Request interceptor for rate limiting and security headers
- `scripts/batch.ts`: Standalone batch pipeline entry point

**Configuration:**
- `next.config.ts`: Next.js config (standalone output mode)
- `drizzle.config.ts`: Drizzle Kit config for schema push/migrations
- `jest.config.ts`: Two Jest projects (node + jsdom)
- `tsconfig.json`: TypeScript config with `@/` path alias
- `eslint.config.mjs`: ESLint flat config
- `docker-compose.yml`: Production stack (app + postgres + nginx + cron)

**Core Logic:**
- `src/lib/batch-pipeline.ts`: News fetching, LLM classification, LLM scoring, merging/dedup
- `src/lib/scoring.ts`: Score validation, weighted aggregation, urgency derivation, anomaly detection
- `src/lib/utils.ts`: UI utilities (colors, formatting, headline computation)
- `src/db/schema.ts`: All database table definitions and relations

**Infrastructure:**
- `src/lib/auth.ts`: API key authentication (`requireAdminKey()`)
- `src/lib/rate-limit.ts`: In-memory rate limiter (3 tiers)
- `src/lib/validation.ts`: Zod schemas for write endpoints
- `src/lib/errors.ts`: Environment-aware error responses
- `src/lib/audit-log.ts`: GDPR-compliant audit trail

**Testing:**
- `tests/helpers/`: Shared test utilities
- `tests/batch-pipeline.test.ts`: Batch pipeline unit tests
- `tests/scoring.test.ts`: Scoring engine tests
- `tests/api-topics.test.ts`: Topics API route tests

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: PascalCase (`TopicCard.tsx`, `ScoreChart.tsx`)
- Lib modules: kebab-case (`batch-pipeline.ts`, `rate-limit.ts`)
- Tests: `{feature}.test.ts` or `{Component}.test.tsx`

**Directories:**
- API routes: lowercase, kebab-case (`audit-logs/`, `cron/batch/`)
- Dynamic segments: `[param]` (`[slug]/`, `[id]/`)
- Feature grouping: flat within `src/components/`, `src/lib/`

**Database:**
- Table names: snake_case plural (`score_history`, `topic_keywords`, `audit_logs`)
- Column names: snake_case (`current_score`, `published_at`, `ip_address`)
- Index names: `idx_{table}_{column}` (`idx_topics_urgency`, `idx_articles_topic`)

## Where to Add New Code

**New Page:**
- Create directory under `src/app/{page-name}/`
- Add `page.tsx` (and `layout.tsx` if needed)
- Use `"use client"` directive only if the page needs interactivity

**New API Endpoint:**
- Create `src/app/api/{endpoint-name}/route.ts`
- Follow pattern: auth check -> validation -> DB query -> audit log -> JSON response
- Add write endpoints: import `requireAdminKey` from `src/lib/auth.ts`, `validateRequest` from `src/lib/validation.ts`, `logSuccess`/`logFailure` from `src/lib/audit-log.ts`
- Read endpoints: add `Cache-Control` header

**New Component:**
- Add to `src/components/{ComponentName}.tsx` (PascalCase)
- Add `"use client"` if it uses hooks, event handlers, or browser APIs
- Use Tailwind classes with dark mode variants (`dark:bg-gray-900`)
- Add `data-testid` attributes for testing

**New Business Logic:**
- Add to `src/lib/{module-name}.ts` (kebab-case)
- Keep DB-free if possible (like `batch-pipeline.ts`) for testability
- Export pure functions; use getter functions for env var access (not module-level captures)

**New Database Table:**
- Add table definition to `src/db/schema.ts`
- Add relations if needed
- Run `npx drizzle-kit push` to apply
- Add TypeScript interface to `src/lib/types.ts` if used in API responses

**New Test:**
- Add to `tests/{feature}.test.ts` or `tests/{Component}.test.tsx`
- `.test.ts` files run in Node environment
- `.test.tsx` files run in jsdom environment
- Mock `@/db` for API route tests; mock `recharts` as simple divs for chart tests

**New Script:**
- Add to `scripts/{name}.ts`
- Create own DB connection (don't import from `src/db/index.ts`)
- Import `dotenv/config` at top for env var loading
- Add `if (require.main === module)` guard for testability

## Special Directories

**`_bmad-output/`:**
- Purpose: BMAD framework planning and implementation artifacts
- Generated: By BMAD methodology
- Committed: Yes

**`.planning/`:**
- Purpose: Codebase analysis documents for BMAD automation
- Generated: By codebase mapping agents
- Committed: Yes

**`db/`:**
- Purpose: Drizzle Kit migration files
- Generated: By `npx drizzle-kit generate`
- Committed: Yes

**`public/`:**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (by `next build`)
- Committed: No (in `.gitignore`)

---

*Structure analysis: 2026-03-08*
