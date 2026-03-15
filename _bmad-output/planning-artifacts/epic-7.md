# Epic 7: UX Foundations

**Status:** in-progress
**Phase:** 7 — Visual Severity Layer
**Goal:** Implement the visual severity communication layer from the UX design specification: severity gauge, unified color utility, hero section, product descriptor, and stale data detection. These components close the "cold-landing legibility gap" — the spec's #1 retention risk.
**Source:** `docs/plans/2026-02-22-architecture-audit-ux-spec.md`

## Context

The architecture audit (2026-02-22) found 67% alignment between the codebase and the UX design specification. The core scoring engine, database, and API are solid (Epics 1–4). The gaps are in the **visual severity communication layer** — the components that make the 0–3 second "severity glance" work for first-time visitors.

The UX spec identifies the severity gauge as "the product's single biggest retention gap." Without it, first-time visitors see a number (e.g., "87") with no visual context for what the 0–100 scale means. The gauge, hero section, and product descriptor together solve the cold-landing problem.

**Critical path:** `severityColor()` → `SeverityGauge` → Hero section → Stale data warning

---

## Story 7.1: Unified severity color utility and SeverityGauge component
**Status:** ready-for-dev
**Size:** S
**Estimated Effort:** 3–4 hours
**Description:** Create a single `severityColor(score: number)` utility that replaces the current split across `scoreToHex()`, `urgencyColor()`, and `changeColor()`. Then build the `SeverityGauge` component — a pure CSS horizontal gradient bar with a marker at `left: ${score}%`. SSR-compatible. Reusable across hero, cards, detail page, and dimension sub-scores.
**Dependencies:** None

**Acceptance Criteria:**

**Given** a numeric score between 0 and 100
**When** `severityColor(score)` is called
**Then** it returns an object with: `badge` (foreground hex), `gauge` (background hex), `border` (left-border hex), `text` (readable label)
**And** badge colors are WCAG AA compliant: BREAKING `#dc2626`, CRITICAL `#c2410c`, MODERATE `#a16207`, INFORMATIONAL `#15803d`

**Given** a score is passed to `<SeverityGauge score={87} />`
**When** the component renders
**Then** it displays a horizontal gradient bar (green → yellow → orange → red) with a distinct marker at `left: 87%`
**And** gradient has subtle inflection points at score boundaries (30, 60, 80)
**And** minimum width is 120px; below 120px, fall back to solid severity color
**And** bar thickness is 8–10px with rounded end-caps
**And** marker has a distinct shape (triangle or line) with subtle shadow
**And** component is fully SSR-compatible (zero client JS dependency)
**And** `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` for screen readers

**Given** existing components use `scoreToHex()`, `urgencyColor()`, or `changeColor()`
**When** the unified `severityColor()` utility is complete
**Then** all existing consumers are migrated to use the new utility
**And** the old functions are removed
**And** no raw hex values for severity colors remain in component files

**Dev Notes:**
- Place `severityColor()` in `src/lib/utils.ts` (or new `src/lib/severity.ts`)
- Place `SeverityGauge` in `src/components/SeverityGauge.tsx`
- The gauge gradient uses the `gauge` colors from `severityColor()` at score positions 0, 30, 60, 80, 100
- Color coherence constraint: badge color and gauge gradient color at the same score MUST be perceptibly the same hue
- The two-reds rule: gauge uses muted/dark variants (`-800`), badge uses bright variants
- Test with all 4 severity levels + boundary scores (0, 29, 30, 59, 60, 79, 80, 100)

---

## Story 7.2: Dashboard hero section with weighted score calculation
**Status:** ready-for-dev
**Size:** S
**Estimated Effort:** 3–4 hours
**Description:** Evolve the existing `InsightHeadline` component into a full hero section that displays the single most newsworthy topic. Merge badge + gauge + score + insight sentence + action bar into one cohesive unit. Two layout modes: dramatic (severity ≥ 30) and calm (severity < 30).
**Dependencies:** Story 7.1 (SeverityGauge)

**Acceptance Criteria:**

