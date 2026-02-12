# EcoTicker v2 — PostgreSQL + Drizzle ORM Design

**Date:** 2026-02-12
**Status:** DRAFT — awaiting review
**Scope:** Replace SQLite (better-sqlite3) + raw SQL with PostgreSQL + Drizzle ORM
**Approach:** Fresh schema push (no migrations), ORM-first data access
**Companion to:** `2026-02-12-user-stories-v2.md` (this design is a prerequisite amendment)

---

## Why This Change

### SQLite limitations that will bite us in v2

1. **Concurrency:** SQLite uses file-level locking. The batch pipeline (cron container) and the app (web container) share a single `.db` file via a Docker volume. WAL mode helps, but concurrent writes from batch + user feedback (US-10.1) + keyword management (US-4.1) + view tracking (US-8.1) will cause `SQLITE_BUSY` errors under load.

2. **Backup fragility:** US-9.1 proposes `better-sqlite3`'s `.backup()` API. This is SQLite-specific. PostgreSQL offers `pg_dump`, point-in-time recovery, and managed backups (Railway, Supabase, Neon all include this). US-9.1 becomes trivial or unnecessary.

3. **No native JSON operators:** The scoring pipeline (US-1.1) stores `raw_llm_response TEXT`. With PostgreSQL, this becomes `JSONB` — queryable, indexable. Debugging bad LLM outputs becomes a SQL query, not a script.

4. **Deployment friction:** The Docker setup shares a named volume between `app` and `cron` containers for the SQLite file. PostgreSQL eliminates this — both containers connect to the same database server over TCP.

### Why Drizzle (not Prisma, not Kysely)

| Factor | Drizzle | Prisma | Kysely |
|--------|---------|--------|--------|
| **SQL proximity** | SQL-like API (`eq`, `and`, `desc`) | Abstracted (`where: { slug: "x" }`) | SQL-like but no schema layer |
| **Schema definition** | TypeScript (co-located with code) | `.prisma` DSL (separate file) | No schema — types only |
| **Migration strategy** | `drizzle-kit push` for fresh DBs | `prisma migrate` or `prisma db push` | Manual |
| **Bundle size** | ~50KB | ~2MB+ (generated client) | ~30KB |
| **Type inference** | Inferred from schema | Generated client | Manual generics |
| **INSERT...ON CONFLICT** | `onConflictDoUpdate()` native | `upsert()` abstraction | `.onConflict()` |
| **Raw SQL escape hatch** | `sql` tagged template | `$queryRaw` | `.raw()` |

**Decision:** Drizzle's SQL-like API maps most naturally to the 60+ raw SQL queries already in the codebase. The migration is conceptually 1:1.

---

## What Changes

### New Dependencies

```
# Add (production)
drizzle-orm           # ORM core
pg                    # PostgreSQL driver (node-postgres)
@types/pg             # TypeScript types for pg
dotenv                # Load .env for drizzle-kit CLI

# Add (dev only)
drizzle-kit           # CLI for schema push/introspection

# Remove
better-sqlite3        # SQLite driver
@types/better-sqlite3 # SQLite types
```

### Production hosting

**Railway PostgreSQL** — added as a plugin to the Railway project. Provides:
- Managed PostgreSQL 17 instance
- `DATABASE_URL` auto-injected into environment (no manual config)
- Automatic daily backups with point-in-time recovery
- Connection pooling via PgBouncer (available as addon)
- Monitoring dashboard with query stats

Railway CLI setup:
```bash
railway link          # Link local project to Railway
railway add postgres  # Add PostgreSQL plugin
railway run npx drizzle-kit push  # Push schema to Railway PG
```

### New Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle schema definitions (all 5+ tables) |
| `src/db/index.ts` | Database connection singleton (replaces `src/lib/db.ts`) |
| `src/db/queries.ts` | Reusable query fragments (optional, for complex joins) |
| `drizzle.config.ts` | Drizzle Kit configuration (schema path, DB URL, dialect) |

