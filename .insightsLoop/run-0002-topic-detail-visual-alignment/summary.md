# Run Summary

**Feature:** Topic Detail Page — Visual Alignment
**Date:** 2026-03-11
**Triage:** Medium

## What Was Built

Redesigned the `/topic/[slug]` detail page to match the landing page's flat, gut-punch design language. Score-first vertical stack: giant severity-colored score (72px/48px) at top, badge + change below, topic name below that, left-border accent on insight lede. Dimension breakdown flattened from 3-column card grid to flat rows with per-row severity-colored left-border accents. Article list stripped of card wrappers. Score chart background removed, keeping light border. ScoreInfoIcon removed. Copy updated.

## Files

**Modified:**
- `src/app/topic/[slug]/page.tsx` — hero restructured, dimensions flattened, action-bar removed, copy updated
- `src/components/ArticleList.tsx` — card wrappers → flat rows, empty state copy
- `src/components/ScoreChart.tsx` — bg stripped, duplicate h3 removed
- `tests/TopicDetail.test.tsx` — contracts updated for new layout
- `tests/TopicDetail-7-5.test.tsx` — contracts updated for new layout + action-bar removal
- `tests/ArticleList.test.tsx` — new copy contracts
- `tests/ScoreChart.test.tsx` — new structure contracts

## Tests

- Before: 653 passing
- After: 665 passing (+12 new contracts)

## Findings

- **Storm:** 3 introduced (1 high fixed, 1 medium fixed, 1 low fixed), 2 pre-existing (noted)
- **Cartographer:** 2 findings (duplicate timestamp fixed, dimension row layout fixed)
- **Editor:** 2 inconsistencies (back link copy fixed; "Ecological Impact" vs "Ecology" label divergence → backlog)
- **Monkey:** 5 challenges across 4 steps — 5 survived (dimensions survived existence question; TDD sequencing resolved; hostile URL pre-existing/OOS; unbounded API pre-existing; duplicate score_history rows pre-existing)

## Decisions

1. Score-first vertical stack (Option B) — score IS the page, name secondary
2. Dimensions survive Monkey's existence question — they decompose the weighted composite score
3. Article summaries kept as line-clamp-1 subtitle — titles alone can be ambiguous
4. Action-bar section removed entirely — timestamp consolidated into hero metadata line
5. "Ecological Impact" vs "Ecology" label divergence left for a separate normalization pass (pre-existing, not introduced)
6. ScoreInfoIcon left as orphaned component for now — delete in a cleanup pass

## Backlog

- Paginate article list (LIMIT 20 + show more) — Monkey Scale Shift finding
- Paginate score history (LIMIT 90) — same
- Fix label divergence: "Ecological Impact" (page) vs "Ecology" (chart) — Editor finding
- Delete ScoreInfoIcon component + tests — orphaned after this change
- Fix same-day batch re-run duplicate score_history rows — Monkey Time Travel finding