**Given** the dashboard loads with topics data
**When** the hero section renders
**Then** the most newsworthy topic is selected using: `heroScore = currentScore × 0.6 + abs(currentScore - previousScore) × 0.4`
**And** tie-breaker: most recent `updatedAt` timestamp, then highest `currentScore`
**And** the hero displays: topic name + score (Geist Mono 40px) + UrgencyBadge + SeverityGauge + insight sentence + action bar (`Updated Xh ago · [Share]`)

**Given** the hero topic has severity ≥ 30 (dramatic mode)
**When** the hero renders
**Then** score is 40px, gauge is 10px thick, full visual weight
**And** on mobile: badge + score number share the same line (2-step co-perception)
**And** total mobile above-the-fold height is ~172px

**Given** the hero topic has severity < 30 (calm mode)
**When** the hero renders
**Then** score shrinks to 28px, gauge thins to 6px, muted badge color
**And** total mobile above-the-fold height is ~120px
**And** insight sentence can display "All monitored topics within normal range" for stable state

**Given** the user taps the Share button in the action bar
**When** clipboard copy succeeds
**Then** a toast shows "Link copied!" for 3 seconds
**And** the copied URL is the topic detail page URL

**Given** the hero section renders on mobile (375px)
**When** viewed above the fold
**Then** product descriptor + hero (score + badge + gauge + insight + action bar) are all visible without scrolling

**Dev Notes:**
- Hero topic selection is SERVER-SIDE in dashboard `page.tsx` — compute `heroScore` for all topics, pick highest
- The hero is an evolution of `InsightHeadline`, not a net-new component — refactor, don't duplicate
- Share button reuses existing clipboard copy logic from Story 3.2
- On desktop: badge → gauge → number is a 3-step left-to-right sequence
- On mobile: (badge + number) → gauge is a 2-step co-perception sequence
- Calm-state hero must not manufacture false gravitas for low-severity topics

---

## Story 7.3: Product descriptor and stale data warning
**Status:** done
**Size:** S
**Estimated Effort:** 2–3 hours
**Description:** Add the one-line product descriptor ("Environmental News Impact Tracker — AI-Scored Severity") to the dashboard layout. Add a `StaleDataWarning` component that shows a banner when the last successful batch is >18h ago.
**Dependencies:** None (can run in parallel with Story 7.1)

**Acceptance Criteria:**

**Given** a visitor lands on the dashboard
**When** the page renders
**Then** a product descriptor is visible beneath the site title: "Environmental News Impact Tracker — AI-Scored Severity"
**And** the descriptor is styled as caption text (14px, muted color)
**And** it is visible above the fold on both desktop and mobile

**Given** the last successful batch ran more than 18 hours ago
**When** any page loads (dashboard or topic detail)
**Then** a stale data warning banner is visible: "Data may be outdated — last updated [X hours ago]. Next batch at 6 AM UTC."
**And** the banner uses the Alert component style (Layer 2 trust surface)
**And** the banner is yellow/amber (warning, not error)

**Given** the last successful batch ran within 18 hours
**When** any page loads
**Then** no stale data banner is shown

**Given** no batch has ever run (empty database)
**When** the dashboard loads
**Then** an empty state message shows: "We're monitoring the environment. Scores will appear after the next batch run at 6 AM UTC."
**And** the message is timeline-based, not error-based

**Dev Notes:**
- Product descriptor: pure HTML in dashboard layout, zero logic. One `<p>` tag.
- Stale data detection: query `scoreHistory` table for MAX(`recordedAt`) as a proxy for last batch time. This avoids needing the `batch_runs` table (Phase 3) — we can upgrade later.
- Alternative: add a lightweight `/api/health` endpoint that returns `{ lastBatchAt, isStale }` — already referenced in Journey 6 (Operator).
- The 18h threshold accounts for daily 6 AM UTC batch cadence — avoids false alarms every afternoon.
- Empty-state follows the "failure states are timeline states" principle from the UX spec.

---

