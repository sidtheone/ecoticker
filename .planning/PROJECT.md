# EcoTicker — Stabilization & Remaining Epics

## What This Is

EcoTicker is an environmental news impact tracker that aggregates news via RSS feeds and GNews API, scores severity with AI models across three dimensions (ecological, health, economic), and displays results in a stock-ticker style dashboard with sparklines, urgency badges, and trend indicators. Built with Next.js 16, PostgreSQL 17, Drizzle ORM, deployed on Railway.

## Core Value

The daily batch pipeline must run reliably in production — fetching news from RSS and GNews, scoring topics via LLM, and updating the dashboard — without manual intervention.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Epics 1-4, 7, 8 complete. -->

- ✓ Severity scoring with 3-dimension rubric (ecological, health, economic) — Epic 1
- ✓ Dashboard with ticker bar, topic grid, sparklines, biggest movers — Epic 2
- ✓ Sub-score breakdown, category filter, scoring methodology page, GDPR data policy — Epic 2
- ✓ Dynamic insight headline, social sharing with OG meta, article count indicator — Epic 3
- ✓ RSS feed pipeline (10 curated environmental sources) — Epic 4
- ✓ GNews API integration (replaced NewsAPI) — Epic 4 / Emergency
- ✓ Source attribution badges, feed health logging — Epic 4
- ✓ Scoring and classification pipeline alignment — Epic 4
- ✓ Severity gauge, dashboard hero section, stale warning, editorial topic detail layout — Epic 7
- ✓ Batch pipeline module extraction, schema fix, test rename — Epic 8
- ✓ Dashboard restyle (Direction 8 — hybrid best-of) — Restyle sprint
- ✓ 604 tests across 37 suites (98.6% statement coverage)

### Active

<!-- Current scope: stabilization first, then Epics 5, 6, and backlog item. -->

- [ ] Fix production batch pipeline on Railway (cron endpoint auth bypass, pipelines returning 401)
- [ ] Resolve cron-to-batch auth flow (constructed NextRequest missing X-API-Key header)
- [ ] Verify RSS feed fetching works end-to-end in production
- [ ] Verify GNews API fetching works end-to-end in production
- [ ] Patch npm audit vulnerabilities (minimatch, ajv — dev deps)
- [ ] Verify full build + type check + test suite passes cleanly
- [ ] Epic 5: Admin & Measurement (keyword management, topic deactivation, analytics, batch health dashboard)
- [ ] Epic 6: Growth & Feedback Loop (embed widget, dynamic social cards, per-dimension feedback)
- [ ] Backlog: Dynamic category type

### Out of Scope

- Phase 3 Vision features (API access, white-label, user accounts, batch failure alerting) — future milestone
- Database migration system — `drizzle-kit push` is sufficient for solo dev
- Redis-backed rate limiting — single Railway instance, acceptable for current scale
- Load/stress testing — personal project, low traffic

## Context

Epics 1-4, 7, 8 shipped a massive amount of code. The RSS pipeline and GNews integration were built in Epic 4, but the production deployment on Railway has broken batch processing. The codebase map (`.planning/codebase/CONCERNS.md`) identifies the root cause: the cron endpoint at `src/app/api/cron/batch/route.ts` constructs a `NextRequest` to call `batchPOST()` internally, but the constructed request has no `X-API-Key` header — so `requireAdminKey()` returns 401.

Additional concerns from codebase analysis:
- Duplicated batch orchestration between `src/app/api/batch/route.ts` and `scripts/batch.ts`
- No retry logic for LLM calls (transient OpenRouter failures drop to default scores)
- Sequential article inserts (individual INSERT per article instead of batch)
- Timing-unsafe API key comparison (`===` instead of `crypto.timingSafeEqual()`)

2 Dependabot high-severity vulnerabilities pending on GitHub (minimatch ReDoS, ajv ReDoS — both dev deps).

## Constraints

- **Solo developer**: All work is Size S stories, no parallel workstreams needed
- **Railway deployment**: Single instance, 5-minute request timeout, auto-injected DATABASE_URL
- **Budget**: GNews Essential tier (~€40/month), free-tier LLM via OpenRouter
- **Existing test baseline**: 604 tests must remain green; new fixes get tests in the same commit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix cron auth before new features | Production pipeline is broken; nothing else matters until batch runs reliably | — Pending |
| Stabilization → Epic 5 → Epic 6 → Backlog | Fix what's broken, then build admin tools, then growth features | — Pending |
| Keep drizzle-kit push (no migrations) | Solo dev, fresh launch, rollback not critical yet | ✓ Good |
| RSS-primary, GNews-supplementary | Product survives without GNews; RSS is free and reliable | ✓ Good |

---
*Last updated: 2026-03-08 after initialization*