### Removed Files

| File | Reason |
|------|--------|
| `db/schema.sql` | Replaced by `src/db/schema.ts` (Drizzle IS the schema) |
| `src/lib/db.ts` | Replaced by `src/db/index.ts` |

### Modified Files (19 files)

Every file that currently imports `getDb()` and runs raw SQL:

| File | Change Summary |
|------|----------------|
| `src/app/api/topics/route.ts` | Replace `.prepare().all()` with `db.select()...` |
| `src/app/api/topics/[slug]/route.ts` | Replace 3 queries with Drizzle selects |
| `src/app/api/ticker/route.ts` | Simple select + orderBy + limit |
| `src/app/api/movers/route.ts` | Select with computed column + abs() |
| `src/app/api/articles/route.ts` | CRUD → Drizzle insert/select/delete |
| `src/app/api/articles/[id]/route.ts` | Single-row CRUD → Drizzle |
| `src/app/api/batch/route.ts` | Upserts + inserts → Drizzle `onConflictDoUpdate` |
| `src/app/api/seed/route.ts` | Bulk inserts → Drizzle batch inserts |
| `src/app/api/cleanup/route.ts` | Conditional deletes → Drizzle `inArray` |
| `src/app/api/audit-logs/route.ts` | Delegates to audit-log.ts (indirect) |
| `src/app/api/cron/batch/route.ts` | Uses batch.ts pipeline (indirect) |
| `src/lib/audit-log.ts` | 6 queries → Drizzle select/insert/count |
| `src/middleware.ts` | Rate limiter — no SQL, but imports may shift |
| `scripts/batch.ts` | Pipeline: 8 queries → Drizzle |
| `scripts/seed.ts` | Seed: 6 queries → Drizzle |
| `tests/db.test.ts` | Schema/constraint tests → test against PG |
| `tests/batch.test.ts` | Mock DB calls → mock Drizzle |
| `tests/seed.test.ts` | Same |
| `tests/api-*.test.ts` (4 files) | DB mocking pattern changes |

---

## Schema Design (`src/db/schema.ts`)