## Story 7.4: Topic card severity enhancements
**Status:** backlog
**Size:** S
**Estimated Effort:** 2–3 hours
**Description:** Enhance `TopicCard` with the visual severity layer: 3px left border colored by severity, inline `SeverityGauge`, one-line truncated insight sentence, and `Updated Xh ago` timestamp. These changes implement the "graduated visual weight" principle — each severity level has distinct visual character.
**Dependencies:** Story 7.1 (SeverityGauge, severityColor utility)

**Acceptance Criteria:**

**Given** a topic card renders on the dashboard
**When** the component mounts
**Then** it has a 3px left border colored by severity level (from `severityColor().border`)
**And** a `SeverityGauge` is displayed (same component as hero, smaller size)
**And** the topic's insight sentence is shown truncated to max 120 characters at the last full word, with trailing ellipsis
**And** "Updated Xh ago" timestamp is visible in caption text

**Given** a BREAKING topic (score 80+)
**When** the card renders
**Then** the card has the highest visual weight: red left border, bold score, saturated badge
**And** it is visually the "loudest element on the page"

**Given** an INFORMATIONAL topic (score 0–29)
**When** the card renders
**Then** the card has low visual weight: green left border, calm badge, quiet gauge position
**And** it feels like "this is being tracked and it's okay" — not a failed BREAKING card

**Given** the topic has no insight sentence (null/empty `impactSummary`)
**When** the card renders
**Then** the insight line is omitted (no empty space or placeholder)

**Dev Notes:**
- Left border: `border-l-3 border-[${severityColor(score).border}]` — applied via inline style or dynamic class
- Gauge on cards: same `SeverityGauge` component but smaller (height 6px, full card width)
- Insight truncation: truncate to 120 chars at last full word boundary + "…" — create a `truncateToWord(text, maxLen)` utility
- Timestamp: use existing `updatedAt` from `/api/topics` response, format as relative time ("6h ago", "2d ago")
- The card left border replaces any background tint approach — cleaner, unambiguous, theme-independent

---

## Story 7.5: Topic detail page editorial layout
**Status:** backlog
**Size:** S
**Estimated Effort:** 3–4 hours
**Description:** Restructure the topic detail page into the editorial landing page format defined in the UX spec. Social share arrivals (Casey) land here, not the dashboard — this is the product's first impression for shared links. Layout follows the editorial rhythm: score hero → insight lede → dimension body → source citations → score history.
**Dependencies:** Story 7.1 (SeverityGauge), Story 7.2 (hero section pattern)

**Acceptance Criteria:**

**Given** a user navigates to `/topic/[slug]`
**When** the page loads
**Then** the content follows this top-to-bottom editorial rhythm:
1. **Score hero** — topic name + score (40px) + badge + SeverityGauge + share button
2. **Insight lede** — full insight sentence + action bar (`Updated Xh ago · [Share]`)
3. **Dimension body** — sub-scores with mini SeverityGauge bars per dimension + reasoning prose
4. **Source citations** — article list with publisher names and publication dates prominently visible
5. **Score history** — sparkline/ScoreChart showing trend over time

**Given** the page loads on mobile (375px)
**When** viewed above the fold
**Then** topic name + score + badge + gauge + share button are all visible without scrolling
**And** no preamble content appears above the score (score is the first content below topic name)

**Given** a social share arrival (Casey) lands on this page
**When** they see the hero within 0–3 seconds
**Then** the severity glance succeeds: badge → gauge → number communicates severity without explanation
**And** the product descriptor or site identity is visible (EcoTicker branding)

**Given** the dimension breakdown section renders
**When** each sub-score displays
**Then** it uses a mini `SeverityGauge` (same component, smaller) alongside the dimension score and reasoning text
**And** the gauge vocabulary is consistent with the overall score gauge (same component, same colors)

**Dev Notes:**
- This is a RESTRUCTURE of the existing topic detail page, not a new page
- The editorial rhythm is: headline → lede → body → citations → appendix (like a news brief)
- Share button placement: co-located with the score at the moment of peak intent (3–8 seconds)
- Source article publication dates must be prominently visible — not buried in metadata (Dr. Priya's trust flow depends on this)
- Dimension reasoning must be presented in clean typography that invites scrutiny — not hidden in collapsed accordions
