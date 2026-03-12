# Deferred: Phase 3 — OG Images + Embed Widget

**Status:** Branch `phase-3-ux-og-embed` deleted. Needs replanning against current UX (post run-0002).

## What it contained
- Dynamic OG images per topic (`/api/og/[slug]/route.tsx`) — 1200x630, severity-colored
- Embed widget (`/embed/[slug]/route.ts`) — embeddable score card for external sites
- Tests: `api-og-image.test.ts` (113 lines), `embed-widget.test.ts` (135 lines)
- TopicGrid enhancements, HeroSection tweaks, batch-pipeline RSS integration

## Why it was scrapped
Run-0002 rebuilt the landing page: TopicGrid replaced by TopicList, HeroSection got new signature (`headline` prop), layout changed from card grid to flat severity rows. The OG images and embed widget were designed for the old layout and would render stale UI.

## What to replan
1. OG images need to match the new severity-list design, not the old card grid
2. Embed widget needs to use TopicList pattern, not TopicGrid
3. Topic detail page layout changed — OG metadata references need updating
4. Batch pipeline RSS changes may still be compatible — evaluate separately
