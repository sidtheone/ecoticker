# Recommendation #5: Backup News Source

> Taleb: "Single dependency on NewsAPI is fragile. A model outage makes every topic 'moderate.'" Porter: "Supplier power is Very High — either vendor changes terms, the product breaks."

## US-5.1: Fall back to alternative news source when NewsAPI is unavailable
**As a** site operator, **I want** the batch pipeline to use a backup news source when NewsAPI fails, **so that** scoring continues even during API outages.

**User journey (operator):**
1. Tuesday 6 AM: cron fires batch.
2. `fetchNews()` calls NewsAPI → 429 Too Many Requests (rate limited) or 5xx (outage)
3. Old behavior: batch logs warning, returns 0 articles, exits. Dashboard stale for 24 hours.
4. New behavior: `fetchNews()` retries once, then calls `fetchNewsFromRSS()`. Gets 8 articles from EPA/NOAA/UN Environment RSS feeds. Batch continues with fewer but valid articles. Dashboard updates.

**Why RSS from government/agency feeds, not GDELT?**
- GDELT is a firehose (250M+ records). Requires complex query filtering. Overkill for backup.
- RSS from EPA, NOAA, UN Environment, IPCC are: free, stable, authoritative, structured, and environmentally focused.
- RSS feeds return fewer articles but higher quality for our domain.

**Acceptance Criteria:**
- `fetchNews()` in batch.ts tries NewsAPI first with existing timeout (15s)
- On failure (network error, non-200 status, 0 results), falls back to RSS fetcher
- RSS sources configurable via `RSS_FEEDS` env var (comma-separated URLs). Default: EPA Press Releases, NOAA Climate News, UN Environment News
- RSS articles normalized to `NewsArticle` interface (same shape as NewsAPI results)
- Dedup handled by existing UNIQUE constraint on `articles.url`
- Batch log entry indicates which source was used: "Fetched 12 articles from NewsAPI" or "NewsAPI unavailable — fetched 8 articles from RSS (EPA, NOAA)"
- If BOTH sources fail: batch logs critical error, exits without updating scores (don't score with 0 articles)

**Complexity:** M (RSS parser + adapter to NewsArticle + fallback logic + new env var)
**Dependencies:** None

---

## US-5.2: Show data source attribution per article
**As a** topic researcher, **I want** to see which data source provided each article, **so that** I can assess source authority and reliability.

**Why this matters:** After US-5.1, articles come from multiple sources. An EPA press release carries different weight than a random NewsAPI result. The researcher should know.

**Acceptance Criteria:**
- `articles` table gains: `source_type TEXT DEFAULT 'newsapi'` (values: "newsapi", "rss")
- Batch pipeline sets `source_type` when inserting articles
- ArticleList component shows a small source-type indicator next to each article's source name. E.g., "Reuters · NewsAPI" or "EPA · RSS Feed"
- Subtle styling — doesn't clutter the article list

**Complexity:** S (1 new column + batch change + small UI badge)
**Dependencies:** US-5.1

---
