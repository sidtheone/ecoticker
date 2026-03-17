# 2. API Layer

## Support Infrastructure

### Authentication (`src/lib/auth.ts`)

**`requireAdminKey(request: NextRequest): boolean`**
- Reads `X-API-Key` header
- Compares against `process.env.ADMIN_API_KEY` using `crypto.timingSafeEqual` (constant-time, prevents timing attacks)
- Length-mismatch check runs first to avoid `timingSafeEqual` throwing
- Returns `false` if `ADMIN_API_KEY` is unset

**`getUnauthorizedResponse(): NextResponse`**
- Returns `{ error: "Unauthorized - Valid API key required" }` with HTTP 401
- Adds `WWW-Authenticate: API-Key` header

---

### Rate Limiting (`src/lib/rate-limit.ts`)

**Algorithm:** Fixed-window (not sliding). Window starts on first request; resets after `interval` ms.

**Store:** In-memory, keyed by IP. Process-local — not shared across instances, doesn't survive restarts.

**Three pre-built instances:**

| Instance | Window | Limit | Used for |
|---|---|---|---|
| `readLimiter` | 60s | 100 req | GET/HEAD requests |
| `writeLimiter` | 60s | 10 req | POST/PUT/DELETE (non-batch/seed) |
| `batchLimiter` | 3600s | 2 req | Paths containing `/batch` or `/seed` |

**Methods:**
- `check(identifier): boolean` — allow/deny
- `getResetTime(identifier): number` — Unix timestamp (ms)

---

### Middleware (`src/middleware.ts`)

**Runs on:** All paths except `_next/static`, `_next/image`, `favicon.ico`, common static extensions.

**Rate-limit selection:**
```
if path contains /batch OR /seed → batchLimiter
else if method is not GET or HEAD → writeLimiter
else                              → readLimiter
```

**IP extraction order:** `x-forwarded-for` → `x-real-ip` → `"unknown"`.

**On exceed:** HTTP 429 `"Too Many Requests"` with `Retry-After` and `X-RateLimit-Reset` headers.

