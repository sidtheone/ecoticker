# EcoTicker v2 — Phase 0 Implementation Workflow

**Date:** 2026-02-13
**Status:** DRAFT — awaiting review
**Scope:** Replace SQLite + raw SQL with PostgreSQL + Drizzle ORM, with complete v2 schema
**Branch:** `v2`
**Prerequisites:** All design documents approved
**Companion docs:**
- `2026-02-12-postgresql-drizzle-design.md` (architecture)
- `2026-02-12-user-stories-v2.md` (requirements)
- `2026-02-09-llm-scoring-research.md` (scoring spec)

---

## Pre-Implementation: Schema Requirements Audit

Before writing any code, every user story was audited for schema impact. This ensures the schema is built ONCE with all v2 requirements — no future alterations needed until post-v2.

### Schema Changes by User Story

| Story | Table | Change | Type |
|-------|-------|--------|------|
| US-1.1 | `topics` | +`health_score`, `eco_score`, `econ_score`, `score_reasoning` | New columns |
| US-1.1 | `score_history` | +`health_level`, `eco_level`, `econ_level`, `health_reasoning`, `eco_reasoning`, `econ_reasoning`, `overall_summary`, `raw_llm_response` (JSONB), `anomaly_detected` | New columns |
| US-4.2 | `topics` | +`hidden` (BOOLEAN) | New column |
| US-5.2 | `articles` | +`source_type` (TEXT) | New column |
| US-4.1 | — | NEW TABLE: `tracked_keywords` | New table |
| US-8.1 | — | NEW TABLE: `topic_views` | New table |
| US-10.1 | — | NEW TABLE: `score_feedback` | New table |
| US-9.1 | — | ELIMINATED (Railway managed backups) | Removed |
| GDPR | `audit_logs` | Remove `user_agent`, truncate `ip_address` | Column removed + modified |
| GDPR | `score_feedback` | Truncate `ip_address` | Column modified |
| US-11.1 | — | No schema change (static page) | New story |

### Stories with NO schema impact (UI/logic only)

US-1.2, US-1.3, US-1.4, US-1.5, US-2.1, US-2.2, US-3.1, US-4.3, US-5.1, US-6.1, US-6.2, US-6.3, US-8.2, US-10.2, US-11.1

### Final Table Count: 8 tables (was 5)

| Table | Columns | Status |
|-------|---------|--------|
| `topics` | 18 (was 12) | Upgraded |
| `articles` | 9 (was 8) | Upgraded |
| `score_history` | 16 (was 7) | Upgraded |
| `topic_keywords` | 3 | Unchanged |
| `audit_logs` | 9 (was 10 in v1) | GDPR: removed `user_agent`, `ip_address` truncated |
| `tracked_keywords` | 7 | **NEW** (US-4.1) |
| `topic_views` | 4 | **NEW** (US-8.1) |
| `score_feedback` | 7 | **NEW** (US-10.1) |

### Schema Design Decisions

1. **No ON DELETE CASCADE** — Foreign keys use RESTRICT (default). Matches current explicit-delete-order pattern in cleanup API. Safer — won't accidentally cascade-delete score history.

2. **No UNIQUE on (topic_id, recorded_at) in score_history** — Manual batch re-runs could create duplicate entries. Acceptable for now — dedup logic can be added later without schema change.

3. **JSONB for raw_llm_response** — Enables `WHERE raw_llm_response->>'model' = 'x'` queries for debugging model drift. Major upgrade from TEXT.

4. **BOOLEAN for flags** — `hidden`, `anomaly_detected`, `success`, `active` use PostgreSQL native BOOLEAN (replaces SQLite INTEGER 0/1).

5. **TIMESTAMP for dates** — All datetime columns use PostgreSQL `TIMESTAMP` with `defaultNow()`. `score_history.recorded_at` uses `DATE` (date-only, one score per day).

6. **SERIAL for auto-increment** — PostgreSQL's `SERIAL` replaces SQLite's `AUTOINCREMENT`.

7. **dotenv as devDependency** — Only needed for `drizzle-kit` CLI (runs outside Next.js). Next.js loads `.env` automatically.

8. **Missing index added** — `idx_score_feedback_topic` on `score_feedback.topic_id` (not in original design doc).