The Drizzle schema replaces `db/schema.sql`. This includes both the **current v1 columns** and the **new US-1.1 columns** (since we're doing a fresh push anyway).

```typescript
import { pgTable, serial, text, integer, timestamp, date, boolean, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

// ─── Topics ────────────────────────────────────────────
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").default("climate"),
  region: text("region"),
  currentScore: integer("current_score").default(0),
  previousScore: integer("previous_score").default(0),
  urgency: text("urgency").default("informational"),
  impactSummary: text("impact_summary"),
  imageUrl: text("image_url"),
  articleCount: integer("article_count").default(0),
  // US-1.1: sub-scores on the topic for quick access
  healthScore: integer("health_score").default(0),
  ecoScore: integer("eco_score").default(0),
  econScore: integer("econ_score").default(0),
  scoreReasoning: text("score_reasoning"),
  // US-4.2: soft-hide from dashboard
  hidden: boolean("hidden").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_topics_urgency").on(table.urgency),
  index("idx_topics_category").on(table.category),
]);

// ─── Articles ──────────────────────────────────────────
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  source: text("source"),
  summary: text("summary"),
  imageUrl: text("image_url"),
  // US-5.2: source attribution
  sourceType: text("source_type").default("newsapi"),
  publishedAt: timestamp("published_at"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
}, (table) => [
  index("idx_articles_topic").on(table.topicId),
]);

// ─── Score History ─────────────────────────────────────
export const scoreHistory = pgTable("score_history", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id),
  score: integer("score").notNull(),
  healthScore: integer("health_score"),
  ecoScore: integer("eco_score"),
  econScore: integer("econ_score"),
  impactSummary: text("impact_summary"),
  // US-1.1: levels, reasoning, raw response, anomaly
  healthLevel: text("health_level"),
  ecoLevel: text("eco_level"),
  econLevel: text("econ_level"),
  healthReasoning: text("health_reasoning"),
  ecoReasoning: text("eco_reasoning"),
  econReasoning: text("econ_reasoning"),
  overallSummary: text("overall_summary"),
  rawLlmResponse: jsonb("raw_llm_response"),
  anomalyDetected: boolean("anomaly_detected").default(false),
  recordedAt: date("recorded_at").defaultNow(),
}, (table) => [
  index("idx_score_history_topic").on(table.topicId),
  index("idx_score_history_date").on(table.recordedAt),
]);

// ─── Topic Keywords ────────────────────────────────────
export const topicKeywords = pgTable("topic_keywords", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id),
  keyword: text("keyword").notNull(),
}, (table) => [
  index("idx_topic_keywords_topic").on(table.topicId),
]);

// ─── Audit Logs ────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: text("ip_address"),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  action: text("action").notNull(),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  details: text("details"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_timestamp").on(table.timestamp),
  index("idx_audit_logs_action").on(table.action),
]);

// ─── Tracked Keywords (US-4.1) ─────────────────────────
export const trackedKeywords = pgTable("tracked_keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  active: boolean("active").default(true),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  lastSearchedAt: timestamp("last_searched_at"),
  resultCount: integer("result_count").default(0),
});

// ─── Topic Views (US-8.1) ─────────────────────────────
export const topicViews = pgTable("topic_views", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id),
  date: date("date").notNull(),
  viewCount: integer("view_count").default(0),
}, (table) => [
  uniqueIndex("idx_topic_views_unique").on(table.topicId, table.date),
]);

// ─── Score Feedback (US-10.1) ──────────────────────────
export const scoreFeedback = pgTable("score_feedback", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id),
  scoreHistoryId: integer("score_history_id").references(() => scoreHistory.id),
  dimension: text("dimension").notNull(),
  direction: text("direction").notNull(),
  comment: text("comment"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Drizzle Relations (`src/db/schema.ts` — appended after table definitions)

```typescript
import { relations } from "drizzle-orm";

export const topicsRelations = relations(topics, ({ many }) => ({
  articles: many(articles),
  scoreHistory: many(scoreHistory),
  keywords: many(topicKeywords),
  views: many(topicViews),
  feedback: many(scoreFeedback),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  topic: one(topics, {
    fields: [articles.topicId],
    references: [topics.id],
  }),
}));

export const scoreHistoryRelations = relations(scoreHistory, ({ one }) => ({
  topic: one(topics, {
    fields: [scoreHistory.topicId],
    references: [topics.id],
  }),
}));

export const topicKeywordsRelations = relations(topicKeywords, ({ one }) => ({
  topic: one(topics, {
    fields: [topicKeywords.topicId],
    references: [topics.id],
  }),
}));

export const scoreFeedbackRelations = relations(scoreFeedback, ({ one }) => ({
  topic: one(topics, {
    fields: [scoreFeedback.topicId],
    references: [topics.id],
  }),
  scoreHistoryEntry: one(scoreHistory, {
    fields: [scoreFeedback.scoreHistoryId],
    references: [scoreHistory.id],
  }),
}));

export const topicViewsRelations = relations(topicViews, ({ one }) => ({
  topic: one(topics, {
    fields: [topicViews.topicId],
    references: [topics.id],
  }),
}));
```

**What relations unlock:** The Drizzle relational query API. Instead of manual JOINs:

```typescript
// Without relations (manual join):
const result = await db
  .select()
  .from(topics)
  .leftJoin(articles, eq(articles.topicId, topics.id))
  .where(eq(topics.slug, slug));

// With relations (type-safe, nested):
const result = await db.query.topics.findFirst({
  where: eq(topics.slug, slug),
  with: {
    articles: { orderBy: [desc(articles.publishedAt)] },
    scoreHistory: { orderBy: [asc(scoreHistory.recordedAt)] },
  },
});
// result.articles is Article[], result.scoreHistory is ScoreHistoryEntry[]
```

This is particularly valuable for the **topic detail page** (`GET /api/topics/[slug]`) which currently runs 3 separate queries. With relations, it's a single type-safe call.

### Key schema decisions

1. **`raw_llm_response` is `JSONB`**, not `TEXT`. PostgreSQL can query inside it: `WHERE raw_llm_response->>'model' = 'llama-3.1'`.

2. **`anomaly_detected` is `BOOLEAN`**, not `INTEGER`. PostgreSQL has a native boolean type.

3. **`hidden` is `BOOLEAN`**, not `INTEGER`. Same reason.

4. **Future tables included.** `tracked_keywords`, `topic_views`, `score_feedback` are defined now so `drizzle-kit push` creates them all at once. Stories that need them will find the tables ready.

5. **`serial` instead of `AUTOINCREMENT`**. PostgreSQL's `SERIAL` is the standard auto-incrementing integer.

6. **`timestamp` instead of `DATETIME`**. PostgreSQL's native timestamp type with timezone awareness.

---

## Database Connection (`src/db/index.ts`)

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,              // connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

// For scripts that need to close the pool on exit
export { pool };
```

### Environment variable change

```env
# OLD
DATABASE_PATH=/data/ecoticker.db

# NEW
DATABASE_URL=postgresql://user:password@localhost:5432/ecoticker
```

For local dev: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecoticker`

---

## Drizzle Kit Config (`drizzle.config.ts`)

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",           // generated SQL snapshots (gitignored)
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Schema push (replaces `db.exec(schema)`)

```bash
npx drizzle-kit push    # Push schema to database (no migration files)
```

This is the "no migration" approach: Drizzle Kit compares your TypeScript schema to the live database and applies the diff directly. Safe for fresh launches and development. For production schema changes later, switch to `drizzle-kit generate` + `drizzle-kit migrate`.

---

## Query Translation Examples

### Before (SQLite + raw SQL)

```typescript
// src/app/api/ticker/route.ts
import { getDb } from "@/lib/db";
const db = getDb();
const items = db.prepare(`
  SELECT name, slug, current_score as score,
    (current_score - previous_score) as change
  FROM topics
  ORDER BY current_score DESC
  LIMIT 15
`).all();
```

### After (Drizzle + PostgreSQL)

```typescript
// src/app/api/ticker/route.ts
import { db } from "@/db";
import { topics } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

const items = await db
  .select({
    name: topics.name,
    slug: topics.slug,
    score: topics.currentScore,
    change: sql<number>`${topics.currentScore} - ${topics.previousScore}`,
  })
  .from(topics)
  .orderBy(desc(topics.currentScore))
  .limit(15);
```

### Upsert (batch pipeline — most complex pattern)

```typescript
// Before: INSERT INTO topics (...) ON CONFLICT(slug) DO UPDATE SET ...
// After:
await db.insert(topics)
  .values({
    name: topicName,
    slug,
    category: scoreResult.category,
    region: scoreResult.region,
    currentScore: scoreResult.score,
    urgency: scoreResult.urgency,
    impactSummary: scoreResult.impactSummary,
    imageUrl,
    articleCount: topicArticles.length,
  })
  .onConflictDoUpdate({
    target: topics.slug,
    set: {
      previousScore: sql`${topics.currentScore}`,
      currentScore: sql`excluded.current_score`,
      urgency: sql`excluded.urgency`,
      impactSummary: sql`excluded.impact_summary`,
      imageUrl: sql`COALESCE(excluded.image_url, ${topics.imageUrl})`,
      category: sql`excluded.category`,
      region: sql`excluded.region`,
      articleCount: sql`${topics.articleCount} + excluded.article_count`,
      updatedAt: sql`NOW()`,
    },
  });
```

### Insert-if-not-exists (articles dedup)

```typescript
// Before: INSERT OR IGNORE INTO articles ...
// After (PostgreSQL equivalent):
await db.insert(articles)
  .values({ topicId, title, url, source, summary, imageUrl, publishedAt })
  .onConflictDoNothing({ target: articles.url });
```

### Complex join with subquery (topics list with sparklines)

```typescript
// This is the most complex query — the topics list with GROUP_CONCAT sparklines
// Drizzle handles it with sql`` for the PostgreSQL equivalent of GROUP_CONCAT
import { eq, desc, sql } from "drizzle-orm";

const topicsList = await db
  .select({
    id: topics.id,
    name: topics.name,
    slug: topics.slug,
    category: topics.category,
    region: topics.region,
    currentScore: topics.currentScore,
    previousScore: topics.previousScore,
    change: sql<number>`${topics.currentScore} - ${topics.previousScore}`,
    urgency: topics.urgency,
    impactSummary: topics.impactSummary,
    imageUrl: topics.imageUrl,
    articleCount: topics.articleCount,
    updatedAt: topics.updatedAt,
    sparklineScores: sql<string>`(
      SELECT STRING_AGG(CAST(sh.score AS TEXT), ',' ORDER BY sh.recorded_at ASC)
      FROM score_history sh WHERE sh.topic_id = ${topics.id}
    )`,
  })
  .from(topics)
  .orderBy(desc(topics.currentScore));
```

**Note:** `GROUP_CONCAT` (SQLite) becomes `STRING_AGG` (PostgreSQL). This is the only SQL dialect difference that affects query logic.

---

## Docker Compose Changes

```yaml
services:
  # NEW: PostgreSQL service
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ecoticker
      POSTGRES_USER: ecoticker
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-ecoticker_dev}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"     # Expose for local dev tools
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ecoticker"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://ecoticker:${POSTGRES_PASSWORD:-ecoticker_dev}@postgres:5432/ecoticker
    expose:
      - "3000"
    mem_limit: 1g
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app

  cron:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://ecoticker:${POSTGRES_PASSWORD:-ecoticker_dev}@postgres:5432/ecoticker
    entrypoint: ["crond", "-f", "-l", "2"]
    user: root
    mem_limit: 512m
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:       # Replaces ecoticker-data (no shared SQLite file)
```

### What's removed
- `ecoticker-data` named volume (was shared between app + cron for SQLite file)
- `DATABASE_PATH` env var
- Volume mounts for `/data` on app and cron containers

### What's added
- `postgres` service with healthcheck
- `pgdata` volume for PostgreSQL data persistence
- `DATABASE_URL` env var on app and cron
- `depends_on` with `condition: service_healthy` so app waits for PG

---

## Dockerfile Changes

```dockerfile
# Stage 3: Production image — REMOVE these lines:
# COPY --from=deps /app/node_modules/better-sqlite3 ...
# COPY --from=deps /app/node_modules/bindings ...
# COPY --from=deps /app/node_modules/file-uri-to-path ...

