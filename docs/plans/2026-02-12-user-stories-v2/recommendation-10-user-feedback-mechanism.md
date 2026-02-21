# Recommendation #10: User Feedback Mechanism

> Collins' flywheel: "More users → More feedback → Better calibration → More trust → More users." Meadows: "The system has no feedback loop. Information flows one way."

## US-10.1: Report an inaccurate score with per-dimension targeting
**As a** dashboard visitor, **I want** to flag when a score seems wrong — and specify which dimension and why — **so that** the system can improve its accuracy over time.

**Why per-dimension feedback matters (not just "too high / too low"):**
With US-1.2, users see the reasoning for each dimension. They can now make SPECIFIC, ACTIONABLE feedback:
- "The Health score is too LOW — PM2.5 affecting millions of people should be SIGNIFICANT, not MODERATE"
- "The Economic reasoning doesn't match the articles — no article mentions tourism impact"

Generic "too high/too low" on the overall score gives us almost nothing. Per-dimension feedback with reasoning context gives us enough to identify rubric calibration issues.

**User journey (Casey, citizen):**
1. Sees "Ganges River Pollution" rated MODERATE (45) for Health Impact
2. Thinks: "I've read that millions of people drink from the Ganges. MODERATE seems low."
3. Clicks "Report" on the Health dimension card
4. Selects: "Too low" + types: "Millions of people depend on this water source"
5. Sees: "Thanks — your feedback helps improve our scoring"
6. Behind the scenes: stored in `score_feedback` table for operator review

**Acceptance Criteria:**
- "Report" link (small, text-only, not a prominent button — don't invite casual clicking) on each sub-score card in the breakdown section (US-1.2)
- Clicking opens a compact inline form below the card (not a modal — keeps context visible):
  - **Direction:** "Too high" / "Too low" / "Reasoning doesn't match articles" (radio buttons)
  - **Comment:** optional free-text (max 500 chars)
  - **Submit** button
- New `score_feedback` table: `id INTEGER PRIMARY KEY, topic_id INTEGER NOT NULL REFERENCES topics(id), score_history_id INTEGER REFERENCES score_history(id), dimension TEXT NOT NULL, direction TEXT NOT NULL, comment TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
  - `dimension`: "health" | "ecology" | "economy" | "overall"
  - `direction`: "too_high" | "too_low" | "reasoning_mismatch"
  - `score_history_id`: links to the specific scoring entry being reported (so feedback doesn't get stale)
- New API endpoint: `POST /api/feedback` (public — no auth required for low friction)
- Rate limited: 5 submissions per IP per hour (prevent spam)
- Confirmation: brief "Thanks for your feedback" message after submission
- No authentication required — low friction is more important than preventing duplicates

**Complexity:** S (inline form + 1 new table + 1 API endpoint + rate limiting)
**Dependencies:** US-1.2 (sub-score display must exist for per-dimension feedback to work)

---

## US-10.2: View aggregated feedback to identify calibration issues
**As a** site operator, **I want** to see which topics and dimensions receive the most accuracy reports, **so that** I can identify systematic scoring problems and adjust the rubric.

**User journey (operator):**
1. Visits admin feedback view weekly
2. Sees: "Delhi Air Quality — Health dimension: 12 reports (9 'too low', 3 'reasoning mismatch')"
3. Interprets: users consistently think the Health Impact of Delhi air quality is underscored
4. Action: review the rubric criteria for Health Impact — maybe "hazardous air quality affecting millions" should anchor higher in the SIGNIFICANT range

**Acceptance Criteria:**
- Admin API endpoint: `GET /api/admin/feedback?period=7d|30d|all`
- Response: per-topic breakdown of feedback counts, grouped by dimension and direction
- Sorted by most-reported topics first
- Shows: topic name, dimension, total reports, breakdown (too_high / too_low / reasoning_mismatch)
- Time-filterable by period
- Optional: admin UI page `/admin/feedback` with a simple table (can be deferred — API-first is fine for v2)

**Complexity:** S (API endpoint + query)
**Dependencies:** US-10.1

---
