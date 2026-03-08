# Epic 2: Make It Visible

**Status:** DONE
**Phase:** 2 — Visibility & Compliance
**Goal:** Surface the new scoring architecture in the UI and ensure legal compliance for EU launch.

## Story 2.1: Sub-score breakdown with reasoning on topic detail (US-1.2)
**Status:** DONE
**Size:** M
**Description:** Three dimension cards (Ecological, Health, Economic) with severity levels, progress bars, and reasoning text. Progressive disclosure — collapsed reasoning on mobile.
**Commit:** 4a84e43
**Dependencies:** Epic 1

## Story 2.2: Toggle sub-score trend lines on ScoreChart (US-1.3)
**Status:** DONE
**Size:** M
**Description:** Default to overall-only line. Three toggleable sub-score lines with neutral colors (purple, cyan, amber). INSUFFICIENT_DATA renders as gaps.
**Commit:** 08dc4a1
**Dependencies:** Epic 1

## Story 2.3: Filter dashboard by category (US-1.4)
**Status:** DONE
**Size:** S
**Description:** Category filter chips below urgency filters. Simultaneous urgency + category filtering. Human-readable labels.
**Commit:** 82c3c3f
**Dependencies:** None

## Story 2.4: Show category label on topic card (US-1.5)
**Status:** DONE
**Size:** S
**Description:** Muted category chip on each TopicCard below the urgency badge.
**Dependencies:** None

## Story 2.5: Understand the scoring methodology (US-2.2)
**Status:** DONE
**Size:** M
**Description:** ScoreInfoIcon tooltip with 4-level scale + linkable `/scoring` methodology page with 7 sections. Linked from header, footer, tooltips.
**Dependencies:** Epic 1

## Story 2.6: GDPR-compliant data policy page (US-11.1)
**Status:** DONE
**Size:** S
**Description:** `/data-policy` page following GDPR Article 13 structure. 7 sections covering data collection, rights, retention. Footer link.
**Dependencies:** None