# ADD these (pg is pure JS, no native bindings):
# pg is included in node_modules via npm ci — no special COPY needed

# REMOVE:
# ENV DATABASE_PATH=/data/ecoticker.db
# RUN mkdir -p /data && chown nextjs:nodejs /data

# ADD:
# ENV DATABASE_URL=postgresql://...  (set at runtime via docker-compose)
```

The Dockerfile gets **simpler** because `pg` is pure JavaScript — no native bindings to copy between stages (unlike `better-sqlite3` which required copying the native `.node` binary).

---

## Testing Strategy

### Local dev testing

For development, use a local PostgreSQL instance:

```bash
# Start PG locally (or use Docker)
docker run -d --name ecoticker-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17-alpine

# Set env
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecoticker

# Push schema
npx drizzle-kit push

# Seed
npx tsx scripts/seed.ts
```

### Test database strategy: Mock the `db` module

**Decision:** Tests mock `@/db` entirely. No real database in CI or in `npm test`.

This matches the current pattern where API tests already mock `getDb()` — we're replacing that with a Drizzle-aware mock.

```typescript
// tests/helpers/mock-db.ts
import { vi } from 'vitest'; // or jest.fn()

// Mock the db module
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    query: {
      topics: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      articles: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      scoreHistory: {
        findMany: vi.fn(),
      },
    },
    // Chainable methods
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
  },
}));
```

**Per-test setup:**

```typescript
// tests/api-topics.test.ts
import { db } from '@/db';

