# Epic 4: Operational Resilience

**Status:** done
**Phase:** 4 — Resilience
**Goal:** Eliminate single point of failure on NewsAPI by integrating curated RSS feeds as a parallel news source with source attribution, and align the route.ts batch pipeline with the US-1.0 scoring architecture.
**Research:** `_bmad-output/planning-artifacts/research/domain-rss-environmental-news-feeds-research-2026-02-17.md`

## Context

NewsAPI quality has been lagging. Domain research identified 10 high-quality RSS feeds across EU, USA, and India covering climate, energy, biodiversity, and policy. All feeds are free, open, and legally clear for EcoTicker's transformative use (scoring + link-back). The `rss-parser` npm package handles RSS 2.0 + Atom with TypeScript support.

**Default RSS feeds (from research):**
1. The Guardian Environment (EU/Global, 10-20/day)
2. Grist (Global, 5-10/day, full-text)
3. Carbon Brief (UK/EU climate, 3-5/day)
4. InsideClimate News (USA/Global climate, 3-8/day)
5. EIA Today in Energy (USA energy, 1-3/day)
6. EEA Press Releases (EU policy, 2-5/week)
7. EcoWatch (Global biodiversity, 5-10/day)
8. NPR Environment (USA, 3-8/day)
9. Down To Earth (India, 5-15/day)
10. Mongabay India (India biodiversity, 3-5/day)

**Combined volume: ~40-90 articles/day across 3 regions.**

---

## Story 4.1: RSS feed fetching and parsing (US-5.1a)
**Status:** done
**Size:** S
**Estimated Effort:** 2-3 hours
**Description:** Add `rss-parser` dependency and create an `fetchRssFeeds()` function that fetches and parses all feeds from the `RSS_FEEDS` env var. Returns normalized `NewsArticle[]`. Does NOT integrate into batch pipeline yet — this story is parsing only.
**Dependencies:** None

**Acceptance Criteria:**
- `rss-parser` added as dependency
- `RSS_FEEDS` env var: comma-separated feed URLs
- Default value: all 10 researched feeds (see Context above)
- `fetchRssFeeds()` function in `scripts/rss.ts`:
  - Parallel fetch all feeds with 15s timeout per feed
  - Parse RSS 2.0 and Atom via `rss-parser`
  - Map each item to `NewsArticle` interface: title, description (contentSnippet), url (link), publishedAt (pubDate), source (feed.title)
  - Set `sourceType = 'rss'` on all RSS articles
  - Individual feed failures logged but don't block other feeds
  - Returns combined array from all successful feeds
- User-Agent header set to `EcoTicker/1.0`
- Unit tests with mocked feed XML (RSS 2.0 and Atom formats)
- Tests cover: successful parse, timeout handling, malformed XML, empty feed

**Dev Notes:**
- Use `new Parser({ timeout: 15000, headers: { 'User-Agent': 'EcoTicker/1.0' } })`
- Map: `item.link` → url, `item.contentSnippet || item.content` → description, `item.isoDate || item.pubDate` → publishedAt, `feed.title` → source
- Export function for Story 4.2 to import

---

## Story 4.2: Integrate RSS into batch pipeline (US-5.1b)
**Status:** done
**Size:** S
**Estimated Effort:** 2-3 hours
**Description:** Wire `fetchRssFeeds()` into the existing batch pipeline alongside NewsAPI. Both sources run in parallel. Articles merged and deduped before scoring.
**Dependencies:** Story 4.1

**Acceptance Criteria:**
- Batch pipeline fetches NewsAPI and RSS in parallel (`Promise.allSettled`)
- Both sources contribute to the same article pool
- If NewsAPI fails, RSS articles still proceed to scoring
- If RSS fails, NewsAPI articles still proceed to scoring
- If BOTH fail → critical error, exit without scoring
- Dedup via existing UNIQUE constraint on `articles.url` (ON CONFLICT DO NOTHING)
- Batch log indicates: NewsAPI article count, RSS article count, total after dedup
- `source_type` column set on insert: `'newsapi'` or `'rss'`
- Integration tests with mocked NewsAPI + mocked RSS feeds
- Tests cover: both succeed, NewsAPI fails/RSS succeeds, RSS fails/NewsAPI succeeds, both fail

**Dev Notes:**
- `Promise.allSettled([fetchNewsAPI(), fetchRssFeeds()])` — neither blocks the other
- Log format: `"Sources: NewsAPI=${n} RSS=${m} → Total=${t} (after dedup)"`
- The `sourceType` column already exists in schema but `batch.ts` doesn't set it yet — add it to the insert

---

## Story 4.3: Source attribution badge (US-5.2)
**Status:** done
**Size:** S
**Estimated Effort:** 1-2 hours
**Description:** Show source type indicator next to each article's source name in ArticleList. Uses the `sourceType` field now populated by Story 4.2.
**Dependencies:** Story 4.2

