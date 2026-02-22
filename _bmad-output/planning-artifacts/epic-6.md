# Epic 6: Growth & Feedback Loop

**Status:** backlog
**Phase:** 6 — Growth
**Goal:** Make the product shareable, embeddable, and self-improving through user feedback.

## Story 6.1: Embeddable live topic widget (US-6.2)
**Status:** backlog
**Size:** M
**Description:** `/embed/[slug]` minimal page with score, sparkline, urgency badge. Auto-refresh every 5min. Theme via query param. CSP update for framing. "Copy embed code" button on topic detail.
**Dependencies:** None
**Workflow:** `docs/plans/2026-02-13-us6.2-workflow.md`

## Story 6.2: Dynamic social card images (US-6.3)
**Status:** backlog
**Size:** M
**Description:** `/api/og/[slug]` using Next.js ImageResponse. 1200x630 image with topic name, score, urgency badge, sparkline, sub-score bars. Referenced by generateMetadata() from US-6.1.
**Dependencies:** Epic 3 Story 3.2 (US-6.1)
**Workflow:** `docs/plans/2026-02-13-us6.3-workflow.md`

## Story 6.3: Report inaccurate score with per-dimension targeting (US-10.1)
**Status:** backlog
**Size:** S
**Description:** "Report" link on each sub-score card. Inline form: direction (too high/low/mismatch) + optional comment. New `score_feedback` table. Public POST endpoint, rate limited 5/IP/hour.
**Dependencies:** Epic 2 Story 2.1 (US-1.2, DONE)
**Workflow:** `docs/plans/2026-02-13-us10.1-workflow.md`

## Story 6.4: View aggregated feedback for calibration (US-10.2)
**Status:** backlog
**Size:** S
**Description:** Admin API endpoint for per-topic feedback breakdown by dimension and direction. Sorted by most-reported. Time-filterable.
**Dependencies:** Story 6.3
**Workflow:** `docs/plans/2026-02-13-us10.2-workflow.md`
