# 1. Database & Data Layer

## Schema (8 tables in `src/db/schema.ts`)

### Table: `topics` — Central Entity (19 columns)

| Column | Drizzle Type | PG Type | Nullable | Default | Constraint |
|---|---|---|---|---|---|
| `id` | `serial` | SERIAL | NOT NULL | auto-increment | PRIMARY KEY |
| `name` | `text` | TEXT | NOT NULL | — | — |
| `slug` | `text` | TEXT | NOT NULL | — | UNIQUE (inline) |
| `category` | `text` | TEXT | YES | `"climate"` | — |
| `region` | `text` | TEXT | YES | NULL | — |
| `current_score` | `integer` | INT4 | YES | `0` | — |
| `previous_score` | `integer` | INT4 | YES | `0` | — |
| `urgency` | `text` | TEXT | YES | `"informational"` | — |
| `impact_summary` | `text` | TEXT | YES | NULL | — |
| `image_url` | `text` | TEXT | YES | NULL | — |
| `article_count` | `integer` | INT4 | YES | `0` | — |
| `health_score` | `integer` | INT4 | YES | `0` | added US-1.1 |
| `eco_score` | `integer` | INT4 | YES | `0` | added US-1.1 |
| `econ_score` | `integer` | INT4 | YES | `0` | added US-1.1 |
| `score_reasoning` | `text` | TEXT | YES | NULL | — |
| `hidden` | `boolean` | BOOL | YES | `false` | added US-4.2 |
| `created_at` | `timestamp` | TIMESTAMP | YES | `NOW()` | — |
| `updated_at` | `timestamp` | TIMESTAMP | YES | `NOW()` | — |

**Indexes:** `idx_topics_urgency` on `urgency`, `idx_topics_category` on `category`.

---

### Table: `articles` — News Articles (10 columns)

| Column | Drizzle Type | PG Type | Nullable | Default | Constraint |
|---|---|---|---|---|---|
| `id` | `serial` | SERIAL | NOT NULL | auto-increment | PRIMARY KEY |
| `topic_id` | `integer` | INT4 | NOT NULL | — | FK → `topics.id` |
| `title` | `text` | TEXT | NOT NULL | — | — |
| `url` | `text` | TEXT | NOT NULL | — | UNIQUE (dedup) |
| `source` | `text` | TEXT | YES | NULL | — |
| `summary` | `text` | TEXT | YES | NULL | — |
| `image_url` | `text` | TEXT | YES | NULL | — |
| `source_type` | `text` | TEXT | YES | `"unknown"` | added US-5.2 |
| `published_at` | `timestamp` | TIMESTAMP | YES | NULL | — |
| `fetched_at` | `timestamp` | TIMESTAMP | YES | `NOW()` | — |

**Index:** `idx_articles_topic` on `topic_id`.
**Key pattern:** UNIQUE on `url` is the dedup mechanism. Inserts use `ON CONFLICT DO NOTHING`.

---

### Table: `score_history` — Daily Audit Trail (16 columns)

| Column | Drizzle Type | PG Type | Nullable | Default | Constraint |
|---|---|---|---|---|---|
| `id` | `serial` | SERIAL | NOT NULL | auto-increment | PRIMARY KEY |
| `topic_id` | `integer` | INT4 | NOT NULL | — | FK → `topics.id` |
| `score` | `integer` | INT4 | NOT NULL | — | — |
| `health_score` | `integer` | INT4 | YES | NULL | — |
| `eco_score` | `integer` | INT4 | YES | NULL | — |
| `econ_score` | `integer` | INT4 | YES | NULL | — |
| `impact_summary` | `text` | TEXT | YES | NULL | — |
| `health_level` | `text` | TEXT | YES | NULL | US-1.1 |
| `eco_level` | `text` | TEXT | YES | NULL | US-1.1 |
| `econ_level` | `text` | TEXT | YES | NULL | US-1.1 |
| `health_reasoning` | `text` | TEXT | YES | NULL | US-1.1 |
| `eco_reasoning` | `text` | TEXT | YES | NULL | US-1.1 |
| `econ_reasoning` | `text` | TEXT | YES | NULL | US-1.1 |
| `overall_summary` | `text` | TEXT | YES | NULL | US-1.1 |
| `raw_llm_response` | `jsonb` | JSONB | YES | NULL | US-1.1 |
| `anomaly_detected` | `boolean` | BOOL | YES | `false` | US-1.1 |
| `recorded_at` | `date` | DATE | YES | `NOW()` | — |