**Security headers added to every response:**
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Content-Security-Policy`: default-src 'self', script-src 'self' 'unsafe-inline', style-src 'self' 'unsafe-inline', img-src 'self' data: https:, connect-src 'self', font-src 'self' data:

---

### Error Handling (`src/lib/errors.ts`)

**`createErrorResponse(error, userMessage, statusCode=500): NextResponse`**
- Logs full error with generated `requestId` (`req_{timestamp}_{random}`)
- **Development**: includes `details: error.message`
- **Production**: body contains only `error`, `requestId`, `timestamp`

---

### Audit Logging (`src/lib/audit-log.ts`)

**GDPR IP truncation (`truncateIP`):**
- IPv4: zeroes last octet (`192.168.1.123` → `192.168.1.0`)
- IPv6: keeps first 3 segments (`2001:db8:85a3:...` → `2001:db8:85a3::0`)

**IP extraction:** `cf-connecting-ip` (Cloudflare) → `x-forwarded-for` → `x-real-ip` → `"unknown"`.

**`logAuditEvent(request, action, success, details?, errorMessage?)`** — inserts one row. Failures swallowed silently.

**`logSuccess` / `logFailure`** — thin wrappers.

**`getAuditLogs(limit, offset)`** — paginated query, deserializes JSON details.

**`getAuditStats()`** — aggregate totals, recent failures (24h), top actions (7d).

---

## Route Handlers (12 routes, 18 handlers)

### `GET /api/topics`

| Detail | Value |
|---|---|
| Auth | None (public) |
| Rate limit | readLimiter (100/min) |
| Cache-Control | `public, max-age=300, stale-while-revalidate=600` |

**Query params:**
- `urgency` — must be one of: breaking, critical, moderate, informational (400 on invalid)
- `category` — must be one of 10 valid categories (400 on invalid)

**Query:** All topics sorted by `current_score DESC`. Lateral subquery fetches last 7 score_history entries as comma-delimited string → split, map to numbers, reverse (chronological).

**Response:** `{ topics: Topic[] }` with computed `change` and `sparkline` fields.

---

### `DELETE /api/topics`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Rate limit | writeLimiter (10/min) |
| Audit | `delete_topics` |

**Body (Zod):** `{ ids: number[] }` OR `{ articleCount: number }` (at least one required).

**Cascade delete (FK order):** topic_keywords → score_history → articles → topics.

**Response:** `{ success: true, deleted: N, message: "Deleted N topic(s)" }`

---

### `GET /api/topics/[slug]`

| Detail | Value |
|---|---|
| Auth | None |
| Cache-Control | `public, max-age=300, stale-while-revalidate=600` |

**Query:** Drizzle relational `findFirst` with eager loads — articles (DESC by published_at), score_history (ASC by recorded_at).

**Response:** `{ topic: Topic, articles: Article[], scoreHistory: ScoreHistoryEntry[] }`

**404** if slug not found.

---

### `GET /api/articles`

| Detail | Value |
|---|---|
| Auth | None |

**Query params:** topicId, source, url (exact match), limit (default 50, max 500), offset (default 0).

**Response:** `{ articles: [...], pagination: { total, limit, offset, hasMore } }`

---

### `POST /api/articles`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Audit | `create_article` |

**Body (Zod `articleCreateSchema`):** topicId, title, url, source?, summary?, imageUrl?, publishedAt?

**Operations:**
1. Verify topic exists (404 if not)
2. `INSERT ... ON CONFLICT (url) DO NOTHING RETURNING *` (409 if duplicate)
3. Increment topic `article_count`

Sets `sourceType: "api"`. Response: 201 with article.

---

### `DELETE /api/articles`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Audit | `delete_articles` |

**Body (Zod):** Delete by ids, url (LIKE), topicId, or source. At least one required.

Post-delete: recounts `article_count` per affected topic.

**Response:** `{ success: true, deleted: N, affectedTopics: N }`

---

### `GET /api/articles/[id]`

Single article + joined topic (id, name, slug). 400 if invalid ID, 404 if not found.

---

### `PUT /api/articles/[id]`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Audit | `update_article` |

**Body (Zod `articleUpdateSchema`):** All fields optional, at least one required.

---

### `DELETE /api/articles/[id]`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Audit | `delete_article` |

Recounts topic `article_count` after delete.

---

### `GET /api/ticker`

| Detail | Value |
|---|---|
| Auth | None |
| Cache-Control | `public, max-age=300, stale-while-revalidate=600` |

Top 15 topics: `{ items: [{ name, slug, score, change }] }`. Lightweight.

---

### `GET /api/movers`

| Detail | Value |
|---|---|
| Auth | None |
| Cache-Control | `public, max-age=300, stale-while-revalidate=600` |

Top 5 by absolute change magnitude. Excludes zero-change topics.

**Response:** `{ movers: [{ name, slug, currentScore, previousScore, change, urgency }] }`

---

### `POST /api/batch`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Rate limit | batchLimiter (2/hr) |
| Audit | `batch_process` |

Pre-checks `GNEWS_API_KEY` + `OPENROUTER_API_KEY` (500 if missing).

Calls `runBatchPipeline({ mode: "daily", db })`.

**Response:** `{ success, message, stats: { topicsProcessed, articlesAdded, scoresRecorded, totalTopics, totalArticles, gnewsArticles, rssArticles }, timestamp }`

---

### `GET /api/cron/batch`

| Detail | Value |
|---|---|
| Auth | Bearer CRON_SECRET |
| Rate limit | batchLimiter (2/hr) |

**Branch logic:**
- API keys present → `runBatchPipeline()` → `mode: "real-data"`
- API keys missing → calls seed handler directly → `mode: "demo-data"`

Missing CRON_SECRET → 500.

---

### `POST /api/cron/batch`

Same file, same branch logic. Adds `"manual": true` to response. Missing CRON_SECRET → 401 (not 500).

---

### `POST /api/seed`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Rate limit | batchLimiter (2/hr) |
| Audit | `seed_database` |

Full wipe + repopulate: 10 demo topics × 4 articles × 7 days score history. Idempotent.

Topic upsert via `.onConflictDoUpdate()` on slug. Article insert via `.onConflictDoNothing()`.

---

### `POST /api/cleanup`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |
| Audit | `cleanup_data` |

Detects demo data via heuristics: topics with exactly 4 articles + articles with `example.com` URLs.

`?dryRun=true` for preview mode.

Cascade delete: keywords → history → articles → topics.

---

### `GET /api/audit-logs`

| Detail | Value |
|---|---|
| Auth | X-API-Key required |

`?stats=true` for aggregate mode. Otherwise paginated logs with `limit` (default 100, max 1000) and `offset`.

---

### `GET /api/health`

| Detail | Value |
|---|---|
| Auth | None |

Queries `MAX(recorded_at)` from score_history. `isStale = true` if >24h or null.

**Response:** `{ lastBatchAt: "YYYY-MM-DD" | null, isStale: boolean }`

---

## Auth Matrix

| Route | Method | Auth | Type |
|---|---|---|---|
| /api/topics | GET | No | — |
| /api/topics | DELETE | Yes | X-API-Key |
| /api/topics/[slug] | GET | No | — |
| /api/articles | GET | No | — |
| /api/articles | POST | Yes | X-API-Key |
| /api/articles | DELETE | Yes | X-API-Key |
| /api/articles/[id] | GET | No | — |
| /api/articles/[id] | PUT | Yes | X-API-Key |
| /api/articles/[id] | DELETE | Yes | X-API-Key |
| /api/ticker | GET | No | — |
| /api/movers | GET | No | — |
| /api/batch | POST | Yes | X-API-Key |
| /api/cron/batch | GET | Yes | Bearer CRON_SECRET |
| /api/cron/batch | POST | Yes | Bearer CRON_SECRET |
| /api/seed | POST | Yes | X-API-Key |
| /api/cleanup | POST | Yes | X-API-Key |
| /api/audit-logs | GET | Yes | X-API-Key |
| /api/health | GET | No | — |

## Audit Log Coverage

| Action | Route |
|---|---|
| `create_article` | POST /api/articles |
| `update_article` | PUT /api/articles/[id] |
| `delete_article` | DELETE /api/articles/[id] |
| `delete_articles` | DELETE /api/articles |
| `delete_topics` | DELETE /api/topics |
| `batch_process` | POST /api/batch |
| `seed_database` | POST /api/seed |
| `cleanup_data` | POST /api/cleanup |

## Notable Inconsistencies

1. `/api/ticker` and `/api/movers` error handling uses inline `console.error + NextResponse.json` instead of `createErrorResponse` — 500 responses lack `requestId`.
2. `/api/topics GET` and `/api/topics/[slug] GET` have no try/catch — DB errors propagate unhandled.
3. DELETE /api/articles URL filter uses `LIKE` (wildcards), while GET uses exact match.
4. In-memory rate limiter is not shared across multiple instances.
