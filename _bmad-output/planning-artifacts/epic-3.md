# Epic 3: Impact Sprint

**Status:** done
**Phase:** 3 — Immediate Impact
**Goal:** Ship the three highest-impact remaining features: dynamic headline (retention), social sharing (acquisition), and article count indicator (credibility).
**Sprint Priority:** THIS IS THE CURRENT SPRINT

## Story 3.1: Dynamic insight headline on dashboard (US-3.1)
**Status:** done
**Size:** S
**Estimated Effort:** 2-3 hours
**Description:** Replace static "EcoTicker / Environmental news impact tracker" heading with a dynamic headline computed from topic data. Priority logic: level escalation > multiple escalations > de-escalation > score movement > stable > no data. "EcoTicker" moves to subtitle.
**Dependencies:** Epic 1 (DONE)
**Workflow:** `docs/plans/2026-02-13-us3.1-workflow.md`

**Acceptance Criteria:**
- Dynamic headline computed client-side from already-fetched topic data (no extra API call)
- Priority rules: level transitions first, then raw score deltas, then stable/fallback
- Compare `scoreToUrgency(currentScore)` vs `scoreToUrgency(previousScore)` for level transitions
- "EcoTicker" shown as smaller subtitle below the dynamic headline
- Fallback: "Environmental News Impact Tracker" when no data

## Story 3.2: Share topic page with rich social previews (US-6.1)
**Status:** done
**Size:** S
**Estimated Effort:** 3-4 hours
**Description:** Add `layout.tsx` with `generateMetadata()` for server-side OG meta tags on topic detail pages. Add share button that copies URL to clipboard.
**Dependencies:** None
**Workflow:** `docs/plans/2026-02-13-us6.1-workflow.md`

**Acceptance Criteria:**
- `src/app/topic/[slug]/layout.tsx` server component with `generateMetadata()`
- OG title: "[Topic] — Score: [N] ([URGENCY]) | EcoTicker"
- OG description: overallSummary or impactSummary (first 200 chars)
- OG image: static fallback initially
- Twitter card meta tags
- Share button copies URL to clipboard with "Link copied!" confirmation (2s fade)
- Proper `<title>` tag with topic name + score

## Story 3.3: Article count indicator (US-2.1)
**Status:** done
**Size:** S
**Estimated Effort:** 30 minutes
**Description:** Show "Latest score based on N articles" near the sub-score breakdown on topic detail page. Simple text indicator for transparency.
**Dependencies:** Epic 1 (DONE)
**Workflow:** `docs/plans/2026-02-13-us2.1-workflow.md`

**Acceptance Criteria:**
- Text near sub-score breakdown: "Latest score based on N articles"
- N = `topic.articleCount`
- If 0 articles: "No articles available for this topic"
- No API changes needed — data already available