**Indexes:** `idx_score_history_topic` on `topic_id`, `idx_score_history_date` on `recorded_at`, `idx_score_history_topic_date` UNIQUE on `(topic_id, recorded_at)`.

---

### Table: `topic_keywords`

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | — |
| `topic_id` | INT4 FK | → `topics.id` |
| `keyword` | TEXT | — |

**Index:** `idx_topic_keywords_topic` on `topic_id`.

---

### Table: `audit_logs` — Security Audit Trail

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | — |
| `timestamp` | TIMESTAMP | event time, default NOW() |
| `ip_address` | TEXT | GDPR: last octet zeroed |
| `endpoint` | TEXT | NOT NULL |
| `method` | TEXT | NOT NULL |
| `action` | TEXT | NOT NULL |
| `success` | BOOL | default true |
| `error_message` | TEXT | nullable |
| `details` | TEXT | nullable, JSON string |
| `created_at` | TIMESTAMP | row insertion time |

**Indexes:** `idx_audit_logs_timestamp`, `idx_audit_logs_action`.

---

### Table: `tracked_keywords` (US-4.1)

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | — |
| `keyword` | TEXT UNIQUE | — |
| `active` | BOOL | default true |
| `status` | TEXT | default `"pending"` |
| `created_at` | TIMESTAMP | — |
| `last_searched_at` | TIMESTAMP | nullable |
| `result_count` | INT | default 0 |

---

### Table: `topic_views` (US-8.1)

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | — |
| `topic_id` | INT4 FK | → `topics.id` |
| `date` | DATE | NOT NULL |
| `view_count` | INT | default 0 |

**Index:** `idx_topic_views_unique` UNIQUE on `(topic_id, date)`.

---

### Table: `score_feedback` (US-10.1)

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | — |
| `topic_id` | INT4 FK | → `topics.id` |
| `score_history_id` | INT4 FK | → `score_history.id`, nullable |
| `dimension` | TEXT | NOT NULL |
| `direction` | TEXT | NOT NULL |
| `comment` | TEXT | nullable |
| `ip_address` | TEXT | GDPR: last octet zeroed |
| `created_at` | TIMESTAMP | — |

**Index:** `idx_score_feedback_topic` on `topic_id`.

---

### Drizzle Relations

| Export | Type | Description |
|---|---|---|
| `topicsRelations` | `many` | → articles, scoreHistory, keywords, views, feedback |
| `articlesRelations` | `one` | articles.topicId → topics.id |
| `scoreHistoryRelations` | `one + many` | → topics.id; → scoreFeedback (many) |
| `topicKeywordsRelations` | `one` | → topics.id |
| `scoreFeedbackRelations` | `one + one` | → topics.id; → scoreHistory.id |
| `topicViewsRelations` | `one` | → topics.id |

---

## Connection (`src/db/index.ts`)

| Setting | Value |
|---|---|
| Driver | `node-postgres` (`pg`) via `drizzle-orm/node-postgres` |
| Connection source | `process.env.DATABASE_URL` |
| Pool max | 10 |
| Idle timeout | 30,000ms |
| Connect timeout | 5,000ms |
| Schema awareness | Full — `drizzle(pool, { schema })` |

**Exports:** `db` (Drizzle instance), `pool` (raw `pg.Pool` for scripts needing `pool.end()`).

---

## Drizzle Config (`drizzle.config.ts`)

