# Recommendation #3: Dynamic Insight Headline

> Doumont: "The page says 'EcoTicker' — this describes what it IS, not what it TELLS you. Lead with the insight, not the label."

## US-3.1: Show a dynamic insight headline on the dashboard
**As a** returning visitor, **I want** the dashboard to immediately tell me what changed, **so that** I know if something needs my attention without scanning the entire grid.

**Why the v1 version was too simple:**
The v1 AC said: "N topics escalated today (score increased >5)." But a 5-point increase within the SAME level (e.g., 40→45, both MODERATE) isn't noteworthy. A 4-point increase that CROSSES a level boundary (e.g., 74→78, from SIGNIFICANT to SEVERE) is huge. Raw score deltas are noise. **Level transitions are signal.**

**User journey (Jordan, journalist):**
1. Opens EcoTicker at 8 AM
2. Old: sees "EcoTicker — Environmental news impact tracker." Has to scan.
3. New: sees "Arctic Sea Ice reached SEVERE — highest level this month"
4. Immediately knows the lede: Arctic ice is the story today.

**Acceptance Criteria:**
- Replace the static "EcoTicker / Environmental news impact tracker" heading
- Dynamic headline computed from current topic data (already fetched for BiggestMovers + TopicGrid — no extra API call)
- Priority logic (first matching rule wins):
  1. **Level escalation:** If any topic crossed UP a severity level since previous score → "**[Topic] reached [LEVEL]**" (pick the highest-severity escalation). Example: "Arctic Sea Ice reached SEVERE"
  2. **Multiple escalations:** If 2+ topics escalated levels → "**N topics escalated — [highest] reached [LEVEL]**". Example: "3 topics escalated — Arctic Ice reached SEVERE"
  3. **De-escalation (good news):** If any topic dropped a level with no escalations → "**[Topic] improved to [LEVEL]**". Example: "California Wildfires improved to MODERATE"
  4. **Score movement (no level change):** If largest absolute change > 10 but no level transition → "**Biggest move: [Topic] [+/-N]**"
  5. **Stable:** If no topic changed by more than 5 → "**All topics stable today**"
  6. **No data:** Falls back to "Environmental News Impact Tracker"
- Subtitle: always show "EcoTicker" in smaller text below the dynamic headline (branding still present)
- To determine level transitions: compare `scoreToUrgency(topic.currentScore)` vs `scoreToUrgency(topic.previousScore)` using existing utility

**Complexity:** S (client-side computation from existing data, no API change)
**Dependencies:** US-1.1 (level transitions are more meaningful with the calibrated rubric — without it, scores cluster around 40-60 and transitions rarely happen)

---