9. **GDPR: No raw IP addresses stored** — Launching in Europe requires GDPR compliance. IP addresses are PII under GDPR (CJEU ruling C-582/14). Three fields affected:
   - `audit_logs.ip_address` → **store truncated** (`192.168.1.0` — zero last octet for IPv4, zero last 80 bits for IPv6). Sufficient for geographic/abuse patterns, not reversible to individual.
   - `audit_logs.user_agent` → **removed entirely**. Not needed for any current feature. If needed later, store only parsed browser family (e.g., "Chrome 120") not the full UA string.
   - `score_feedback.ip_address` → **store truncated** (same truncation as audit_logs). Used only for rate-limit abuse detection, not individual identification.
   - In-memory rate limiter uses full IPs but never persists them — acceptable under GDPR (transient processing with legitimate interest basis).

10. **Audit log retention** — Add `90-day auto-purge` for audit_logs (GDPR data minimization principle). Implement as a cron job or batch pipeline step: `DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days'`.

---

## Phase 0A: Infrastructure Setup

**Goal:** Install dependencies, create new files, remove old files. Project compiles.

### Step 0A.1: Dependency Changes

```bash
# Add production dependencies
npm install drizzle-orm pg

# Add dev dependencies
npm install -D drizzle-kit @types/pg dotenv

# Remove SQLite dependencies
npm uninstall better-sqlite3 @types/better-sqlite3
```

**Validation:** `npm ls drizzle-orm pg drizzle-kit` — all installed.

### Step 0A.2: Create `drizzle.config.ts`

Root-level config for Drizzle Kit CLI.

```typescript
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Add `drizzle/` to `.gitignore` (generated SQL snapshots).

### Step 0A.3: Create `src/db/schema.ts`

**Full schema with all v2 tables and relations.**

Tables (8):
1. `topics` — 18 columns + 2 indexes (urgency, category)
2. `articles` — 9 columns + 1 index (topic_id)
3. `scoreHistory` — 16 columns + 2 indexes (topic_id, recorded_at)
4. `topicKeywords` — 3 columns + 1 index (topic_id)
5. `auditLogs` — 10 columns + 2 indexes (timestamp, action)
6. `trackedKeywords` — 7 columns (keyword has unique constraint)
7. `topicViews` — 4 columns + 1 unique index (topic_id, date)
8. `scoreFeedback` — 7 columns + 1 index (topic_id)

Relations (6):
- `topicsRelations` — has many: articles, scoreHistory, keywords, views, feedback
- `articlesRelations` — belongs to: topic
- `scoreHistoryRelations` — belongs to: topic
- `topicKeywordsRelations` — belongs to: topic
- `scoreFeedbackRelations` — belongs to: topic, scoreHistoryEntry
- `topicViewsRelations` — belongs to: topic

**Key columns from design doc, verified against all user stories.**

### Step 0A.4: Create `src/db/index.ts`

Database connection singleton with connection pool.

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });
export { pool };
```

### Step 0A.5: Update `.env.example`

```diff
- # Database path (inside Docker container)
- DATABASE_PATH=/data/ecoticker.db
+ # PostgreSQL connection (Railway auto-injects in production)
+ DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecoticker
```

### Step 0A.6: Verify Path Alias

The existing `tsconfig.json` has `"@/*": ["./src/*"]`, so `@/db` already resolves to `src/db`. **No change needed.**

### Checkpoint 0A

```bash
npx tsc --noEmit  # Must pass (schema + index compile)
```

**Exit criteria:** New files compile. Old files will have import errors (expected — fixed in 0B).

---

## Phase 0B: Core Migration

**Goal:** Replace all SQLite queries with Drizzle. All API routes, scripts, and lib files updated.

### Step 0B.1: Update `src/lib/types.ts`

Add new fields to existing interfaces:

**New type:**
```typescript
export type SeverityLevel = "MINIMAL" | "MODERATE" | "SIGNIFICANT" | "SEVERE" | "INSUFFICIENT_DATA";
```

**Topic interface gains:**
- `healthScore: number`
- `ecoScore: number`
- `econScore: number`
- `scoreReasoning: string | null`
- `hidden: boolean`

**ScoreHistoryEntry gains:**
- `healthLevel: string | null`
- `ecoLevel: string | null`
- `econLevel: string | null`
- `healthReasoning: string | null`
- `ecoReasoning: string | null`
- `econReasoning: string | null`
- `overallSummary: string | null`
- `anomalyDetected: boolean`

**Article interface gains:**
- `sourceType: string`