| Setting | Value |
|---|---|
| `schema` | `./src/db/schema.ts` |
| `out` | `./drizzle` (unused — no migration files) |
| `dialect` | `"postgresql"` |
| `dbCredentials.url` | `process.env.DATABASE_URL!` |

Project uses `drizzle-kit push` (schema push), not migration files.

---

## TypeScript Types (`src/lib/types.ts`)

### Type Definitions

- **`Urgency`**: `"breaking" | "critical" | "moderate" | "informational"`
- **`SeverityLevel`**: `"MINIMAL" | "MODERATE" | "SIGNIFICANT" | "SEVERE" | "INSUFFICIENT_DATA"`
- **`Category`**: 10 values — `air_quality`, `deforestation`, `ocean`, `climate`, `pollution`, `biodiversity`, `wildlife`, `energy`, `waste`, `water`

### Interfaces

**`Topic`** — Primary API response shape:

| Field | DB Column | Note |
|---|---|---|
| `id` | `topics.id` | — |
| `name` | `topics.name` | — |
| `slug` | `topics.slug` | — |
| `category` | `topics.category` | Typed as `Category` |
| `region` | `topics.region` | — |
| `currentScore` | `topics.current_score` | camelCase |
| `previousScore` | `topics.previous_score` | — |
| `change` | — | **Computed**: currentScore - previousScore |
| `urgency` | `topics.urgency` | Typed as `Urgency` |
| `impactSummary` | `topics.impact_summary` | — |
| `imageUrl` | `topics.image_url` | — |
| `articleCount` | `topics.article_count` | — |
| `healthScore` | `topics.health_score` | — |
| `ecoScore` | `topics.eco_score` | — |
| `econScore` | `topics.econ_score` | — |
| `scoreReasoning` | `topics.score_reasoning` | — |
| `hidden` | `topics.hidden` | — |
| `updatedAt` | `topics.updated_at` | ISO string |
| `sparkline` | — | **Computed**: last 7 scores from score_history |

**`Article`**: id, topicId, title, url, source, summary, imageUrl, sourceType, publishedAt

**`ScoreHistoryEntry`**: score, healthScore/ecoScore/econScore (number|null), impactSummary, healthLevel/ecoLevel/econLevel, healthReasoning/ecoReasoning/econReasoning, overallSummary, anomalyDetected, date

**`TickerItem`**: name, slug, score, change (lightweight projection)

**`TopicDetail`**: `{ topic: Topic; articles: Article[]; scoreHistory: ScoreHistoryEntry[] }`

---

## Validation (`src/lib/validation.ts`)

### Zod Schemas

**`articleCreateSchema`**:
| Field | Constraint |
|---|---|
| `topicId` | `z.number().int().positive()` required |
| `title` | `z.string().min(1).max(500)` required |
| `url` | `z.string().url().max(2000)` required |
| `source` | `z.string().max(200).optional()` |
| `summary` | `z.string().max(5000).optional()` |
| `imageUrl` | `z.string().url().max(2000).optional()` |
| `publishedAt` | `z.string().datetime().optional()` |

**`articleUpdateSchema`**: `articleCreateSchema.partial()` — all fields optional.

**`articleDeleteSchema`**: ids/url/topicId/source — `.refine()` requires at least one.

**`topicDeleteSchema`**: ids/articleCount — `.refine()` requires at least one.

**`validateRequest<T>(schema, data)`**: Generic helper using `safeParse`. Flattens Zod errors to comma-separated string.

---

## Cross-Cutting Observations

- **Naming**: DB snake_case → API camelCase. Translation in route handlers.
- **Computed fields**: `change` and `sparkline` on Topic have no DB columns — assembled in API layer.
- **Date types**: `score_history.recorded_at` is DATE (day only), while `topics.created_at/updated_at` are TIMESTAMP.
- **JSONB**: `raw_llm_response` is the only JSONB column. Never exposed to API consumers.
- **GDPR**: `audit_logs` and `score_feedback` both truncate IP addresses. 90-day auto-purge for audit_logs.