**Acceptance Criteria:**
- ArticleList displays source attribution: "Reuters · GNews" or "The Guardian · RSS"
- Badge styling: subtle, muted text, doesn't clutter the article list
- Dark mode compatible
- If `sourceType` is null/empty, show source name only (backwards compatible)
- Component tests verify badge renders for both source types
- Tests verify graceful fallback when sourceType is missing

**Dev Notes:**
- `sourceType` already exists on the `Article` TypeScript interface
- Small inline badge, not a separate component — keep it simple
- Use muted text color: `text-stone-400 dark:text-stone-500`

---

## Story 4.4: RSS feed health logging (US-5.1c)
**Status:** done
**Size:** S
**Estimated Effort:** 1-2 hours
**Description:** Add per-feed health reporting to batch output so operators can monitor which feeds are healthy, degraded, or failing.
**Dependencies:** Story 4.2

**Acceptance Criteria:**
- Batch log includes per-feed status: feed name, fetch duration (ms), article count, success/failure
- Failed feeds include error message (timeout, parse error, HTTP status)
- Summary line: `"Feed health: 8/10 healthy, 2 failed [EcoWatch: timeout, EEA: 503]"`
- Health data available in batch log output (no new API endpoint needed for now)
- Tests verify health logging for mixed success/failure scenarios

**Dev Notes:**
- Track per-feed: `{ name, url, status: 'ok'|'error', articleCount, durationMs, error? }`
- This is logging only — no new database table or API endpoint
- Future enhancement: `/api/feed-health` endpoint (not in this epic)

---

## Story 4.5: Align route.ts scoring pipeline with US-1.0 rubric (US-1.0b)
**Status:** done
**Size:** S
**Estimated Effort:** 3-4 hours
**Description:** The `route.ts` batch pipeline still uses a simplified "rate 0-100" scoring prompt with temperature 0.3 and no validation. Align it with the full US-1.0 rubric-based scoring from `scripts/batch.ts`: deterministic temperature, 4-level severity rubric, few-shot calibration, server-side weighted aggregation, score clamping, and anomaly detection.
**Dependencies:** None (independent of RSS stories)
**Source:** Code review finding H1 from emergency-replace-newsapi-with-gnews story. See `docs/plans/2026-02-21-reconcile-batch-scoring-pipelines.md`.

**Acceptance Criteria:**
- `route.ts` uses `temperature: 0` and `response_format: { type: "json_object" }` for scoring
- Scoring prompt matches `scripts/batch.ts` rubric (4-level severity, reasoning-first, INSUFFICIENT_DATA)
- Few-shot calibration examples included
- `validateScore()`, `computeOverallScore()`, `deriveUrgency()`, `detectAnomaly()` called from `src/lib/scoring.ts`
- Server-side weighted aggregation (Eco 40%, Health 35%, Econ 25%) — NOT LLM-returned score/urgency
- Batch-level clamping warning when >30% of dimensions clamped
- `scoreHistory` insert includes dimension reasoning, levels, `rawLlmResponse`, `anomalyDetected`
- LLM timeout changed from 60s to 30s (project standard)
- `scripts/batch.ts` unchanged (no regressions)
- All existing tests pass; new tests cover clamping, anomaly detection, INSUFFICIENT_DATA, server-side computation

**Dev Notes:**
- Option A (copy & align) — no shared module extraction yet (future DRY refactoring story)
- Import shared scoring functions from `src/lib/scoring.ts`, do NOT duplicate
- `TopicScore` interface in `route.ts` needs expanding to match `scripts/batch.ts` output shape

---

## Story 4.6: Align route.ts classification pipeline (US-1.0c)
**Status:** done
**Size:** S
**Estimated Effort:** 2-3 hours
**Description:** The `route.ts` classification prompt uses a simplified classifier without newsworthiness testing. Align it with `scripts/batch.ts`: full newsworthiness test (4 criteria), Q&A/listicle rejection, and rejection logging with relevance rate.
**Dependencies:** Story 4.5
**Source:** Code review finding H1 from emergency-replace-newsapi-with-gnews story. See `docs/plans/2026-02-21-reconcile-batch-scoring-pipelines.md`.

**Acceptance Criteria:**
- `route.ts` classification prompt includes newsworthiness test (4 criteria from `scripts/batch.ts`)
- Q&A articles, listicles, and non-news content rejected
- Rejection logging: log rejected titles with reasons
- Relevance rate logged: `"Relevance: X/Y articles passed classification (Z%)"`
- Classification uses `temperature: 0` (consistent with scoring)
- All existing tests pass; new tests cover newsworthiness rejection and logging
- `scripts/batch.ts` unchanged

**Dev Notes:**
- Copy classification prompt from `scripts/batch.ts` (same Option A approach as Story 4.5)
- This is the second half of the reconciliation plan — scoring (4.5) must land first
