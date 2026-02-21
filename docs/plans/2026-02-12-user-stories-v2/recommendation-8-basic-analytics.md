# Recommendation #8: Basic Analytics

> Drucker: "Zero product metrics. No way to know if the product is useful." At minimum: know which topics people actually look at.

## US-8.1: Track page views per topic
**As a** site operator, **I want** to know which topics are viewed most, **so that** I can understand what users care about and prioritize keyword coverage.

**Why this matters (operator):**
We have 12 topics but no idea which ones anyone looks at. If "Renewable Energy Transition" gets 2 views/month and "Delhi Air Quality" gets 200, that tells us: (a) crisis topics drive engagement, (b) we should add more crisis-related keywords, (c) the "informational" tier might not serve users.

**Limitation to acknowledge:** Fire-and-forget page-view counting has no deduplication. Bot traffic, refreshes, and preloads inflate numbers. This is acceptable for a personal/demo project. For production, you'd add fingerprinting or session-based dedup — but that's a privacy trade-off we're not making.

**Acceptance Criteria:**
- New `topic_views` table: `id INTEGER PRIMARY KEY, topic_id INTEGER NOT NULL REFERENCES topics(id), date DATE NOT NULL, view_count INTEGER DEFAULT 0, UNIQUE(topic_id, date)`
- Topic detail page fires a `POST /api/views/[slug]` on mount (fire-and-forget: `fetch(...).catch(() => {})` — no await, no error handling, no UI impact)
- API endpoint: upserts `view_count` for today's date + topic_id
- Admin API: `GET /api/admin/views?period=7d|30d|all` returns topic view counts sorted descending
- No user identification stored — just daily counts per topic

**Complexity:** S
**Dependencies:** None

---

## US-8.2: View a simple analytics dashboard
**As a** site operator, **I want** a basic analytics view showing which topics are popular, **so that** I can make informed decisions about content and keyword strategy.

**User journey (operator):**
1. Visits `/admin/analytics` (protected by API key)
2. Sees top 10 topics by views (last 7 days) — bar chart
3. Sees daily total views trend — line chart
4. Notices: "Delhi Air Quality" is 3x more viewed than anything else. Considers adding more air quality keywords.

**Acceptance Criteria:**
- Admin page: `/admin/analytics` (protected by X-API-Key in a cookie or header)
- Data from `GET /api/admin/views?period=7d`
- Two visualizations (reuse Recharts — already in the project):
  1. Horizontal bar chart: top 10 topics by total views in period
  2. Line chart: daily total views over the period
- Simple table fallback below charts with exact numbers
- Responsive layout: charts stack on mobile

**Complexity:** M (admin page + 2 Recharts visualizations + API endpoint)
**Dependencies:** US-8.1

---
