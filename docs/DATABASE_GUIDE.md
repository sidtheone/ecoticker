# Database Guide: EcoTicker

Comprehensive documentation for the PostgreSQL database schema, queries, and patterns.

---

## Table of Contents

- [Overview](#overview)
- [Schema Definition](#schema-definition)
- [Table Reference](#table-reference)
- [Relationships](#relationships)
- [Common Queries](#common-queries)
- [Database Operations](#database-operations)
- [Best Practices](#best-practices)

---

## Overview

### Database Technology

- **DBMS:** PostgreSQL 16
- **Client Library:** `pg` (node-postgres) v8.13
- **Connection Pattern:** Singleton connection pool
- **Schema Management:** SQL file with auto-initialization

### Connection Configuration

```typescript
// src/lib/db.ts
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/ecoticker';

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Production settings
  max: 20,                    // Maximum pool connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
});

export function getDb() {
  return pool;
}
```

### Environment Variables

```bash
# .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/ecoticker

# Railway/Production
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

---

## Schema Definition

**Location:** `db/schema.sql`

### Initialization

The database schema is automatically initialized on first connection:

```typescript
// src/lib/db.ts
import fs from 'fs';
import path from 'path';

async function initDb() {
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
  console.log('Database schema initialized');
}
```

### Full Schema

```sql
-- Topics Table
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  current_score INTEGER DEFAULT 50 CHECK (current_score BETWEEN 0 AND 100),
  previous_score INTEGER CHECK (previous_score IS NULL OR previous_score BETWEEN 0 AND 100),
  urgency TEXT DEFAULT 'informational' CHECK (urgency IN ('breaking', 'critical', 'moderate', 'informational')),
  category TEXT DEFAULT 'ecology' CHECK (category IN ('health', 'ecology', 'economy')),
  region TEXT DEFAULT 'Global',
  article_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topics_urgency ON topics(urgency);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_topics_updated ON topics(updated_at DESC);

-- Articles Table
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- Score History Table
CREATE TABLE IF NOT EXISTS score_history (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  health_score INTEGER CHECK (health_score BETWEEN 0 AND 100),
  ecology_score INTEGER CHECK (ecology_score BETWEEN 0 AND 100),
  economy_score INTEGER CHECK (economy_score BETWEEN 0 AND 100),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_score_history_topic ON score_history(topic_id, recorded_at DESC);

-- Topic Keywords Table (for LLM-based topic matching)
CREATE TABLE IF NOT EXISTS topic_keywords (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(topic_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_topic_keywords_keyword ON topic_keywords(keyword);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  details TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
```

---

## Table Reference

### `topics`

**Purpose:** Core environmental topics being tracked.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing topic ID |
| slug | TEXT | UNIQUE, NOT NULL | URL-friendly identifier |
| title | TEXT | NOT NULL | Display name |
| description | TEXT | | Detailed description |
| current_score | INTEGER | 0-100, DEFAULT 50 | Current impact score |
| previous_score | INTEGER | 0-100, NULL allowed | Previous score (for change calculation) |
| urgency | TEXT | CHECK constraint | breaking/critical/moderate/informational |
| category | TEXT | CHECK constraint | health/ecology/economy |
| region | TEXT | DEFAULT 'Global' | Geographic region |
| article_count | INTEGER | DEFAULT 0 | Cached article count |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_topics_urgency` on `urgency` (for filtering)
- `idx_topics_category` on `category` (for filtering)
- `idx_topics_updated` on `updated_at DESC` (for sorting)

**Constraints:**
- `slug` must be unique (enforces one topic per identifier)
- `current_score` and `previous_score` must be 0-100 or NULL
- `urgency` must be one of 4 allowed values
- `category` must be one of 3 allowed values

---

### `articles`

**Purpose:** News articles related to topics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing article ID |
| topic_id | INTEGER | FK to topics, NOT NULL | Associated topic |
| title | TEXT | NOT NULL | Article headline |
| url | TEXT | UNIQUE, NOT NULL | Article URL (deduplication key) |
| source | TEXT | NOT NULL | Publisher/source name |
| summary | TEXT | | Article summary/excerpt |
| image_url | TEXT | | Featured image URL |
| published_at | TIMESTAMP | | Original publication date |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |

**Indexes:**
- `idx_articles_topic` on `topic_id` (for topic lookups)
- `idx_articles_url` on `url` (for deduplication)
- `idx_articles_published` on `published_at DESC` (for sorting)

**Constraints:**
- `url` must be unique (prevents duplicate articles)
- `topic_id` references `topics.id` with CASCADE delete

**Deduplication Pattern:**
```sql
INSERT INTO articles (topic_id, title, url, source, summary)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (url) DO NOTHING
RETURNING *;
```

---

### `score_history`

**Purpose:** Historical daily snapshots of topic scores.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing history ID |
| topic_id | INTEGER | FK to topics, NOT NULL | Associated topic |
| score | INTEGER | 0-100, NOT NULL | Overall impact score |
| health_score | INTEGER | 0-100 | Health sub-score |
| ecology_score | INTEGER | 0-100 | Ecology sub-score |
| economy_score | INTEGER | 0-100 | Economy sub-score |
| recorded_at | TIMESTAMP | DEFAULT NOW() | Snapshot timestamp |

**Indexes:**
- `idx_score_history_topic` on `(topic_id, recorded_at DESC)` (composite for time-series queries)

**Usage:**
- One entry per topic per day (typically)
- Powers sparkline and full score charts
- Sub-scores optional but recommended for detailed analysis

---

### `topic_keywords`

**Purpose:** LLM-generated keywords/aliases for cross-batch topic matching.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing keyword ID |
| topic_id | INTEGER | FK to topics, NOT NULL | Associated topic |
| keyword | TEXT | NOT NULL | Keyword/alias |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |

**Indexes:**
- `idx_topic_keywords_keyword` on `keyword` (for lookup)

**Constraints:**
- `UNIQUE(topic_id, keyword)` prevents duplicate keywords per topic
- `topic_id` references `topics.id` with CASCADE delete

**Usage Pattern:**
```typescript
// During batch processing, find topic by keyword match
const result = await db.query(`
  SELECT DISTINCT t.*
  FROM topics t
  JOIN topic_keywords tk ON t.id = tk.topic_id
  WHERE tk.keyword = $1
`, [matchedKeyword]);
```

---

### `audit_logs`

**Purpose:** Comprehensive audit trail for all write operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing log ID |
| timestamp | TIMESTAMP | DEFAULT NOW() | Log entry timestamp |
| ip_address | TEXT | | Client IP address |
| endpoint | TEXT | NOT NULL | API endpoint path |
| method | TEXT | NOT NULL | HTTP method (POST/PUT/DELETE) |
| action | TEXT | NOT NULL | Action description |
| success | BOOLEAN | NOT NULL | Operation success flag |
| error_message | TEXT | | Error details (if failed) |
| details | TEXT | | Additional context (JSON string) |
| user_agent | TEXT | | Client User-Agent header |

**Indexes:**
- `idx_audit_logs_timestamp` on `timestamp DESC` (for recent logs)
- `idx_audit_logs_success` on `success` (for filtering failures)
- `idx_audit_logs_action` on `action` (for action statistics)

**Usage:**
```typescript
// Log successful operation
await logSuccess({
  ipAddress: req.ip,
  endpoint: '/api/articles',
  method: 'POST',
  action: 'create_article',
  details: JSON.stringify({ articleId: 123 }),
  userAgent: req.headers['user-agent']
});

// Log failure
await logFailure({
  ipAddress: req.ip,
  endpoint: '/api/batch',
  method: 'POST',
  action: 'batch_process',
  errorMessage: 'NewsAPI rate limit exceeded',
  details: JSON.stringify({ apiStatus: 429 })
});
```

---

## Relationships

### Entity-Relationship Diagram

```
topics (1) ----< (N) articles
  |
  | (1) ----< (N) score_history
  |
  | (1) ----< (N) topic_keywords

audit_logs (standalone, no foreign keys)
```

### Cascade Delete Behavior

**ON DELETE CASCADE:**
- Deleting a topic automatically deletes:
  - All associated articles
  - All score history entries
  - All topic keywords

```sql
DELETE FROM topics WHERE id = 1;
-- Automatically deletes:
-- - articles WHERE topic_id = 1
-- - score_history WHERE topic_id = 1
-- - topic_keywords WHERE topic_id = 1
```

---

## Common Queries

### Topic Queries

#### Get All Topics with Sparkline Data

```typescript
const query = `
  SELECT
    t.*,
    COALESCE(
      (SELECT json_agg(sh.score ORDER BY sh.recorded_at DESC)
       FROM (SELECT score, recorded_at
             FROM score_history
             WHERE topic_id = t.id
             ORDER BY recorded_at DESC
             LIMIT 7) sh),
      '[]'::json
    ) as sparkline
  FROM topics t
  ORDER BY t.current_score DESC
`;

const result = await db.query(query);
// result.rows[0].sparkline = [78, 75, 72, 68, 65, 62, 60]
```

#### Filter Topics by Urgency

```typescript
const query = `
  SELECT * FROM topics
  WHERE urgency = $1
  ORDER BY current_score DESC
`;

const result = await db.query(query, ['critical']);
```

#### Get Topic by Slug with Details

```typescript
const query = `
  SELECT * FROM topics
  WHERE slug = $1
`;

const result = await db.query(query, ['wildfire-impact-western-regions']);
if (result.rows.length === 0) {
  // 404 - Topic not found
}
```

---

### Article Queries

#### Get Articles for Topic

```typescript
const query = `
  SELECT * FROM articles
  WHERE topic_id = $1
  ORDER BY published_at DESC NULLS LAST
  LIMIT $2 OFFSET $3
`;

const result = await db.query(query, [topicId, limit, offset]);
```

#### Insert Article with Deduplication

```typescript
const query = `
  INSERT INTO articles (topic_id, title, url, source, summary, image_url, published_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (url) DO NOTHING
  RETURNING *
`;

const result = await db.query(query, [topicId, title, url, source, summary, imageUrl, publishedAt]);

if (result.rows.length === 0) {
  // Article already exists (conflict on url)
}
```

#### Get Articles with Topic Info

```typescript
const query = `
  SELECT
    a.*,
    json_build_object(
      'slug', t.slug,
      'title', t.title
    ) as topic
  FROM articles a
  JOIN topics t ON a.topic_id = t.id
  WHERE a.id = $1
`;

const result = await db.query(query, [articleId]);
// result.rows[0] = { id, title, url, ..., topic: { slug, title } }
```

---

### Score History Queries

#### Get Full History for Topic

```typescript
const query = `
  SELECT
    score,
    health_score,
    ecology_score,
    economy_score,
    recorded_at
  FROM score_history
  WHERE topic_id = $1
  ORDER BY recorded_at ASC
`;

const result = await db.query(query, [topicId]);
```

#### Insert Daily Score Snapshot

```typescript
const query = `
  INSERT INTO score_history (topic_id, score, health_score, ecology_score, economy_score)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`;

const result = await db.query(query, [topicId, score, healthScore, ecologyScore, economyScore]);
```

#### Get Last 7 Days of Scores (for Sparkline)

```typescript
const query = `
  SELECT score
  FROM score_history
  WHERE topic_id = $1
  ORDER BY recorded_at DESC
  LIMIT 7
`;

const result = await db.query(query, [topicId]);
const sparkline = result.rows.map(r => r.score).reverse(); // Oldest to newest
```

---

### Advanced Queries

#### Biggest Movers (Largest Absolute Change)

```typescript
const query = `
  SELECT
    t.*,
    ABS(t.current_score - COALESCE(t.previous_score, t.current_score)) as abs_change
  FROM topics t
  WHERE t.previous_score IS NOT NULL
  ORDER BY abs_change DESC
  LIMIT 5
`;

const result = await db.query(query);
```

#### Topic Detail with All Related Data

```typescript
const topicQuery = `SELECT * FROM topics WHERE slug = $1`;
const articlesQuery = `
  SELECT * FROM articles
  WHERE topic_id = $1
  ORDER BY published_at DESC NULLS LAST
  LIMIT 20
`;
const historyQuery = `
  SELECT * FROM score_history
  WHERE topic_id = $1
  ORDER BY recorded_at ASC
`;

const [topicResult, articlesResult, historyResult] = await Promise.all([
  db.query(topicQuery, [slug]),
  db.query(articlesQuery, [topicId]),
  db.query(historyQuery, [topicId])
]);

const response = {
  topic: topicResult.rows[0],
  articles: articlesResult.rows,
  scoreHistory: historyResult.rows
};
```

#### Update Article Count (Cached Denormalization)

```typescript
const query = `
  UPDATE topics
  SET article_count = (
    SELECT COUNT(*) FROM articles WHERE topic_id = topics.id
  )
  WHERE id = $1
`;

await db.query(query, [topicId]);
```

---

## Database Operations

### Topic Upsert Pattern

Used in batch processing to update existing topics or create new ones:

```typescript
async function upsertTopic(topic: {
  slug: string;
  title: string;
  description: string;
  currentScore: number;
  urgency: string;
  category: string;
  region: string;
}) {
  const query = `
    INSERT INTO topics (slug, title, description, current_score, urgency, category, region, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      previous_score = topics.current_score,  -- Rotate score for change tracking
      current_score = EXCLUDED.current_score,
      urgency = EXCLUDED.urgency,
      category = EXCLUDED.category,
      region = EXCLUDED.region,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const result = await db.query(query, [
    topic.slug,
    topic.title,
    topic.description,
    topic.currentScore,
    topic.urgency,
    topic.category,
    topic.region
  ]);

  return result.rows[0];
}
```

**Key Pattern:** `previous_score = topics.current_score` rotates the current score into previous before updating, enabling change tracking.

---

### Batch Delete with Safety

```typescript
async function deleteArticlesByFilters(filters: {
  topicId?: number;
  source?: string;
  url?: string;
  ids?: number[];
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  if (filters.topicId) {
    conditions.push(`topic_id = $${paramCount++}`);
    params.push(filters.topicId);
  }

  if (filters.source) {
    conditions.push(`source = $${paramCount++}`);
    params.push(filters.source);
  }

  if (filters.url) {
    conditions.push(`url = $${paramCount++}`);
    params.push(filters.url);
  }

  if (filters.ids && filters.ids.length > 0) {
    conditions.push(`id = ANY($${paramCount++})`);
    params.push(filters.ids);
  }

  if (conditions.length === 0) {
    throw new Error('At least one filter required');
  }

  const query = `
    DELETE FROM articles
    WHERE ${conditions.join(' AND ')}
  `;

  const result = await db.query(query, params);
  return result.rowCount;
}
```

---

### Transaction Pattern

For operations requiring atomicity:

```typescript
async function createTopicWithArticles(topicData: any, articles: any[]) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert topic
    const topicQuery = `
      INSERT INTO topics (slug, title, description, current_score)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const topicResult = await client.query(topicQuery, [
      topicData.slug,
      topicData.title,
      topicData.description,
      topicData.currentScore
    ]);
    const topic = topicResult.rows[0];

    // Insert articles
    for (const article of articles) {
      const articleQuery = `
        INSERT INTO articles (topic_id, title, url, source)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(articleQuery, [
        topic.id,
        article.title,
        article.url,
        article.source
      ]);
    }

    await client.query('COMMIT');
    return topic;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}
```

---

### Connection Pool Management

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  await pool.end();
  process.exit(0);
});

// Health check
export async function checkDatabaseHealth() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { healthy: true, timestamp: result.rows[0].now };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

---

## Best Practices

### 1. Always Use Parameterized Queries

**✅ DO:**
```typescript
const query = 'SELECT * FROM topics WHERE slug = $1';
const result = await db.query(query, [slug]);
```

**❌ DON'T:**
```typescript
// SQL injection vulnerability!
const query = `SELECT * FROM topics WHERE slug = '${slug}'`;
const result = await db.query(query);
```

---

### 2. Handle NULL Values

```typescript
// Check for NULL previous_score
const change = topic.previous_score !== null
  ? topic.current_score - topic.previous_score
  : 0;

// Use COALESCE in SQL
const query = `
  SELECT
    current_score - COALESCE(previous_score, current_score) as change
  FROM topics
`;
```

---

### 3. Use Indexes for Filters

```typescript
// Fast: uses idx_topics_urgency
SELECT * FROM topics WHERE urgency = 'critical';

// Slow: full table scan (no index on description)
SELECT * FROM topics WHERE description LIKE '%wildfire%';
```

---

### 4. Limit Result Sets

```typescript
// Always use LIMIT for potentially large results
const query = `
  SELECT * FROM articles
  ORDER BY published_at DESC
  LIMIT $1 OFFSET $2
`;
const result = await db.query(query, [limit, offset]);
```

---

### 5. Handle Unique Constraint Violations

```typescript
try {
  const query = `
    INSERT INTO articles (topic_id, title, url, source)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await db.query(query, [topicId, title, url, source]);

} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation (duplicate URL)
    throw new Error('Article with this URL already exists');
  }
  throw error;
}
```

**PostgreSQL Error Codes:**
- `23505`: Unique violation
- `23503`: Foreign key violation
- `23514`: Check constraint violation

---

### 6. Use JSON Aggregation for Sub-queries

```typescript
// Efficient: single query with JSON aggregation
const query = `
  SELECT
    t.*,
    (SELECT json_agg(json_build_object(
      'id', a.id,
      'title', a.title,
      'url', a.url
    ))
    FROM articles a
    WHERE a.topic_id = t.id
    LIMIT 5) as recent_articles
  FROM topics t
  WHERE t.slug = $1
`;

// Inefficient: N+1 query problem
const topic = await getTopicBySlug(slug);
const articles = await getArticlesByTopicId(topic.id);
```

---

### 7. Clean Up Connections

```typescript
// For standalone scripts
import { getDb } from './lib/db';

async function runScript() {
  const db = getDb();

  try {
    await db.query('SELECT 1');
    console.log('Database connected');

    // Perform operations...

  } finally {
    await db.end(); // Close pool when script completes
  }
}
```

---

### 8. Monitor Query Performance

```typescript
// Log slow queries in development
const startTime = Date.now();
const result = await db.query(query, params);
const duration = Date.now() - startTime;

if (duration > 100) {
  console.warn(`Slow query (${duration}ms):`, query);
}
```

---

## Testing with pg-mem

For unit tests, use pg-mem (in-memory PostgreSQL emulator):

```typescript
// tests/test-db.ts
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';

export function createTestDb() {
  const db = newDb();

  // Load schema
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.public.query(schema);

  return db.adapters.createPg().Pool;
}

// In tests
import { createTestDb } from './test-db';

describe('Database operations', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    await db.end();
  });

  it('inserts topic successfully', async () => {
    const query = `
      INSERT INTO topics (slug, title, current_score)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(query, ['test-topic', 'Test Topic', 75]);

    expect(result.rows[0].slug).toBe('test-topic');
  });
});
```

---

**Last Updated:** 2026-02-09
