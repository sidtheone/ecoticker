# EcoTicker — Complete System Deep-Dive

## What It Is

Environmental news impact tracker. Aggregates news via GNews API + RSS feeds, scores severity with LLM (OpenRouter), displays stock-ticker-style UI with sparklines and trend indicators.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **PostgreSQL 17** + **Drizzle ORM** (type-safe query builder, schema push)
- **Recharts** for sparklines and score charts
- **Zod** for input validation
- **Docker Compose** (app + nginx + cron + postgres)
- **Railway** deployment, **GitHub Actions** CI/CD

## Architecture Overview

```
[GNews API] ──┐
              ├── Batch Pipeline (2-pass LLM) ──► PostgreSQL ──► Next.js API Routes ──► React UI
[RSS Feeds] ──┘                                                                        │
                                                                                       ├── Dashboard (SSR)
[OpenRouter LLM] ◄── Classification + Scoring                                         └── Topic Detail (CSR)
```

## Scale

- 8 database tables
- 12 API routes, 18 handlers
- ~20 React components (4 unused)
- 45 test files, 685 tests, ~98.6% coverage
- 1,312-line batch pipeline
- 10 environment variables
- 4 Docker services

## Document Index

| File | Contents |
|---|---|
| [01-database-and-data-layer.md](01-database-and-data-layer.md) | 8 tables, schema details, types, validation, Drizzle config |
| [02-api-layer.md](02-api-layer.md) | 18 handlers, auth, rate limiting, middleware, error handling, audit logging |
| [03-batch-pipeline.md](03-batch-pipeline.md) | 2-pass LLM pipeline, GNews + RSS fetching, scoring, scripts |
| [04-ui-components-and-pages.md](04-ui-components-and-pages.md) | ~20 components, 4 pages, theme system, OG images, composition trees |
| [05-infrastructure.md](05-infrastructure.md) | Docker, nginx, CI/CD, env vars, configuration files |
| [06-test-suite.md](06-test-suite.md) | 685 tests, mock patterns, coverage analysis |
| [07-patterns-and-conventions.md](07-patterns-and-conventions.md) | Data, API, LLM, UI, testing, security patterns |

## Key Numbers

| Metric | Value |
|---|---|
| Topics (demo) | 10 |
| Articles per topic (demo) | 4 |
| Score range | 0-100 |
| Dimensions | 3 (eco 40%, health 35%, econ 25%) |
| Urgency levels | 4 (breaking/critical/moderate/informational) |
| Severity levels | 5 (SEVERE/SIGNIFICANT/MODERATE/MINIMAL/INSUFFICIENT_DATA) |
| Rate limits | 100/min read, 10/min write, 2/hr batch |
| Cache TTL | 5min (API), 1hr (OG images), 12hr (topic OG revalidate) |
| Cron | Twice daily (6AM/6PM UTC) |
| Cost | ~$0.50/mo (Mistral Small 3.2) |
