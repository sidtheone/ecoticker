# Code Patterns & Conventions

Reference for how things work in the codebase. Discoverable from code, documented here for quick lookup.

## Data

- camelCase JSON responses, snake_case DB columns
- Scores 0-100: breaking (80+), critical (60-79), moderate (30-59), informational (<30)
- `runBatchPipeline()` — one function, three modes (api/cron/cli), 2-pass LLM
- Article dedup: UNIQUE on url, ON CONFLICT DO NOTHING
- Topic upsert: `.onConflictDoUpdate()` rotates previous_score

## Testing

- Mock `next/link`, `recharts`, `global.fetch` in jsdom tests
- Mock `@/db` for API unit tests
- CI runs with mocked DB (no PostgreSQL dependency)

## Rate Limits

- 100/min read, 10/min write, 2/hour batch
