# 3. Batch Pipeline

**File:** `src/lib/batch-pipeline.ts` (1,312 lines)

## Design Rules

1. **No imports from `@/db`** — DB handle always injected as parameter (testability)
2. **No module-level env var captures** — getter functions (`getGnewsApiKey()`, `getOpenRouterConfig()`, `getKeywords()`, `getRssFeeds()`) so Jest can override `process.env`
3. **`rss-parser` singleton** at module scope for connection reuse

## Three Modes

| Mode | Fetch | Classify | Score | Persist |
|---|---|---|---|---|
| `daily` | GNews + RSS | Yes | Yes | Yes |
| `backfill-full` | GNews only (date range) | Yes | Yes | Yes |
| `backfill-rescore` | None (loads from DB) | No | Yes | Yes |

---

## Complete Flow (daily mode)

### Step 1 — Article Fetching

GNews and RSS fetched concurrently via `Promise.allSettled`. Each can fail independently.

#### GNews (`fetchNews`)

- Reads `BATCH_KEYWORDS` env var (default: `"climate change,pollution,deforestation,wildfire,flood"`)
- Batches keywords in groups of 4 joined with `" OR "`, one API call per group
- URL: `https://gnews.io/api/v4/search?q=...&lang=en&max=10&sortby=publishedAt&token=...`
- Backfill mode adds `&from=YYYY-MM-DD&to=YYYY-MM-DD`
- Timeout: `AbortSignal.timeout(15000)` (15s)
- Inline filters: rejects `bringatrailer`, `auction`, `ebay` sources; requires title + description
- Post-fetch: deduplicates by URL, filters `BLOCKED_DOMAINS` (`lifesciencesworld.com`, `alltoc.com`)

#### RSS (`fetchRssFeeds`)

- `rss-parser` singleton with `timeout: 15000`, `User-Agent: EcoTicker/1.0`
- 10 default feeds: The Guardian, Grist, Carbon Brief, Inside Climate News, EIA, European Environment Agency, EcoWatch, NPR, Down To Earth, India Mongabay
- Overridable via `RSS_FEEDS` env var (comma-separated URLs)
- All feeds fetched in parallel via `Promise.allSettled`
- Skips items missing title, link, or date
- Returns `articles: NewsArticle[]` + `feedHealth: FeedHealth[]` (per-feed status, count, duration)

#### Merge (`mergeAndDedup`)

- RSS articles placed first — RSS wins on URL collisions
- Deduplicates by URL, re-applies blocked domain filter
- Returns merged articles, `sourceMap` (URL → "rss" | "gnews"), raw counts per source
- Warns if one source returns 0 while the other has results

---

### Step 2 — LLM Classification (Pass 1)

Loads all existing topics from DB with keyword arrays (via `STRING_AGG`), then passes articles to `classifyArticles()` in batches of 10.

**Classification prompt (`buildClassificationPrompt`) instructs:**
- Filter non-environmental articles (celebrity, sports, Q&A/educational, listicles, question-mark titles)
- Apply 4-point newsworthiness test: specific recent event, date/location/actor, journalism format, statement title
- Group into existing or new topics
- Response format: `{"classifications": [{"articleIndex": 0, "topicName": "...", "isNew": false}], "rejected": [1, 3], "rejectionReasons": [...]}`

**LLM call:** `jsonMode: false` (plain text with embedded JSON, extracted via `extractJSON()` regex)

**Fallback:** Unparseable response → group everything under "Environmental News"

---

### Step 3 — Per-Topic Scoring (Pass 2) + DB Writes

For each topic group, sequentially:

#### 3a. Duplicate Pre-Check
Query DB for which URLs already exist. If all articles are duplicates → skip topic entirely (prevents ghost scoring).

#### 3b. LLM Scoring (`scoreTopic`)
**Prompt (`buildScoringPrompt`):**
- Topic name + all article titles/descriptions
- Full rubric for 3 dimensions (health, ecological, economic)
- 4 few-shot calibration examples (one per severity level)
- `temperature: 0` (greedy decoding)
- `response_format: { type: "json_object" }` (`jsonMode: true`)
- Timeout: `AbortSignal.timeout(30000)` (30s)

#### 3c. Score Validation (`processScoreResult`)
`validateScore(level, score)` clamps to level ranges:
| Level | Range |
|---|---|
| MINIMAL | 0-25 |
| MODERATE | 26-50 |
| SIGNIFICANT | 51-75 |
| SEVERE | 76-100 |

Clamping logged as warning. >30% batch clamp rate triggers model drift warning.