beforeEach(() => {
  vi.clearAllMocks();
});

test('GET /api/topics returns topics sorted by score', async () => {
  // Arrange: mock query result
  (db.query.topics.findMany as jest.Mock).mockResolvedValue([
    { id: 1, name: 'Arctic Ice', slug: 'arctic-ice', currentScore: 85, ... },
    { id: 2, name: 'Delhi Air', slug: 'delhi-air', currentScore: 91, ... },
  ]);

  // Act
  const response = await GET(request);
  const data = await response.json();

  // Assert
  expect(data.topics).toHaveLength(2);
  expect(data.topics[0].currentScore).toBe(91);
});
```

**Why mock over PGlite:**
- CI stays fast and dependency-free (no WASM binary to download)
- Tests focus on route logic (HTTP handling, response shaping, error cases), not SQL correctness
- SQL correctness is verified locally during development with a real PostgreSQL instance

**Local integration tests (optional, not CI):**
For developers who want to verify actual queries against PostgreSQL:

```bash
# Run with real DB (local dev only)
DATABASE_URL=postgresql://localhost:5432/ecoticker_test npx jest --testPathPattern=integration
```

PGlite can be used for these local integration tests if preferred over a Docker PostgreSQL.

### Test file changes

| Current pattern | New pattern |
|----------------|-------------|
| `new Database(":memory:")` | Mock `@/db` module |
| `db.exec(schemaSQL)` | Not needed (mocked) |
| `db.prepare(sql).all()` | `db.query.*.findMany()` (mocked) |
| Mock `getDb()` | Mock `db` from `@/db` |
| Synchronous queries | `async/await` queries |
| Test verifies SQL correctness | Test verifies route logic + response shaping |

**Important:** All `better-sqlite3` queries are **synchronous**. All Drizzle/pg queries are **asynchronous**. Every API route handler and test that calls the DB must use `await`. The current API routes already use `async` handlers, so adding `await` is straightforward.

---

## Impact on User Stories

### US-1.1 (Scoring Architecture) — UPDATED

The US-1.1 spec says "direct edit `db/schema.sql`." This changes to:

- **Schema:** Edit `src/db/schema.ts` (already shown above — US-1.1 columns are included)
- **Batch pipeline:** `scripts/batch.ts` uses Drizzle queries instead of raw SQL
- **No `INSERT OR IGNORE`:** Use `.onConflictDoNothing()` (PostgreSQL equivalent)
- **No `CURRENT_TIMESTAMP`:** Use `.defaultNow()` in schema or `sql`NOW()\`\` in queries
- **No `date('now')`:** Use `sql`CURRENT_DATE\`\` or JavaScript `new Date()`

### US-4.1 (Tracked Keywords) — UPDATED

Table definition moves from inline SQL to `src/db/schema.ts` (already included above as `trackedKeywords`).

### US-8.1 (Topic Views) — UPDATED

Table definition moves to schema. Upsert uses:
```typescript
await db.insert(topicViews)
  .values({ topicId, date: today, viewCount: 1 })
  .onConflictDoUpdate({
    target: [topicViews.topicId, topicViews.date],
    set: { viewCount: sql`${topicViews.viewCount} + 1` },
  });