**Remove:** `TopicRow`, `ScoreHistoryRow`, `ArticleRow`, `MoverRow` — snake_case row types are replaced by Drizzle's type inference. Keep `Topic`, `Article`, `ScoreHistoryEntry`, `TickerItem`, `TopicDetail` as API response types (camelCase).

### Step 0B.2: Rewrite `src/lib/audit-log.ts`

6 queries → Drizzle:
- `logSuccess()` → `db.insert(auditLogs).values({...})`
- `logFailure()` → `db.insert(auditLogs).values({...})`
- `getAuditLogs()` → `db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit().offset()`
- `getAuditStats()` → `db.select({ count: count() }).from(auditLogs).where(...)`
- Date filtering: `NOW() - INTERVAL '30 days'` replaces `datetime('now', '-30 days')`

All functions become `async`.

### Step 0B.3: Delete `src/lib/db.ts`

Remove the SQLite singleton. All imports change: `import { getDb } from "@/lib/db"` → `import { db } from "@/db"`.

### Step 0B.4: API Routes (10 files, ordered by complexity)

Each file follows the same pattern:
1. Replace `import { getDb } from "@/lib/db"` → `import { db } from "@/db"` + schema imports
2. Replace `const db = getDb()` → remove (db is module-level)
3. Replace `db.prepare(sql).all()` → `await db.select().from(table)...`
4. Add `await` to all DB calls (sync → async)
5. Remove manual row-to-camelCase mapping where Drizzle handles it

**Order:**

#### 1. `src/app/api/ticker/route.ts` (simplest — 1 query)
- `SELECT name, slug, current_score, change FROM topics ORDER BY score DESC LIMIT 15`
- → `db.select({...}).from(topics).orderBy(desc(topics.currentScore)).limit(15)`

#### 2. `src/app/api/movers/route.ts` (1 query, computed column)
- Uses `ABS(current_score - previous_score)` for sorting
- → `sql<number>\`ABS(...)\`` in orderBy

#### 3. `src/app/api/topics/[slug]/route.ts` (3 queries → 1 with relations)
- Fetches topic + articles + scoreHistory
- → `db.query.topics.findFirst({ where: eq(topics.slug, slug), with: { articles: {...}, scoreHistory: {...} } })`
- This is where Drizzle relations shine — 3 queries become 1

#### 4. `src/app/api/topics/route.ts` (complex — sparkline subquery + delete)
- GET: sparkline uses `GROUP_CONCAT` → `STRING_AGG` in PostgreSQL
- DELETE: cascade delete (articles, score_history, topics)
- Filter by urgency, category, hidden

#### 5. `src/app/api/articles/[id]/route.ts` (CRUD)
- GET, PUT, DELETE for single article

#### 6. `src/app/api/articles/route.ts` (CRUD + dynamic filters)
- GET with ?topicId, ?source, ?url, ?limit, ?offset
- POST with Zod validation
- DELETE with filters

#### 7. `src/app/api/audit-logs/route.ts` (delegates to audit-log.ts)
- Already handled by Step 0B.2

#### 8. `src/app/api/seed/route.ts` (bulk operations)
- Calls seed script functions

#### 9. `src/app/api/cleanup/route.ts` (cascade deletes)
- Must delete in FK order: score_history → articles → topic_keywords → topics
- Same pattern, just with Drizzle `db.delete(table).where(...)`

#### 10. `src/app/api/batch/route.ts` (pipeline trigger)
- Calls batch script functions

#### 11. `src/app/api/cron/batch/route.ts` (cron trigger)
- Calls batch functions with bearer auth

### Step 0B.5: Scripts

#### `scripts/seed.ts`
- Bulk inserts with Drizzle
- **Must include v2 data:** sub-scores, levels, reasoning per dimension
- At least 2 topics per severity level (MINIMAL, MODERATE, SIGNIFICANT, SEVERE)
- At least 1 topic with INSUFFICIENT_DATA dimension
- Realistic reasoning text referencing seeded articles
- Close pool on exit: `await pool.end()`

#### `scripts/batch.ts`
- Full pipeline migration to Drizzle
- **US-1.1 scoring changes included:** rubric prompt, temperature 0, validateScore, computeOverallScore, deriveUrgency, detectAnomaly
- This is the largest single file change
- `initDb()` removed (no schema exec needed — Drizzle handles it)
- All prepared statements → Drizzle query builder
- Upserts via `onConflictDoUpdate`
- Article dedup via `onConflictDoNothing`
- Close pool on exit

### Checkpoint 0B

