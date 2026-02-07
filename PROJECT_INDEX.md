# Project Index: EcoTicker

Generated: 2026-02-07

## Project Structure

```
ecoticker/
├── db/
│   ├── schema.sql          # 4 tables: topics, articles, score_history, topic_keywords
│   └── ecoticker.db        # SQLite database file
├── scripts/
│   ├── batch.ts            # Daily batch: NewsAPI → LLM classify → LLM score → DB
│   └── seed.ts             # Seeds 12 demo topics with articles + score history
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout (Geist fonts)
│   │   ├── page.tsx        # Home page (placeholder)
│   │   └── globals.css     # Tailwind globals
│   └── lib/
│       ├── db.ts           # SQLite connection singleton (better-sqlite3, WAL mode)
│       ├── types.ts        # Topic, Article, ScoreHistoryEntry, TickerItem, TopicDetail
│       └── utils.ts        # urgencyColor, changeColor, formatChange, scoreToUrgency
├── tests/
│   ├── db.test.ts          # 10 tests — schema, constraints, upserts
│   ├── batch.test.ts       # 7 tests — batch DB ops, JSON extraction
│   ├── seed.test.ts        # 1 test — end-to-end seed verification
│   └── utils.test.ts       # 14 tests — all utility functions
├── jest.config.ts
├── package.json
└── .env.local              # NEWSAPI_KEY, OPENROUTER_API_KEY, OPENROUTER_MODEL, DATABASE_PATH
```

## Entry Points

- **Dev server**: `npm run dev` → localhost:3000
- **Batch pipeline**: `npx tsx scripts/batch.ts`
- **Seed data**: `npx tsx scripts/seed.ts`
- **Tests**: `npx jest`

## Core Modules

| Module | Path | Purpose |
|--------|------|---------|
| DB singleton | `src/lib/db.ts` | SQLite connection with WAL, auto-schema init |
| Types | `src/lib/types.ts` | Topic, Article, ScoreHistoryEntry, TickerItem, TopicDetail, Urgency, Category |
| Utils | `src/lib/utils.ts` | Color mappings, change formatting, score→urgency conversion |
| Batch | `scripts/batch.ts` | 2-pass LLM pipeline: classify articles → score topics → store in DB |
| Seed | `scripts/seed.ts` | Generates 12 topics, 36 articles, 84 score history entries |

## Database Schema

| Table | Key Columns | Notes |
|-------|-------------|-------|
| topics | name, slug (UQ), category, region, current_score, previous_score, urgency, impact_summary, image_url | Upsert rotates previous_score |
| articles | topic_id (FK), title, url (UQ), source, summary, image_url | INSERT OR IGNORE for dedup |
| score_history | topic_id (FK), score, health_score, eco_score, econ_score, impact_summary, recorded_at | Daily sub-score snapshots |
| topic_keywords | topic_id (FK), keyword | Used by batch to match articles to existing topics |

## External APIs

| API | Purpose | Config |
|-----|---------|--------|
| NewsAPI | Fetch environmental news | `NEWSAPI_KEY`, keywords in `BATCH_KEYWORDS` |
| OpenRouter | LLM classify + score | `OPENROUTER_API_KEY`, model in `OPENROUTER_MODEL` |

## Dependencies

**Runtime**: next 16, react 19, better-sqlite3, recharts, slugify
**Dev**: typescript, jest, ts-jest, tailwindcss, tsx, eslint

## Test Coverage

- 32 tests across 4 files, all passing
- DB schema + constraints + upsert logic
- Batch pipeline DB operations + JSON extraction
- Seed script end-to-end
- All utility functions

## Build Status

- **Phase 1**: Complete (scaffold, DB, batch pipeline, seed, tests)
- **Phase 2**: Pending (API routes, TickerBar, TopicCards, Dashboard)
- **Phase 3**: Pending (sparklines, filters, movers, detail page)
- **Phase 4**: Pending (PM2, Nginx, cron, README)
