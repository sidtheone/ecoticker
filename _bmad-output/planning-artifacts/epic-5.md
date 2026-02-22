# Epic 5: Admin & Measurement

**Status:** backlog
**Phase:** 5 — Admin Tools
**Goal:** Keyword management for topic coverage growth and basic analytics to understand usage.

## Story 5.1: Add search keywords to track (US-4.1)
**Status:** backlog
**Size:** M
**Description:** New `tracked_keywords` table + 4 CRUD API endpoints + `/admin/keywords` page. Batch pipeline reads from both env var and DB. Status lifecycle: pending → active → no_results → inactive.
**Dependencies:** None
**Workflow:** `docs/plans/2026-02-13-us4.1-workflow.md`

## Story 5.2: Deactivate a topic from tracking (US-4.2)
**Status:** backlog
**Size:** S
**Description:** PATCH endpoint to deactivate keywords. Topics hidden from dashboard but accessible via direct URL. Reactivation supported.
**Dependencies:** Story 5.1
**Workflow:** `docs/plans/2026-02-13-us4.2-workflow.md`

## Story 5.3: View tracked keywords and status (US-4.3)
**Status:** backlog
**Size:** S
**Description:** Admin keyword list view with status badges, last searched date, article counts. Shows env-var keywords as "System" type.
**Dependencies:** Story 5.1
**Workflow:** `docs/plans/2026-02-13-us4.3-workflow.md`

## Story 5.4: Track page views per topic (US-8.1)
**Status:** backlog
**Size:** S
**Description:** New `topic_views` table. Fire-and-forget POST on topic page mount. Daily upsert. Admin API for view counts.
**Dependencies:** None
**Workflow:** `docs/plans/2026-02-13-us8.1-workflow.md`

## Story 5.5: Simple analytics dashboard (US-8.2)
**Status:** backlog
**Size:** M
**Description:** `/admin/analytics` with top-10 topics bar chart and daily views trend line chart using Recharts.
**Dependencies:** Story 5.4
**Workflow:** `docs/plans/2026-02-13-us8.2-workflow.md`

## Story 5.6: Batch health infrastructure and admin dashboard
**Status:** backlog
**Size:** M
**Estimated Effort:** 8–12 hours
**Description:** Add `batch_runs` table to persist batch execution history (status, article counts, feed health, errors). Create admin batch health dashboard at `/admin/batch-health` with three components: `BatchStatusCard` (last run status + article count), `AnomalyList` (topics with delta >30 auto-flagged), `SourceHealthGrid` (per-feed article counts with red/green status). Mobile-first layout — all above-the-fold for the "all clear" path.
**Dependencies:** None
**Source:** Architecture audit 2026-02-22, UX spec Journey 6 (Operator)

**Acceptance Criteria:**
- `batch_runs` table: id, started_at, ended_at, successful, topics_processed, articles_added, scores_recorded, clamping_percentage, feed_health (JSONB), error_message
- Batch pipeline (`scripts/batch.ts` and `/api/batch`) writes a `batch_runs` row on each execution
- GET `/api/admin/batch-health` returns last 10 batch runs with feed health data
- Admin page at `/admin/batch-health` displays:
  - `BatchStatusCard`: icon (✓/⚠/✗) + timestamp + article count. Tap to expand per-source counts.
  - `AnomalyList`: topics with score delta >30 auto-flagged. Each shows topic name + delta + one-line reasoning (max 80 chars). Empty state: "No anomalies detected ✓"
  - `SourceHealthGrid`: per-feed row with source name + article count + status dot (green ≥1, red = 0)
- All three sections visible without scrolling on mobile (375px) for the "all clear" path
- Admin-only route (requires X-API-Key authentication)