```

### US-9.1 (Database Backup) — ELIMINATED

- **Old:** Custom `scripts/backup.ts` using `better-sqlite3`'s `.backup()` API
- **New:** Railway PostgreSQL includes automatic daily backups with point-in-time recovery
- **US-9.1 can be removed from the backlog** — it's a platform feature, not an application feature
- If self-hosting later: `pg_dump $DATABASE_URL > /backups/ecoticker-$(date +%F).sql`

### US-10.1 (Score Feedback) — UPDATED

Table definition moves to schema (already included above as `scoreFeedback`).

---

## SQLite → PostgreSQL Dialect Differences

These are the specific SQL constructs that must change:

| SQLite | PostgreSQL | Where used |
|--------|-----------|------------|
| `AUTOINCREMENT` | `SERIAL` | All tables (handled by Drizzle) |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMP DEFAULT NOW()` | topics, articles, audit_logs |
| `DATE DEFAULT (date('now'))` | `DATE DEFAULT CURRENT_DATE` | score_history.recorded_at |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | articles dedup |
| `GROUP_CONCAT(col)` | `STRING_AGG(col::TEXT, ',')` | Topics sparkline query |
| `datetime('now', '-30 days')` | `NOW() - INTERVAL '30 days'` | audit_log.ts stats |
| `INTEGER` for booleans | `BOOLEAN` | anomaly_detected, success, hidden, active |
| `TEXT` for JSON | `JSONB` | raw_llm_response |
| `pragma("journal_mode = WAL")` | Not needed (MVCC built-in) | db.ts |
| `pragma("foreign_keys = ON")` | On by default | db.ts |