```bash
npx tsc --noEmit   # TypeScript compiles
npm run build       # Next.js builds successfully
```

**Exit criteria:** All source files compile. Build passes. Tests will fail (expected — fixed in 0C).

---

## Phase 0C: Test Migration

**Goal:** All 132+ tests pass with mocked Drizzle DB.

### Step 0C.1: Create `tests/helpers/mock-db.ts`

Shared mock setup for Drizzle's `db` object:
- Mock chainable methods: `select`, `insert`, `update`, `delete`, `from`, `where`, `orderBy`, `limit`, `values`, `set`, `onConflictDoUpdate`, `onConflictDoNothing`
- Mock relational query API: `db.query.topics.findFirst`, `db.query.topics.findMany`, etc.
- Export `mockDb` and `resetMocks()` helper

### Step 0C.2: Update Test Suites (8+ files)

| Test File | Key Changes |
|-----------|-------------|
| `tests/db.test.ts` | **Rewrite completely.** Was testing SQLite schema/constraints. Now tests Drizzle schema type exports (compile-time) and mock query patterns. |
| `tests/batch.test.ts` | Mock `@/db`. Test `validateScore`, `computeOverallScore`, `deriveUrgency`, `detectAnomaly` (pure functions — no DB). Test `extractJSON`. |
| `tests/seed.test.ts` | Mock `@/db`. Verify seed calls `db.insert()` with correct data shapes. |
| `tests/api-topics.test.ts` | Mock `@/db`. Return mock topic arrays from `db.select()` chain. |
| `tests/api-topic-detail.test.ts` | Mock `@/db`. Return mock from `db.query.topics.findFirst()`. |
| `tests/api-ticker.test.ts` | Mock `@/db`. Return mock ticker items. |
| `tests/api-movers.test.ts` | Mock `@/db`. Return mock movers with abs(change). |
| `tests/api-cron-batch.test.ts` | Mock `@/db`. Test auth + pipeline trigger. |

**Pattern for each test:**
```typescript
import { db } from "@/db";
jest.mock("@/db");

beforeEach(() => jest.clearAllMocks());

test("...", async () => {
  // Arrange: configure mock return
  (db.select as jest.Mock).mockReturnThis();
  (db.from as jest.Mock).mockReturnThis();
  // ... chain setup ...
  (db.limit as jest.Mock).mockResolvedValue([mockData]);

  // Act
  const response = await GET(request);

  // Assert
  expect(response.status).toBe(200);
});
```

### Step 0C.3: Update Component Tests (7 files)

Component tests (`TickerBar.test.tsx`, `TopicCard.test.tsx`, etc.) mock `fetch`, not the DB directly. These likely need **minimal changes**:
- Update expected response shapes if new fields added (healthScore, ecoScore, etc.)
- May need to add new fields to mock API responses

### Step 0C.4: Update Jest Config

```typescript
// jest.config.ts — verify module name mapping
moduleNameMapper: {
  "^@/(.*)$": "<rootDir>/src/$1",  // @/db → src/db ✓
}
```

Existing config should already handle `@/db` since `@/*` → `src/*`. Verify.

### Checkpoint 0C

```bash
npx jest              # All tests pass
npx jest --coverage   # Coverage maintained ≥95%
```

**Exit criteria:** All tests green. Coverage doesn't regress significantly.

---

## Phase 0D: Docker & Documentation

**Goal:** Docker builds, documentation reflects new architecture.

### Step 0D.1: Update `docker-compose.yml`

- Add `postgres` service (postgres:17-alpine) with healthcheck
- Replace `ecoticker-data` volume with `pgdata` volume
- Add `DATABASE_URL` env var to `app` and `cron` services
- Add `depends_on: postgres: condition: service_healthy`
- Remove SQLite volume mounts

### Step 0D.2: Update `Dockerfile`

- Remove `better-sqlite3` native binary COPY lines
- Remove `DATABASE_PATH` env var
- Remove `/data` directory creation
- `pg` is pure JS — no special handling needed

### Step 0D.3: Update Documentation

| File | Changes |
|------|---------|
| `CLAUDE.md` | Tech stack (PG+Drizzle), commands (drizzle-kit push), structure (src/db/), testing strategy, Docker changes |
| `PROJECT_INDEX.md` | File tree, dependencies, Docker services, database schema section |
| `PROJECT_INDEX.json` | Structured metadata updates |
| `.env.example` | Already done in 0A.5 |
| `deployment.md` | Railway PostgreSQL setup, drizzle-kit push command |
| `RAILWAY_QUICKSTART.md` | PostgreSQL plugin addition |