#### 3d. Overall Score (`computeOverallScore`)
Weighted average of valid dimensions:
| Dimension | Weight |
|---|---|
| Ecological | 40% |
| Health | 35% |
| Economic | 25% |

INSUFFICIENT_DATA (-1) dimensions excluded, remaining weights renormalized. All -1 → fallback 50.

#### 3e. Urgency Derivation (`deriveUrgency`)
- 80+ → "breaking"
- 60-79 → "critical"
- 30-59 → "moderate"
- 0-29 → "informational"

#### 3f. Anomaly Detection (`detectAnomaly`)
Per-dimension: if |new - stored| > 25 points → `anomalyDetected = true`, warning logged.

#### 3g. Topic Upsert
`INSERT ... ON CONFLICT (slug) DO UPDATE`:
- Rotates `previousScore = currentScore`
- Sets new `currentScore`
- Increments `articleCount` by new articles only (not total)
- `COALESCE(newUrl, existingUrl)` for image

#### 3h. Article Insert
Only pre-filtered new articles. `ON CONFLICT (url) DO NOTHING` safety net.

#### 3i. Score History Insert
Full audit trail: all reasoning, levels, raw LLM JSON (JSONB), anomaly flag.
Conflict: `(topic_id, recorded_at)` — upserts on same-day re-run.

#### 3j. Keyword Insert
From LLM response, `ON CONFLICT DO NOTHING`.

---

### Step 4 — Cleanup + Summary

Purge audit_logs > 90 days (GDPR data minimization).
Query final `COUNT(*)` on topics and articles.
Return `BatchPipelineResult`.

---

## LLM Call Details

```
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json

{
  "model": "<OPENROUTER_MODEL>",
  "messages": [{"role": "user", "content": "<prompt>"}],
  "temperature": 0,
  "response_format": {"type": "json_object"}  // scoring calls only
}
```

- Default model: `meta-llama/llama-3.1-8b-instruct:free`
- Production: `mistralai/mistral-small-3.2-24b-instruct`
- Bad JSON fallback: `extractJSON()` regex → still bad → all-MODERATE/50

---

## Error Handling

| Stage | Behavior |
|---|---|
| GNews keyword batch | `continue` — skip group, log error |
| GNews `errors[]` | Log with status context (401/429), continue |
| RSS feed failure | Per-feed logged in feedHealth, skipped |
| Classification LLM | Returns `[]`, fallback to "Environmental News" |
| Scoring LLM / bad JSON | Default all-MODERATE/50 scores |
| Per-topic processing | `catch` → log error, continue to next topic |
| DB write failure | Propagates to caller |

---

## Three Callers of `runBatchPipeline`

| Caller | Auth | Mode | When |
|---|---|---|---|
| `POST /api/batch` | X-API-Key | daily | Manual HTTP trigger |
| `GET/POST /api/cron/batch` | Bearer CRON_SECRET | daily | GHA cron 6AM/6PM UTC |
| `scripts/batch.ts` | None (direct DB) | Configurable via CLI | Docker crond 6AM UTC |

---

## Scripts

### `scripts/batch.ts`
CLI entry point. Creates own `pg.Pool` + `drizzle`. Loads `.env` via `dotenv/config`.
- `--mode <daily|backfill-full|backfill-rescore>`
- `--from <ISO>`, `--to <ISO>`, `--days <n>`

### `scripts/seed.ts`
13 realistic topics, 3 articles each, 7 days score history with ±10 variance per dimension. Uses `computeOverallScore` and `scoreToLevel` from scoring module. Full wipe before insert.

### `scripts/rss.ts`
Re-export shim for `fetchRssFeeds`, `feedHostname`, `DEFAULT_FEEDS` from batch-pipeline.ts. Preserves test import path.

### `scripts/fix-article-counts.ts`
Data repair: compares denormalized `article_count` against actual `COUNT(articles.id)`. Supports `--dry-run`.

### `scripts/dedup-score-history.ts`
Finds duplicate `(topic_id, recorded_at)` pairs, keeps highest id, deletes rest. Supports `--dry-run`.

---

## Scoring Module (`src/lib/scoring.ts`)

Pure functions + constants:

- `LEVEL_RANGES`: `{MINIMAL:[0,25], MODERATE:[26,50], SIGNIFICANT:[51,75], SEVERE:[76,100]}`
- `DIMENSION_WEIGHTS`: `{eco:0.4, health:0.35, econ:0.25}` (sum = 1.0)
- `validateScore(level, score)` — clamp to range
- `computeOverallScore(scores)` — weighted average with renormalization
- `deriveUrgency(score)` — threshold mapping
- `detectAnomaly(newScore, previousScore)` — >25pt delta
- `scoreToLevel(score)` — reverse mapping