---

## Implementation Order

This is a **Phase 0** story — it must happen BEFORE US-1.1. The scoring architecture changes are interleaved with the ORM migration.

### Step 1: Infrastructure (new files, deps)
1. `npm install drizzle-orm pg @types/pg dotenv`
2. `npm install -D drizzle-kit`
3. `npm uninstall better-sqlite3 @types/better-sqlite3`
4. Create `src/db/schema.ts` (full schema with US-1.1 columns)
5. Create `src/db/index.ts` (connection singleton)
6. Create `drizzle.config.ts`
7. Update `.env.example` (`DATABASE_URL` replaces `DATABASE_PATH`)
8. Update `tsconfig.json` path alias: `@/db` → `src/db`

### Step 2: Core data access (lib files)
1. Rewrite `src/lib/audit-log.ts` — 6 queries → Drizzle
2. Delete `src/lib/db.ts`
3. Update `src/lib/types.ts` — Row types may be replaced by Drizzle's `InferSelectModel`

### Step 3: API routes (10 files)
Convert each route file from raw SQL to Drizzle, in order of complexity:
1. `ticker/route.ts` — simplest (1 query)
2. `movers/route.ts` — simple (1 query with computed column)
3. `topics/[slug]/route.ts` — 3 queries
4. `topics/route.ts` — complex (sparkline subquery + delete cascade)
5. `articles/[id]/route.ts` — CRUD
6. `articles/route.ts` — CRUD with dynamic filters
7. `audit-logs/route.ts` — delegates to audit-log.ts (already done)
8. `seed/route.ts` — bulk operations
9. `cleanup/route.ts` — conditional cascading deletes
10. `batch/route.ts` — full pipeline (most complex)

### Step 4: Scripts
1. `scripts/seed.ts` — bulk inserts
2. `scripts/batch.ts` — full pipeline

### Step 5: Tests (7+ files)
1. Create `tests/helpers/mock-db.ts` with Drizzle mock setup
2. Update `tests/db.test.ts`
3. Update `tests/batch.test.ts`
4. Update `tests/seed.test.ts`
5. Update `tests/api-topics.test.ts`
6. Update `tests/api-topic-detail.test.ts`
7. Update `tests/api-ticker.test.ts`
8. Update `tests/api-movers.test.ts`

