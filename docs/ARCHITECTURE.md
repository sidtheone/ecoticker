# Architecture: EcoTicker

Comprehensive architectural documentation covering system design, data flow, and technical decisions.

---

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Patterns](#architecture-patterns)
- [Data Flow](#data-flow)
- [Component Architecture](#component-architecture)
- [Database Design](#database-design)
- [API Design](#api-design)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Scalability Considerations](#scalability-considerations)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Browser                          │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Dashboard   │  │ Topic Detail │  │  Theme Management   │   │
│  │  (SSR/RSC)   │  │   (SSR/RSC)  │  │  (Client Context)   │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js 16 App (Node.js)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              App Router (Server Components)              │  │
│  │  • Pages: Dashboard, Topic Detail                        │  │
│  │  • Layouts: Root Layout with ThemeProvider               │  │
│  │  • API Routes: /api/topics, /articles, /batch, etc.      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Business Logic Layer                    │  │
│  │  • Authentication (API key validation)                    │  │
│  │  • Authorization (admin-only operations)                  │  │
│  │  • Rate Limiting (in-memory, per-IP)                      │  │
│  │  • Input Validation (Zod schemas)                         │  │
│  │  • Audit Logging (all write operations)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Data Access Layer                      │  │
│  │  • Database Pool (pg, singleton pattern)                  │  │
│  │  • Query Builders (parameterized SQL)                     │  │
│  │  • Schema Management (auto-init from schema.sql)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ TCP/IP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 16 Database                        │
│  • Topics, Articles, Score History                              │
│  • Topic Keywords (LLM matching)                                │
│  • Audit Logs                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      External Services                          │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐ │
│  │   NewsAPI    │  │        OpenRouter LLM                    │ │
│  │  (Articles)  │  │  (Classification & Scoring)              │ │
│  └──────────────┘  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Batch Processing                           │
│  • Cron Job (daily at 6AM UTC)                                  │
│  • Pipeline: NewsAPI → Classify → Score → Upsert                │
│  • 2-pass LLM: classify articles, then score topics             │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 | UI components |
| **Framework** | Next.js 16 (App Router) | SSR, RSC, API routes |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **Language** | TypeScript 5 | Type safety |
| **Database** | PostgreSQL 16 | Relational data store |
| **DB Client** | pg (node-postgres) 8.13 | PostgreSQL driver |
| **Validation** | Zod 4.3 | Schema validation |
| **Charts** | Recharts 3.7 | Data visualization |
| **HTTP** | Next.js native fetch | API requests |
| **Testing** | Jest 30 + React Testing Library | Unit/integration tests |
| **Container** | Docker + Docker Compose | Containerization |
| **Proxy** | Nginx (Alpine) | Reverse proxy, static assets |
| **Scheduler** | Alpine crond | Batch job scheduling |

---

## Architecture Patterns

### 1. Server-Side First Architecture

**Pattern:** Default to Server Components, use Client Components only when necessary.

**Benefits:**
- Reduced JavaScript bundle size
- Faster initial page load
- Improved SEO
- Direct database access without API layer

**Implementation:**
```tsx
// Server Component (default)
async function TopicDetailPage({ params }: { params: { slug: string } }) {
  // Direct database query
  const topic = await db.query('SELECT * FROM topics WHERE slug = $1', [params.slug]);

  return <TopicDetail topic={topic.rows[0]} />;
}

// Client Component (when needed)
'use client';

function TopicGrid() {
  const [filter, setFilter] = useState('all');
  // Interactive filtering requires client-side state
}
```

---

### 2. Singleton Database Pool

**Pattern:** Single shared PostgreSQL connection pool across the application.

**Benefits:**
- Connection reuse (20 max connections)
- Automatic connection management
- Thread-safe across Next.js request handlers

**Implementation:**
```typescript
// src/lib/db.ts
let pool: Pool | null = null;
let initialized = false;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }

  if (!initialized) {
    initDb(); // Load schema once
    initialized = true;
  }

  return pool;
}
```

---

### 3. Authentication Middleware Pattern

**Pattern:** Centralized API key authentication for all write operations.

**Benefits:**
- Single source of truth for auth logic
- Consistent error responses
- Easy to audit and update

**Implementation:**
```typescript
// src/lib/auth.ts
export function requireAdminKey(req: NextRequest): NextResponse | null {
  const apiKey = req.headers.get('X-API-Key');
  const validKey = process.env.ADMIN_API_KEY;

  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json({
      error: 'Unauthorized: Valid API key required',
      status: 401
    }, { status: 401 });
  }

  return null; // Auth passed
}

// Usage in API routes
export async function POST(req: NextRequest) {
  const authCheck = requireAdminKey(req);
  if (authCheck) return authCheck;

  // Proceed with authorized operation
}
```

---

### 4. Validation-First Input Handling

**Pattern:** All write endpoints validate input with Zod schemas before processing.

**Benefits:**
- Type-safe validation
- Consistent error messages
- Prevents invalid data from reaching database

**Implementation:**
```typescript
// src/lib/validation.ts
export const articleCreateSchema = z.object({
  topicId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  source: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
});

// In API route
const validation = articleCreateSchema.safeParse(body);
if (!validation.success) {
  return NextResponse.json({
    error: 'Validation failed',
    details: validation.error.errors
  }, { status: 400 });
}
```

---

### 5. Audit-Everything Pattern

**Pattern:** Log all write operations to audit_logs table.

**Benefits:**
- Complete audit trail
- Security compliance
- Debugging and analytics

**Implementation:**
```typescript
// src/lib/audit-log.ts
export async function logSuccess(params: {
  ipAddress: string;
  endpoint: string;
  method: string;
  action: string;
  details?: string;
}) {
  await db.query(`
    INSERT INTO audit_logs (ip_address, endpoint, method, action, success, details)
    VALUES ($1, $2, $3, $4, true, $5)
  `, [params.ipAddress, params.endpoint, params.method, params.action, params.details]);
}

// Called after every write operation
await logSuccess({
  ipAddress: req.ip,
  endpoint: '/api/articles',
  method: 'POST',
  action: 'create_article',
  details: JSON.stringify({ articleId: 123 })
});
```

---

## Data Flow

### Read Flow (Public Data)

```
1. Browser requests /api/topics?urgency=critical
                ↓
2. Next.js API route handler (GET /api/topics/route.ts)
                ↓
3. Rate limit check (100 req/min)
                ↓
4. Query validation (urgency enum check)
                ↓
5. Database query with parameterized SQL
   SELECT * FROM topics WHERE urgency = $1
                ↓
6. JSON aggregation for sparkline data
   (SELECT json_agg(score) FROM score_history ...)
                ↓
7. Transform snake_case → camelCase
                ↓
8. Return JSON response
   { topics: [{ id, slug, title, currentScore, ... }] }
```

---

### Write Flow (Protected Data)

```
1. Client sends POST /api/articles with X-API-Key header
                ↓
2. Next.js API route handler (POST /api/articles/route.ts)
                ↓
3. Authentication check (requireAdminKey)
   ↓ (fail)           ↓ (pass)
   401 Unauthorized   Continue
                ↓
4. Rate limit check (10 req/min for writes)
   ↓ (fail)           ↓ (pass)
   429 Too Many       Continue
                ↓
5. Input validation (Zod schema)
   ↓ (fail)           ↓ (pass)
   400 Bad Request    Continue
                ↓
6. Database operation (parameterized query)
   INSERT INTO articles (...) VALUES ($1, $2, ...)
   ON CONFLICT (url) DO NOTHING
   ↓ (conflict)       ↓ (success)
   409 Conflict       Continue
                ↓
7. Audit log (success)
   INSERT INTO audit_logs (...)
                ↓
8. Return JSON response
   { article: { id, title, url, ... } }
```

---

### Batch Processing Flow

```
Daily at 6AM UTC (Alpine crond)
                ↓
1. Trigger POST /api/cron/batch (bearer token auth)
                ↓
2. Fetch environmental news from NewsAPI
   GET newsapi.org/v2/everything?q=environment...
                ↓
3. Pass 1: Classify articles with LLM
   For each article:
   - Extract topic keywords
   - Determine category (health/ecology/economy)
   - Assign severity score
                ↓
4. Group articles by topic (keyword matching)
   - Check existing topic_keywords table
   - Create new topics if needed
                ↓
5. Pass 2: Score topics with LLM
   For each topic:
   - Aggregate article severities
   - Compute overall impact score (0-100)
   - Determine urgency (breaking/critical/moderate/info)
                ↓
6. Upsert topics in database
   INSERT ... ON CONFLICT (slug) DO UPDATE
   SET previous_score = current_score,
       current_score = new_score
                ↓
7. Insert articles (with deduplication)
   INSERT ... ON CONFLICT (url) DO NOTHING
                ↓
8. Insert score history snapshots
   INSERT INTO score_history (topic_id, score, ...)
                ↓
9. Audit log (batch completion)
                ↓
10. Return { success: true, stats: { ... } }
```

---

## Component Architecture

### Component Hierarchy

```
RootLayout (layout.tsx)
├── <html>
│   ├── <head>
│   └── <body>
│       └── ThemeProvider (Client)
│           ├── FOUC Prevention Script
│           ├── TickerBar (Client)
│           │   └── TickerItem[] (links to topics)
│           ├── ThemeToggle (Client)
│           └── {children} (Page Content)
│               ├── Dashboard (page.tsx)
│               │   ├── <h1>Environmental Impact Dashboard</h1>
│               │   ├── BiggestMovers (Client)
│               │   │   └── TopicCard[] (Server)
│               │   └── TopicGrid (Client)
│               │       └── TopicCard[] (Server)
│               │           ├── UrgencyBadge (Server)
│               │           └── Sparkline (Server)
│               └── Topic Detail ([slug]/page.tsx)
│                   ├── <h1>{topic.title}</h1>
│                   ├── ScoreChart (Client)
│                   └── ArticleList (Server)
```

### Component Responsibilities

| Component | Type | Responsibility |
|-----------|------|----------------|
| **RootLayout** | Server | HTML structure, font, ThemeProvider wrapper |
| **ThemeProvider** | Client | Theme context (light/dark), localStorage sync |
| **ThemeToggle** | Client | Toggle button, fixed position |
| **TickerBar** | Client | Auto-refresh, fetch ticker data, scrolling animation |
| **TopicGrid** | Client | Fetch topics, filter state, grid layout |
| **TopicCard** | Server | Display topic summary, static rendering |
| **BiggestMovers** | Client | Fetch movers, horizontal scroll |
| **Sparkline** | Server | Render mini chart (Recharts) |
| **ScoreChart** | Client | Render full chart, theme-aware colors |
| **ArticleList** | Server | Display article list, external links |
| **UrgencyBadge** | Server | Color-coded urgency label |

---

## Database Design

### Schema Philosophy

**Principles:**
1. **Normalization:** 3NF to reduce redundancy
2. **Foreign Keys:** Enforce referential integrity with CASCADE deletes
3. **Indexes:** Strategic indexes on frequently queried columns
4. **Constraints:** CHECK constraints for data quality (score ranges, enums)
5. **Timestamps:** Track creation and updates

### Table Dependencies

```
topics (root entity)
  ├─→ articles (FK: topic_id)
  ├─→ score_history (FK: topic_id)
  └─→ topic_keywords (FK: topic_id)

audit_logs (standalone, no FK)
```

### Cascade Delete Strategy

**Deleting a topic removes:**
- All associated articles
- All score history entries
- All topic keywords

**Rationale:** Topics are the root entity; related data has no meaning without the topic.

### Denormalization: article_count

**Pattern:** Cached count in topics table to avoid expensive COUNT queries.

```sql
-- Update trigger (not implemented, manual refresh)
UPDATE topics
SET article_count = (SELECT COUNT(*) FROM articles WHERE topic_id = topics.id)
WHERE id = $1;
```

**Trade-off:** Slight data staleness for significant read performance gain.

---

## API Design

### REST Principles

**Endpoints follow RESTful patterns:**
- `GET /api/topics` — List resources
- `GET /api/topics/[slug]` — Get single resource
- `POST /api/topics` — Create resource (if implemented)
- `PUT /api/topics/[slug]` — Update resource (if implemented)
- `DELETE /api/topics` — Delete resources

### Response Format

**Success:**
```json
{
  "topics": [...],
  "pagination": { "total": 100, "limit": 20, "offset": 0 }
}
```

**Error:**
```json
{
  "error": "Error message",
  "status": 400,
  "requestId": "req_abc123",
  "details": { ... }  // Development only
}
```

### Rate Limiting Headers

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Reset: 1707484800
```

### Authentication Header

```http
POST /api/articles
X-API-Key: <admin_api_key>
Content-Type: application/json
```

---

## Security Architecture

### Defense in Depth

**Layer 1: Network (Nginx)**
- Reverse proxy hides internal services
- Rate limiting (nginx level, optional)
- Security headers (CSP, X-Frame-Options, etc.)
- HTTPS termination (production)

**Layer 2: Application (Next.js)**
- API key authentication for writes
- Rate limiting (in-memory, per-IP)
- Input validation (Zod schemas)
- Error sanitization (hide stack traces in production)
- Audit logging (all write operations)

**Layer 3: Database (PostgreSQL)**
- Parameterized queries (SQL injection prevention)
- Foreign key constraints (data integrity)
- CHECK constraints (value ranges)
- Connection pooling (prevent connection exhaustion)

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **SQL Injection** | Parameterized queries (pg library) |
| **XSS** | React auto-escaping, CSP headers |
| **CSRF** | SameSite cookies (future), API key for writes |
| **Rate Limit Abuse** | In-memory rate limiter (100/min read, 10/min write) |
| **Unauthorized Writes** | API key authentication (X-API-Key header) |
| **Data Leakage** | Environment-aware error messages (production hides details) |
| **DDoS** | Rate limiting, nginx connection limits |
| **Secret Exposure** | .env files, .gitignore, Railway env vars |

### Audit Trail

**All write operations logged:**
- Timestamp, IP address, endpoint, method
- Action type (create_article, delete_topic, etc.)
- Success/failure status
- Error messages (if failed)
- Request details (JSON string)
- User agent

**Query audit logs:**
```sql
-- Recent failures
SELECT * FROM audit_logs
WHERE success = false
ORDER BY timestamp DESC
LIMIT 20;

-- Top actions
SELECT action, COUNT(*) as count
FROM audit_logs
GROUP BY action
ORDER BY count DESC;
```

---

## Deployment Architecture

### Docker Multi-Container Setup

```
┌─────────────────────────────────────────────────────────────┐
│                         Docker Host                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  nginx (port 80)                                        │ │
│  │  • Reverse proxy to app:3000                            │ │
│  │  • Static asset caching (/_next/static)                 │ │
│  │  • Gzip compression                                     │ │
│  │  • Security headers                                     │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────────┐ │
│  │  app (Next.js, port 3000, internal)                     │ │
│  │  • Standalone build (output: "standalone")              │ │
│  │  • Memory limit: 1GB                                    │ │
│  │  • Auto-restart: always                                 │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────────┐ │
│  │  postgres (port 5432, internal)                         │ │
│  │  • PostgreSQL 16 Alpine                                 │ │
│  │  • Named volume: pgdata                                 │ │
│  │  • Health check: pg_isready                             │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  cron (Alpine crond)                                   │ │
│  │  • Daily batch at 6AM UTC                              │ │
│  │  • Triggers POST app:3000/api/cron/batch               │ │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Railway Architecture

```
Railway Project
├── Service: PostgreSQL (managed)
│   ├── DATABASE_URL automatically provided
│   ├── Automatic backups
│   └── Connection pooling
│
├── Service: Next.js App (from Dockerfile)
│   ├── Auto-deploy on push to main
│   ├── Environment variables from Railway dashboard
│   ├── Build: docker build
│   ├── Exposed port: 3000
│   └── Health check: GET /api/health
│
└── Cron (external trigger via Railway Cron or GitHub Actions)
    └── Schedule: 0 6 * * * (daily at 6AM UTC)
    └── Endpoint: POST https://your-app.railway.app/api/cron/batch
```

---

## Scalability Considerations

### Current Limitations (Demo/Personal Scale)

1. **In-Memory Rate Limiting:** Resets on server restart, not shared across instances
2. **Single Database Connection Pool:** 20 connections max
3. **No Caching Layer:** Every request hits database
4. **No CDN:** Static assets served by Next.js/Nginx

### Scaling to Production (100K+ Users)

**Horizontal Scaling:**
```
┌────────────────────────────────────────────────────┐
│  Load Balancer (AWS ALB / Cloudflare)              │
└────────┬────────────┬────────────┬─────────────────┘
         │            │            │
    ┌────▼───┐   ┌────▼───┐   ┌────▼───┐
    │ App 1  │   │ App 2  │   │ App 3  │  (Auto-scaling group)
    └────┬───┘   └────┬───┘   └────┬───┘
         │            │            │
         └────────────┴────────────┘
                      │
         ┌────────────▼────────────┐
         │  PostgreSQL (RDS/PgBouncer) │
         │  • Read replicas          │
         │  • Connection pooling     │
         └───────────────────────────┘
```

**Caching Layer:**
```
Client → CDN (Cloudflare/Fastly)
         └─→ Cache Miss → Load Balancer → App → Redis Cache
                                                 └─→ Cache Miss → PostgreSQL
```

**Rate Limiting (Redis):**
```typescript
// Replace in-memory with Redis-backed rate limiter
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(ip: string, type: string): Promise<boolean> {
  const key = `ratelimit:${type}:${ip}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  return count <= limits[type].maxRequests;
}
```

**Database Optimization:**
- Read replicas for GET endpoints
- PgBouncer for connection pooling (thousands of connections)
- Materialized views for expensive aggregations
- Partitioning for score_history (by month)

**Background Jobs:**
- Move batch processing to queue (BullMQ/Redis)
- Parallel processing of articles
- Separate worker processes

**Monitoring:**
- Application Performance Monitoring (DataDog/New Relic)
- Database query analysis (pg_stat_statements)
- Error tracking (Sentry)
- Uptime monitoring (UptimeRobot/Pingdom)

---

## Design Decisions

### Why Next.js App Router?

**Pros:**
- Server Components reduce client bundle size
- Streaming SSR for faster perceived performance
- Built-in API routes (no separate backend)
- Excellent TypeScript support

**Cons:**
- Steeper learning curve than Pages Router
- Some third-party libraries not yet compatible

**Decision:** App Router is the future of Next.js; worth the investment.

---

### Why PostgreSQL over SQLite?

**Pros:**
- Production-ready (Railway, AWS RDS support)
- Better concurrency (no file locking issues)
- Richer data types (JSON, arrays)
- Robust transaction support

**Cons:**
- More complex setup (requires server)
- Higher resource usage

**Decision:** PostgreSQL for production deployment, pg-mem for testing.

---

### Why pg over Prisma/TypeORM?

**Pros:**
- Direct SQL control (performance optimization)
- No ORM overhead
- Simpler debugging
- Smaller bundle size

**Cons:**
- Manual query writing (more verbose)
- No type-safe query builder
- Schema changes require SQL knowledge

**Decision:** Raw SQL for full control; project is small enough to manage manually.

---

### Why In-Memory Rate Limiting?

**Pros:**
- Zero external dependencies
- Fast (no network calls)
- Simple implementation

**Cons:**
- Not shared across instances
- Resets on restart
- No persistence

**Decision:** Sufficient for demo/personal projects; upgrade to Redis for production.

---

### Why Zod over Joi/Yup?

**Pros:**
- TypeScript-native (no code generation)
- Type inference (DRY principle)
- Great error messages
- Active development

**Cons:**
- Smaller ecosystem than Joi

**Decision:** Best TypeScript validation library in 2026.

---

**Last Updated:** 2026-02-09