### Step 0D.4: Update `.gitignore`

Add:
```
drizzle/
```

### Checkpoint 0D

```bash
docker compose build   # Docker builds (if Docker available)
npx tsc --noEmit       # Still compiles
npm run build           # Still builds
npx jest               # Still passes
```

---

## Complete Validation Checklist

Before marking Phase 0 complete:

- [ ] `npm install` succeeds (no better-sqlite3)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] `npx jest` — all tests pass
- [ ] `npx jest --coverage` — coverage ≥95%
- [ ] `npx drizzle-kit push` — schema pushes to local PG (manual verification)
- [ ] `npx tsx scripts/seed.ts` — seeds data successfully (manual, needs local PG)
- [ ] No `better-sqlite3` imports remain (`grep -r "better-sqlite3" src/ scripts/`)
- [ ] No `getDb()` calls remain (`grep -r "getDb" src/ scripts/`)
- [ ] No raw SQL strings remain (`grep -r "\.prepare(" src/ scripts/`)
- [ ] All API routes use `await` for DB calls
- [ ] Docker builds (if Docker available)
- [ ] CLAUDE.md updated
- [ ] PROJECT_INDEX.md updated

---

## File Impact Summary

### New Files (4)

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle schema (8 tables + 6 relations) |
| `src/db/index.ts` | Database connection pool |
| `drizzle.config.ts` | Drizzle Kit CLI config |
| `tests/helpers/mock-db.ts` | Shared Drizzle mock for tests |

### Deleted Files (2)

| File | Replaced By |
|------|-------------|
| `db/schema.sql` | `src/db/schema.ts` |
| `src/lib/db.ts` | `src/db/index.ts` |

### Modified Files (~25)

| Category | Files | Count |
|----------|-------|-------|
| Types | `src/lib/types.ts` | 1 |
| Lib | `src/lib/audit-log.ts` | 1 |
| API routes | `ticker`, `movers`, `topics`, `topics/[slug]`, `articles`, `articles/[id]`, `audit-logs`, `seed`, `cleanup`, `batch`, `cron/batch` | 11 |
| Scripts | `scripts/seed.ts`, `scripts/batch.ts` | 2 |
| Tests | `db`, `batch`, `seed`, `api-topics`, `api-topic-detail`, `api-ticker`, `api-movers`, `api-cron-batch` + component tests | 8-15 |
| Config | `package.json`, `.env.example`, `.gitignore` | 3 |
| Docker | `docker-compose.yml`, `Dockerfile` | 2 |
| Docs | `CLAUDE.md`, `PROJECT_INDEX.md`, `PROJECT_INDEX.json`, `deployment.md` | 4 |

**Total: ~31 files touched** (4 new + 2 deleted + ~25 modified)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Missed `await` on async DB calls | TypeScript will flag — Drizzle returns `Promise<T>`, not `T` |
| Mock DB drifts from real schema | Local integration tests with real PG; schema is source of truth |
| `GROUP_CONCAT` → `STRING_AGG` missed | Only 1 query uses it (topics list sparkline) — identified above |
| Connection pool exhaustion in dev | `max: 10` with idle timeout; Next.js HMR creates new connections but pool manages |
| Tests import wrong `db` path | Jest moduleNameMapper: `@/db` → `src/db` (verify in config) |
| Sync → async breaks test assertions | All test assertions must use `await` and `async` handlers |

---

## Estimated Scope per Phase

| Phase | Files | Effort | Parallelizable |
|-------|-------|--------|----------------|
| 0A: Infrastructure | 5 new + 2 config | S | No (sequential foundation) |
| 0B: Core migration | 14 modified | **L** (bulk of work) | Partially (routes are independent) |
| 0C: Test migration | 8-15 modified, 1 new | **L** | Yes (test files are independent) |
| 0D: Docker & docs | 6 modified | S | Yes (docker + docs independent) |

**Next step after Phase 0:** US-1.1 scoring pipeline changes in `scripts/batch.ts` (rubric prompt, validateScore, computeOverallScore, etc.) — these are included in Phase 0B Step 0B.5 since the design doc recommends interleaving.

---

## Execution Notes

- Use `/sc:implement` to execute each phase step by step
- Each checkpoint is a natural commit point
- Commit message convention: `feat(db): description` for Phase 0 changes
- All work stays on `v2` branch