### Step 6: Docker
1. Update `docker-compose.yml` (add postgres service, remove SQLite volume)
2. Update `Dockerfile` (remove better-sqlite3 native deps)
3. Update `docker-entrypoint.sh` if needed
4. Update `crontab` if backup script changes

### Step 7: Documentation
1. Update `PROJECT_INDEX.md`
2. Update `CLAUDE.md`
3. Update `.env.example`
4. Update `deployment.md`

---

## Complexity Estimate

| Step | Files | Effort |
|------|-------|--------|
| Infrastructure | 5 new, 2 removed | S |
| Core data access | 3 modified | S |
| API routes | 10 modified | L (bulk of the work) |
| Scripts | 2 modified | M |
| Tests | 8+ modified, 1 new | L |
| Docker | 3 modified | S |
| Documentation | 4 modified | S |

**Overall: L** — comparable to US-1.1 itself. But since both changes touch the same files, they should be done **together** in one pass rather than sequentially (migrate to Drizzle+PG first with current schema, then add US-1.1 columns — or do both at once since it's a fresh push).

**Recommended approach:** Do Steps 1-2 first, then interleave Steps 3-4 with US-1.1's query changes. The US-1.1 queries get written in Drizzle from the start — never written in raw SQLite SQL only to be rewritten.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Mocked DB drifts from real schema | Tests pass but production breaks | Local integration tests with real PG; `drizzle-kit push` validates schema on deploy |
| Drizzle's `onConflictDoUpdate` syntax differs from SQLite's | Upserts in batch pipeline break | Already documented above — use `sql` template for `excluded.*` references |
| `async/await` everywhere (SQLite was sync) | Missed `await` causes silent bugs | TypeScript will flag most — Drizzle returns `Promise`, not raw values |
| Connection pool exhaustion in dev | Dev server hangs | Set `max: 10` with idle timeout; Next.js hot reload creates new connections — pool handles this |
| Railway PostgreSQL cold starts | First request slow after idle | Railway keeps PG warm on paid plans; acceptable for this project's traffic |

---

## Resolved Decisions

1. **Production PostgreSQL: Railway** — Railway's built-in PostgreSQL plugin. Provides managed backups, `DATABASE_URL` auto-injected into environment. US-9.1 (backup) becomes unnecessary — Railway handles daily backups with point-in-time recovery. Docker Compose PostgreSQL service is for **local dev only**.

2. **Type-safe Drizzle relations: YES** — Define explicit `relations()` for all foreign keys. Enables `db.query.topics.findMany({ with: { articles: true, scoreHistory: true } })` instead of manual joins. See Relations section below.

3. **CI testing: Mock the `db` module** — Tests mock `@/db` entirely (no real database in CI). API route tests mock Drizzle's query results. DB-level tests (schema constraints, upsert behavior) use PGlite locally but are skipped in CI. This keeps CI fast and dependency-free.

---

## Summary

| Before | After |
|--------|-------|
| SQLite (better-sqlite3) | PostgreSQL 17 |
| Raw SQL strings (60+ queries) | Drizzle ORM (type-safe) |
| `db/schema.sql` (raw DDL) | `src/db/schema.ts` (TypeScript) |
| `src/lib/db.ts` (singleton) | `src/db/index.ts` (connection pool) |
| Synchronous queries | Async queries (await) |
| `DATABASE_PATH` env var | `DATABASE_URL` env var |
| Shared Docker volume for SQLite | PostgreSQL service container |
| `better-sqlite3` native binary in Dockerfile | `pg` pure JS (simpler Dockerfile) |
| `GROUP_CONCAT` | `STRING_AGG` |
| `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` |
| Manual `.backup()` script | Railway managed backups (US-9.1 eliminated) |
| In-memory SQLite for tests | Mocked `@/db` module (no DB in CI) |
| 3 separate queries for topic detail | Single `db.query.topics.findFirst({ with: {...} })` |
