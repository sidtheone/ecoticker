# EcoTicker v2 — User Stories (Deep Revision)

**Date:** 2026-02-12
**Revision:** v2 — from-scratch rethink grounded in US-1.0 architecture + business panel insights
**Supersedes:** `2026-02-09-user-stories.md`
**Architecture source:** `2026-02-09-llm-scoring-research.md` (US-1.0)
**Business context:** `2026-02-09-business-panel-analysis.md` (9-expert panel)

---

## Who Uses This Product?

Before any story makes sense, we need to know who we're building for. The business panel identified four personas. Every story below is written for one of them.

### Persona 1: The Concerned Citizen ("Casey")
Casey heard about wildfires on the news and wants to know: "How bad is it, really?" They're not an expert. They want a simple, trustworthy answer. They'll visit once from a social media link, maybe bookmark the page, probably never return unless we give them a reason to.

**Casey's current experience:** Lands on dashboard. Sees "California Wildfire Season: 67" with an orange badge. Has no idea what 67 means. No explanation anywhere. Leaves confused. We lost them.

### Persona 2: The Climate-Beat Journalist ("Jordan")
Jordan covers environmental issues professionally. They need a daily signal: what's escalating, what's de-escalating, what deserves a story? They currently build this picture manually from dozens of sources — Google Alerts, agency press releases, Twitter, other journalists' tips.

**Jordan's current experience:** Opens EcoTicker, sees "EcoTicker — Environmental news impact tracker." Scans the grid. Notices "Arctic Sea Ice" went up 6 points. But WHY? Clicks through. Sees a sparkline and some articles. No reasoning, no dimension breakdown. Can't cite "EcoTicker says..." because the methodology is opaque. Closes tab, goes back to manual methods.

### Persona 3: The Sustainability Officer ("Morgan")
Morgan works at a mid-size company and needs environmental severity data for quarterly reports. Can't afford Bloomberg ESG ($25K/year). Needs rough severity signals with enough credibility to put in a slide deck.

**Morgan's current experience:** Visits monthly. Needs to screenshot the sparkline and manually type "Score increased from 55 to 62." No export, no embeddable chart, no methodology page to link as a source. The data is there but can't be used professionally.

### Persona 4: The Operator ("Us")
We run the system. We need it to work reliably, need to know when scores are wrong, need to understand if anyone uses it.

**Our current experience:** We deploy and hope. No analytics, no feedback loop, no anomaly alerts. If OpenRouter swaps the underlying model and all scores shift by 20 points, we'd never know.

---

## What Changed From v1 and Why

The original 23 stories were written BEFORE US-1.0's research was complete. That research revealed the current scoring is fundamentally broken:

- The LLM clusters scores around 40-60 (central tendency bias) because there's no calibration criteria
- Users see "72" with no explanation — Christensen: "Users can't build trust in numbers they can't reason about"
- The LLM computes the overall score, but it should be server-side (deterministic, transparent, tunable)
- Sub-scores, levels, and reasoning exist as concepts but aren't produced or displayed

**The 4-level rubric is the key insight.** Users don't think in 0-100. They think "how bad is it?" MINIMAL / MODERATE / SIGNIFICANT / SEVERE answers that in human language. The numbers (0-25, 26-50, 51-75, 76-100) provide granularity within levels. But the LEVEL is what gets cited, shared, and remembered. "EcoTicker rates the ecological impact as SEVERE" — that's a sentence a journalist can write. "EcoTicker gave it a 78" is not.

### Structural changes:

| Change | Why |
|--------|-----|
| **NEW US-1.1** — Implement scoring architecture | US-1.0 was research. The implementation needs its own story. Everything depends on it. |
| **MERGE US-1.2 + old US-2.1** → new US-1.2 | Sub-score display without reasoning is just three more numbers. Reasoning without scores has no context. They're one feature with progressive disclosure — not two stories. |
| **US-7.1, US-7.2 ABSORBED** into US-1.1 | Anomaly detection and raw response storage aren't features — they're columns and functions inside the scoring pipeline. |
| **US-1.3 revised** | Current ScoreChart already renders 4 lines (overall + 3 sub-scores, always visible). But 4 lines on a small chart is noisy. Need toggles with default-off. Also: chart line colors must NOT use urgency colors — green for "Health" implies "good" when it should be neutral. |
| **US-2.3 revised** | The explainer must teach the 4-level rubric, not the old arbitrary 0-100 scale. And it should be a linkable `/scoring` page, not just a modal — journalists need to cite the methodology. |
| **US-3.1 revised** | "N topics escalated" is meaningless. LEVEL transitions are what matter: "Arctic Ice reached SEVERE." |
| **US-4.1 revised** | Users add "search keywords" not "topics." The keyword is input; topics are LLM output. Must handle 0-result keywords gracefully. |
| **US-6.1 flagged** | OG meta tags require server-side rendering. Current topic detail page is "use client." Needs `generateMetadata()` — architectural change. |
| **US-10.1 revised** | With reasoning visible, users can flag SPECIFIC dimensions and say "reasoning doesn't match articles." |

### Dependency chain:

```
US-1.1 (scoring architecture)
  ├──→ US-1.2 (sub-score display + reasoning)
  │      └──→ US-10.1 (per-dimension feedback)
  ├──→ US-1.3 (sub-score history trends)
  ├──→ US-2.2 (article-score linkage)
  ├──→ US-2.3 (score explainer)
  ├──→ US-3.1 (dynamic headline — uses levels for meaningful text)
  └──→ US-6.3 (OG image with sub-score bars)

Independent of US-1.1:
  US-1.4, US-1.5, US-4.x, US-5.x, US-6.1, US-6.2, US-8.x, US-9.1
```

---

## Recommendation #1: Scoring Architecture, Sub-Scores, and Categories

> Kim & Mauborgne: "Don't add new capabilities. Surface the capabilities you already have." The data is richer than the UI reveals. But first, the data must be CORRECT — and right now it isn't.

### US-1.0: Research optimal sub-scoring approach with LLMs
**Status:** DONE
**Output:** `docs/plans/2026-02-09-llm-scoring-research.md` (v3, 30+ sources)

---

### US-1.1: Implement the US-1.0 scoring architecture
**As a** developer, **I want** the scoring pipeline rebuilt according to US-1.0's research, **so that** every downstream feature has a correct, reliable, and explainable data foundation.

**Why this story exists:** US-1.0 produced a complete architecture specification, but the codebase still runs the old approach — direct numeric prompting with temperature 0.3, no rubric, no reasoning, no validation, no anomaly detection. Nothing downstream can work correctly until this is fixed. This is the foundation story.

**What changes for each persona after this ships:**
- **Jordan (journalist):** The data behind scores becomes methodologically sound. Reasoning is stored. Levels are assigned. Even before the UI displays them, the API serves them.
- **Us (operator):** Anomalies are flagged. Raw LLM responses are stored for debugging. Score validation catches obviously wrong outputs.

**Acceptance Criteria:**

**Schema** (`db/schema.sql` — direct edit, fresh launch, no migration):

`topics` table gains 4 columns:
- `health_score INTEGER DEFAULT 0` — latest health sub-score (updated each batch)
- `eco_score INTEGER DEFAULT 0` — latest ecology sub-score
- `econ_score INTEGER DEFAULT 0` — latest economy sub-score
- `score_reasoning TEXT` — overall summary from latest scoring (the synthesis sentence)

`score_history` table gains 8 columns:
- `health_level TEXT` — MINIMAL|MODERATE|SIGNIFICANT|SEVERE|INSUFFICIENT_DATA
- `eco_level TEXT`
- `econ_level TEXT`
- `health_reasoning TEXT` — 2-3 sentences citing specific articles
- `eco_reasoning TEXT`
- `econ_reasoning TEXT`
- `overall_summary TEXT` — 1-2 sentence synthesis of combined impact
- `raw_llm_response TEXT` — full LLM JSON for debugging/audit (absorbs US-7.2)
- `anomaly_detected INTEGER DEFAULT 0` — flag for >25pt jumps (absorbs US-7.1)

**Batch pipeline** (`scripts/batch.ts`):

`callLLM()`:
- `temperature` changed from 0.3 → 0 (scoring requires maximum determinism)
- Add `response_format: { type: "json_object" }` (constrain output to valid JSON)

`scoreTopic()`:
- Prompt REPLACED with the rubric-based version from US-1.0 Part 4.3:
  - 4-level severity rubric with criteria and real-world anchors
  - 4 few-shot calibration examples (one per level, diverse categories)
  - Anti-bias instructions ("Do NOT default to MODERATE")
  - Reasoning-first output order (reason → level → score per dimension)
  - INSUFFICIENT_DATA option for dimensions without article evidence
  - LLM response NO LONGER includes `score` or `urgency` — computed server-side
- `TopicScore` interface extended: add levels (3), reasoning (3), overallSummary, rawResponse, anomalyDetected

New functions (all specified in US-1.0 Part 4.4):
- `validateScore(level, score)` → clamp to level range, log if clamped
- `computeOverallScore(health, eco, econ)` → weighted average (Eco 40%, Health 35%, Econ 25%), exclude INSUFFICIENT_DATA dimensions, renormalize weights
- `deriveUrgency(overallScore)` → 80+=breaking, 60+=critical, 30+=moderate, else informational
- `detectAnomaly(previous, current, topicName, dimension)` → warn if >25pt jump (one rubric level)
- Batch-level validation: if >30% of scores are clamped in a run, emit warning (possible model drift)

`main()`:
- `insertTopic` extended: add health_score, eco_score, econ_score, score_reasoning to INSERT + ON CONFLICT UPDATE
- `insertScore` extended: from 6 → 14 columns (add levels, reasoning, overall_summary, raw_llm_response, anomaly_detected)

**Types** (`src/lib/types.ts`):
- New: `SeverityLevel = "MINIMAL" | "MODERATE" | "SIGNIFICANT" | "SEVERE" | "INSUFFICIENT_DATA"`
- `Topic` gains: `healthScore`, `ecoScore`, `econScore` (all `number`)
- `TopicRow` gains: `health_score`, `eco_score`, `econ_score`
- `ScoreHistoryEntry` gains: `healthLevel`, `ecoLevel`, `econLevel`, `healthReasoning`, `ecoReasoning`, `econReasoning`, `overallSummary` (all `string | null`)
- `ScoreHistoryRow` gains matching snake_case fields

**API:**
- `GET /api/topics`: SELECT + response mapping extended with `healthScore`, `ecoScore`, `econScore` per topic
- `GET /api/topics/[slug]`: scoreHistory SELECT + response mapping extended with levels, reasoning, overallSummary

**Seed** (`scripts/seed.ts`):
- Rewritten to generate realistic sub-scores WITH levels and reasoning per dimension
- Each seeded topic has 7 days of history with levels, reasoning, and varying severity
- Coverage: at least 2 topics per severity level (MINIMAL, MODERATE, SIGNIFICANT, SEVERE)
- At least 1 topic with one INSUFFICIENT_DATA dimension
- Reasoning text is realistic (not "lorem ipsum") — references the seeded articles

**Tests:**
- `tests/db.test.ts`: new columns insert/read correctly, INSUFFICIENT_DATA (-1) stored correctly
- `tests/batch.test.ts`: unit tests for validateScore (including edge cases: score=0, score=100, INSUFFICIENT_DATA, unknown level), computeOverallScore (including all-insufficient fallback to 50), deriveUrgency, detectAnomaly
- `tests/api-topics.test.ts`: sub-scores present in list response
- `tests/api-topic-detail.test.ts`: levels + reasoning present in detail response, null handling

**Complexity:** L (full vertical slice: schema + batch + types + API + seed + tests — 13 files, 0 new files)
**Dependencies:** US-1.0 (DONE)
**Blocks:** US-1.2, US-1.3, US-2.2, US-2.3, US-3.1, US-6.3, US-10.1

---

### US-1.2: View sub-score breakdown with reasoning on topic detail page
**As a** topic researcher, **I want** to see health, ecology, and economy sub-scores with their severity levels and reasoning on the topic detail page, **so that** I can understand which dimension is driving the overall score and verify the analysis against the articles.

**Why reasoning is part of this story (not separate):**
The original backlog had "display sub-scores" and "display reasoning" as two stories. But think about Jordan's actual journey:

1. Jordan sees "Amazon Deforestation: 82 BREAKING" → clicks
2. Sees three sub-score cards: Health 28, Ecology 72, Economy 58
3. Thinks: "Why is ecology 72?" — WITHOUT reasoning, they have to guess
4. WITH reasoning: reads "80% of the world's largest coral reef system affected. Repeated bleaching events prevent recovery." NOW they understand and can cite it.

Scores without reasoning are just three more opaque numbers. Reasoning without scores has no structure. They're one experience with progressive disclosure: scan the numbers first, read the reasoning when you want depth.

**User journey (Jordan, journalist):**
1. From dashboard, clicks "Amazon Deforestation: 82 ■ BREAKING"
2. Sees the main score (82) and change (+7) at the top — already exists
3. Below the Impact Summary, sees **Sub-Score Breakdown** section:
   - **Ecological Impact** (40% weight) — 72 SIGNIFICANT [orange bar ████████░░]
     > "80% of the world's largest coral reef system affected. Repeated bleaching events prevent recovery. Cascading effects on marine biodiversity are well-documented."
   - **Health Impact** (35% weight) — 28 MODERATE [yellow bar ████░░░░░░]
     > "No immediate human health impact, but long-term food security concerns for coastal communities dependent on reef fisheries."
   - **Economic Impact** (25% weight) — 58 SIGNIFICANT [orange bar ██████░░░░]
     > "Reef tourism generates $6.4B annually. Fisheries decline affects thousands of livelihoods."
4. Jordan can now write: *"EcoTicker rates the ecological impact of Amazon deforestation as SIGNIFICANT (72/100), citing cascading biodiversity effects..."*

**User journey (Casey, first-time visitor):**
1. Lands on topic detail from a shared link
2. Sees the big score and urgency badge (already exists) — gets the "how bad" answer immediately
3. Scrolls to sub-scores. Sees three colored cards with LEVELS in plain English
4. Doesn't need to read the reasoning — the levels (MINIMAL/MODERATE/SIGNIFICANT/SEVERE) communicate severity in words, not just numbers
5. If curious, reads the reasoning text. If not, scrolls past to articles.

**Acceptance Criteria:**
- Sub-Score Breakdown section appears between Impact Summary and ScoreChart on the topic detail page
- Three dimension cards in a responsive grid: `grid-cols-1 sm:grid-cols-3`
- Each card contains (top to bottom):
  1. **Dimension label** — "Ecological Impact", "Health Impact", "Economic Impact"
  2. **Weight** — small muted text: "(40% weight)", "(35% weight)", "(25% weight)"
  3. **Score + Level** — large score number colored by severity, level badge (pill) next to it
  4. **Progress bar** — width = score%, color matches severity level
  5. **Reasoning text** — 2-3 sentences, visible by default on desktop, collapsed with "Show reasoning" on mobile (<640px) to save space
- Card ordering: Ecological first (highest weight), then Health, then Economic — heaviest influence first
- Colors via existing `scoreToUrgency(score)` → `urgencyColor(urgency)`:
  - MINIMAL (0-25) → green
  - MODERATE (26-50) → yellow
  - SIGNIFICANT (51-75) → orange
  - SEVERE (76-100) → red
- **INSUFFICIENT_DATA handling:**
  - If a single dimension is -1: show "N/A" for score, "No Data" badge in muted gray, empty gray bar, reasoning: "Insufficient article data to assess this dimension"
  - If ALL THREE dimensions are -1: don't show the breakdown section at all. Show a muted notice: "Sub-score breakdown unavailable — insufficient article data" (because the overall score is the fallback 50, and showing three "N/A" cards is confusing)
- **Data source:** Latest entry from `scoreHistory` array (API returns sorted ASC by date, take `scoreHistory[scoreHistory.length - 1]`)
- **If scoreHistory is empty:** don't show the section (new topic with no batch run yet)
- **Overall Summary:** Replace the current `topic.impactSummary` in the Impact Summary section with `overallSummary` from the latest scoreHistory entry (if available). Fall back to `topic.impactSummary` if overallSummary is null.
- Implementation: inline in `src/app/topic/[slug]/page.tsx` (single-use section, not a separate component file)

**Complexity:** M (responsive cards + progressive disclosure + null handling + mobile collapse)
**Dependencies:** US-1.1
**Blocks:** US-10.1

---

### US-1.3: Toggle sub-score trend lines on the score history chart
**As a** sustainability officer, **I want** to see historical trends for each sub-score dimension, **so that** I can identify which dimension is escalating over time and include that in my reports.

**Why this matters for Morgan (sustainability officer):**
Morgan visits monthly. They see the overall score went from 55 to 62 over a quarter. But for their report, they need to say WHY. Was it ecological damage increasing? Health risk? Economic cost? Without dimension trends, they can only say "it got worse." With them, they can write: "Ecological impact escalated from MODERATE to SIGNIFICANT over Q3, driven by repeated bleaching events."

**Current state problem:**
The ScoreChart component ALREADY renders 4 lines — overall + health + eco + econ, always visible. This is wrong in two ways:
1. **Too noisy.** 4 lines on a 256px chart with no legend context is visual clutter, not insight.
2. **Wrong colors.** Health is green (#22c55e), but green means "informational/low severity" in the urgency color system. A rising green "Health" line looks like things are getting BETTER when they're getting WORSE. The chart dimension colors must be NEUTRAL identifiers, not severity indicators.

**Acceptance Criteria:**
- ScoreChart renders ONLY the overall score line by default (clean, simple view)
- Below the chart, three toggle checkboxes: "Health Impact", "Ecological Impact", "Economic Impact" (all off by default)
- Toggling a checkbox adds/removes that dimension's line on the chart
- Dimension line colors are NEUTRAL (not urgency-based):
  - Overall: `#ef4444` (red — matches current, this is the primary line)
  - Health: `#8b5cf6` (purple — distinct, doesn't imply good/bad)
  - Ecology: `#06b6d4` (cyan — distinct from the green used for "informational")
  - Economy: `#f59e0b` (amber — warm, distinct)
- Legend shows dimension name + weight when toggled on: "Ecology (40%)"
- INSUFFICIENT_DATA entries (score = -1) render as gaps in the line (Recharts `connectNulls={false}` with null values)
- No API changes — data already in `scoreHistory` from US-1.1
- Toggle state is ephemeral (React state, lost on navigation — no need to persist)

**Complexity:** M (ScoreChart refactor: remove always-on sub-lines, add toggle state, change colors, handle nulls)
**Dependencies:** US-1.1

---

### US-1.4: Filter dashboard by category
**As a** dashboard visitor, **I want** to filter topics by environmental category, **so that** I can focus on the domain I care about.

**Why this matters:**
Casey lives in a coastal town and only cares about ocean topics. The dashboard shows 12 topics across 8 categories. Casey has to scan all 12 to find the 2 ocean ones. The urgency filter (Breaking/Critical/Moderate/Informational) already exists — but it filters by SEVERITY, not by DOMAIN.

**Current state:** TopicGrid has urgency filter chips (All/Breaking/Critical/Moderate/Informational). The API already supports `?category=` filtering. The category data is already on every Topic object. The wiring exists — the UI filter is missing.

**When does this story add value?** Honestly, with 5-12 topics, you can see everything at once on desktop. Category filtering becomes genuinely useful at ~15+ topics. But: (a) US-4.1 will grow the topic count, (b) even with 12 topics, a journalist who covers ONLY ocean issues benefits from focus, and (c) the implementation cost is tiny since the API already supports it.

**Acceptance Criteria:**
- Second row of filter chips below the existing urgency filters in TopicGrid
- Shows only categories that have at least 1 topic (derived from the fetched topics array — no extra API call)
- "All Categories" default, visually consistent with the urgency "All" chip
- Both filters applied simultaneously (urgency AND category) — if user selects "Breaking" + "Ocean", they see only breaking ocean topics
- Category labels in human-readable form: "Air Quality" (not "air_quality"), "Ocean" (not "ocean" — capitalize)
- If combined filters produce 0 results: show "No topics match these filters" with a "Clear filters" link
- Category filter state lives in React state (lost on refresh — acceptable)

**Open question:** Two rows of chips might feel cluttered on mobile. Alternative: a dropdown for category. But chips are faster to scan and match the existing urgency UX. Recommend: chips on desktop (2 rows), horizontal scrollable on mobile (same as urgency chips today).

**Complexity:** S
**Dependencies:** None (category data already in Topic objects)

---

### US-1.5: Show category label on topic card
**As a** dashboard visitor, **I want** to see the category on each topic card, **so that** I can identify what domain a topic belongs to at a glance.

**Why this matters:**
"Amazon Deforestation" — is that deforestation, climate, or biodiversity? The NAME suggests deforestation, but the LLM might classify it as "biodiversity" because it's about species loss. The category chip makes the LLM's classification visible. This also creates a subtle trust/verification signal: if the user thinks the category is wrong, that's useful feedback.

**Acceptance Criteria:**
- Category chip appears on TopicCard, positioned below the existing urgency badge
- Human-readable label (e.g., "Air Quality", "Biodiversity")
- Muted styling — visually secondary to the urgency badge. Suggested: `text-stone-400 bg-stone-100 dark:bg-gray-800 dark:text-gray-500` rounded pill, smaller font than urgency badge
- Does NOT increase card height (if the name is long + urgency + category overflow, wrap naturally)
- Category data already in `Topic` object — no API change

**Complexity:** S
**Dependencies:** None

---

## Recommendation #2: Score Explainability

> Christensen: "Users can't build trust in numbers they can't reason about." Drucker: "What gets measured gets managed — but only if you can explain what you're measuring."
>
> With US-1.1, reasoning is PRODUCED. With US-1.2, reasoning is DISPLAYED. This recommendation covers the remaining explainability gaps: article linkage and methodology documentation.

### US-2.1: See which articles informed the latest score
**As a** journalist, **I want** to know which articles were analyzed to produce the current score, **so that** I can verify the LLM's reasoning against the source material.

**(Formerly US-2.2 — renumbered because old US-2.1 was merged into US-1.2)**

**Why this matters for Jordan (journalist):**
Jordan reads the reasoning: "PM2.5 levels reaching hazardous levels affect millions." They think: "Which article said that? Can I verify?" They scroll to the article list — but it shows 15 articles from the past month. Which 3 were used in the LATEST scoring?

**The honest limitation:** The batch pipeline doesn't tag which articles went into which score. Articles have `published_at` and `fetched_at`. Score history has `recorded_at`. We COULD correlate by date, but it's lossy — articles might be fetched one day and scored the next.

**The right MVP approach:** The LLM's reasoning CITES the articles (e.g., "PM2.5 levels reaching hazardous levels, schools closed"). The reasoning IS the linkage. What we add is a count indicator so the user knows the scope.

**The deferred approach:** A `batch_id UUID` column on both `score_history` and `articles`, set by each batch run. This enables exact linkage. Deferred because it requires a pipeline change and the reasoning citations are sufficient for now.

**Acceptance Criteria:**
- Near the sub-score breakdown (US-1.2), show: "Latest score based on N articles" where N = `topic.articleCount` (simple) or count of articles fetched in the last batch window (more accurate but requires date math)
- The article list below already shows all articles sorted by date — no filtering needed
- If topic has 0 articles, show "No articles available for this topic"
- The reasoning text in each sub-score card already cites specific articles — this IS the primary verification mechanism

**What this story does NOT do:**
- No per-article "used in scoring" badge (requires batch_id — deferred)
- No score_history → article explicit linkage
- No "show only articles from last batch" filter

**Complexity:** S (text indicator only)
**Dependencies:** US-1.1

---

### US-2.2: Understand the scoring methodology
**As a** first-time visitor, **I want** to understand what EcoTicker scores mean and how they're computed, **so that** I can interpret the numbers and trust the system.

**(Formerly US-2.3 — renumbered)**

**Why this matters for every persona:**
- **Casey (citizen):** Sees "72" — is that bad? What's the scale? Needs a quick anchor.
- **Jordan (journalist):** Needs to cite the methodology. "According to EcoTicker's 4-level rubric..." They need a LINKABLE page.
- **Morgan (sustainability officer):** Needs to reference the methodology in their report. A `/scoring` URL they can put in a footnote.

**The v1 version proposed a dismissible modal. That's insufficient.** A modal disappears. A journalist can't link to a modal. A sustainability officer can't cite a modal in a report. We need BOTH:
1. A quick reference (tooltip/small modal) for Casey
2. A permanent, linkable page (`/scoring`) for Jordan and Morgan

**Acceptance Criteria:**

**Quick reference (tooltip/info icon):**
- Small "?" icon next to the score on both the dashboard (TopicCard) and topic detail page
- On hover (desktop) or tap (mobile): shows a compact tooltip with the 4-level scale:
  - SEVERE (76-100) — Catastrophic, potentially irreversible
  - SIGNIFICANT (51-75) — Widespread, difficult to reverse
  - MODERATE (26-50) — Localized, limited impact
  - MINIMAL (0-25) — Negligible risk
- Footer link: "Learn more about our scoring →" → navigates to `/scoring`

**Methodology page (`/scoring`):**
- Static page (server component, no client JS needed)
- Sections:
  1. **The 4-Level Severity Scale** — MINIMAL / MODERATE / SIGNIFICANT / SEVERE with criteria and real-world anchors (from US-1.0 Part 4.1 rubric table)
  2. **Three Dimensions** — Health Impact (what it measures, 35% weight), Ecological Impact (40%), Economic Impact (25%)
  3. **Why these weights** — 1-2 sentences: Ecological is core mission, Health is most salient to people, Economic is contextual
  4. **How the overall score works** — "The overall score is a weighted average of the three dimension scores. Higher scores indicate more severe environmental impact."
  5. **Urgency levels** — How MINIMAL/MODERATE/SIGNIFICANT/SEVERE map to informational/moderate/critical/breaking badges
  6. **Data sources** — "Articles are collected daily from news sources and analyzed using large language models"
  7. **Limitations** — honest: "Scores are generated by AI models and may not always be accurate. They are intended as indicators, not definitive assessments."
- SEO: proper `<title>`, `<meta description>`, Open Graph tags
- Linked from: dashboard header, topic detail page, score tooltip, site footer

**What this page enables:**
- Jordan can write: *"According to EcoTicker's scoring methodology (ecoticker.com/scoring), the ecological impact is rated SIGNIFICANT..."*
- Morgan can add a footnote: *"Source: EcoTicker Environmental Severity Index. Methodology: ecoticker.com/scoring"*

**Complexity:** M (two deliverables: tooltip component + /scoring page with content)
**Dependencies:** US-1.1 (the rubric must be implemented before we document it)

---

## Recommendation #3: Dynamic Insight Headline

> Doumont: "The page says 'EcoTicker' — this describes what it IS, not what it TELLS you. Lead with the insight, not the label."

### US-3.1: Show a dynamic insight headline on the dashboard
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

## Recommendation #4: User-Configurable Keywords

> Meadows: "The loop is open. The user cannot add a topic they care about." Porter: "5 hardcoded keywords means supplier power is Very High — the product only covers what YOU decided matters."

### US-4.1: Add a new search keyword to track
**As a** power user, **I want** to add a search keyword so the system tracks environmental news about it, **so that** I can monitor issues that matter to me.

**Critical naming clarification:** Users add "search keywords" — NOT "topics." The keyword is a search query sent to NewsAPI. The LLM's classification step CREATES topics from the articles that come back. A keyword "PFAS contamination" might produce a topic named "PFAS Water Contamination Crisis" — the LLM chooses the topic name.

**User journey (Morgan, sustainability officer):**
1. Morgan's company manufactures near a river. They want to track "PFAS contamination"
2. Goes to `/admin/keywords` (protected by API key)
3. Types "PFAS contamination" → clicks "Add Keyword"
4. System validates: 2-100 chars, alphanumeric + spaces + hyphens ✓
5. Keyword saved with status "Pending" — next batch run will search for it
6. 6 AM next morning: batch runs. NewsAPI returns 4 articles about PFAS. LLM classifies them. New topic "PFAS Water Contamination" created with a score of 48 (MODERATE).
7. Morgan visits dashboard — sees the new topic.

**What if NewsAPI returns 0 articles for the keyword?**
- Keyword stays in "Pending" state (never transitions to "Active")
- After 3 consecutive batch runs with 0 results, status changes to "No Results"
- User sees this on the keywords admin page and can edit or remove the keyword
- We do NOT create an empty topic with score 0 — that's confusing

**Acceptance Criteria:**
- New `tracked_keywords` table: `id INTEGER PRIMARY KEY, keyword TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_searched_at DATETIME, result_count INTEGER DEFAULT 0`
- Status values: "pending" (never searched), "active" (producing results), "no_results" (3+ runs, 0 articles), "inactive" (deactivated by user)
- Batch pipeline reads keywords from BOTH env var `KEYWORDS` (backward compat) AND `tracked_keywords` table (active ones)
- New API endpoints:
  - `POST /api/keywords` (admin) — add keyword, validate, check uniqueness
  - `GET /api/keywords` (admin) — list all keywords with status
  - `PATCH /api/keywords/[id]` (admin) — update active status
  - `DELETE /api/keywords/[id]` (admin) — hard delete (remove keyword + optionally its topic)
- Admin UI: `/admin/keywords` page with keyword list + add form
- Validation: 2-100 chars, regex `^[a-zA-Z0-9\s\-]+$`, unique

**Complexity:** M (new table + 4 API endpoints + admin page + batch pipeline integration)
**Dependencies:** None

---

### US-4.2: Deactivate a topic from tracking
**As a** power user, **I want** to stop tracking a topic, **so that** the dashboard stays focused.

**User journey:** Morgan's company resolved the PFAS issue. They don't need to track it anymore. They go to `/admin/keywords`, find "PFAS contamination", click "Deactivate." The keyword's status becomes "inactive." Next batch skips it. The topic remains in the DB with all historical data — Morgan can still view historical scores. But the topic is hidden from the default dashboard view.

**Acceptance Criteria:**
- `PATCH /api/keywords/[id]` with `{ active: false }` → sets status to "inactive"
- Inactive keywords skipped by batch pipeline
- Topics associated with inactive keywords: add `hidden INTEGER DEFAULT 0` to `topics` table. Set `hidden = 1` when keyword deactivated.
- `GET /api/topics` filters out `hidden = 1` by default. Add `?includeHidden=true` for admin views.
- Topic remains accessible via direct URL (`/topic/[slug]`) — data preserved, just hidden from dashboard
- Reactivation: `PATCH /api/keywords/[id]` with `{ active: true }` → sets status back to "pending", unhides topic

**Complexity:** S
**Dependencies:** US-4.1

---

### US-4.3: View tracked keywords and their status
**As a** site administrator, **I want** to see all tracked keywords and their current status, **so that** I can manage what the system monitors.

**User journey:** Operator checks `/admin/keywords` weekly. Sees:
- "climate change" — Active, last searched today, 12 articles
- "PFAS contamination" — Active, last searched today, 4 articles
- "microplastic fish" — No Results (3 runs, 0 articles) — should edit or remove
- "wildfire" — Inactive (deactivated by user)

**Acceptance Criteria:**
- `/admin/keywords` page (same as US-4.1 admin UI) — this is the LIST view
- Table columns: Keyword, Status (with color badge), Last Searched, Article Count, Actions (Activate/Deactivate/Delete)
- Protected by API key (admin auth)
- `GET /api/keywords` returns all keywords with status, last_searched_at, result_count
- Include env-var keywords as "System" type (not editable, not deletable — shown for completeness)

**Complexity:** S
**Dependencies:** US-4.1

---

## Recommendation #5: Backup News Source

> Taleb: "Single dependency on NewsAPI is fragile. A model outage makes every topic 'moderate.'" Porter: "Supplier power is Very High — either vendor changes terms, the product breaks."

### US-5.1: Fall back to alternative news source when NewsAPI is unavailable
**As a** site operator, **I want** the batch pipeline to use a backup news source when NewsAPI fails, **so that** scoring continues even during API outages.

**User journey (operator):**
1. Tuesday 6 AM: cron fires batch.
2. `fetchNews()` calls NewsAPI → 429 Too Many Requests (rate limited) or 5xx (outage)
3. Old behavior: batch logs warning, returns 0 articles, exits. Dashboard stale for 24 hours.
4. New behavior: `fetchNews()` retries once, then calls `fetchNewsFromRSS()`. Gets 8 articles from EPA/NOAA/UN Environment RSS feeds. Batch continues with fewer but valid articles. Dashboard updates.

**Why RSS from government/agency feeds, not GDELT?**
- GDELT is a firehose (250M+ records). Requires complex query filtering. Overkill for backup.
- RSS from EPA, NOAA, UN Environment, IPCC are: free, stable, authoritative, structured, and environmentally focused.
- RSS feeds return fewer articles but higher quality for our domain.

**Acceptance Criteria:**
- `fetchNews()` in batch.ts tries NewsAPI first with existing timeout (15s)
- On failure (network error, non-200 status, 0 results), falls back to RSS fetcher
- RSS sources configurable via `RSS_FEEDS` env var (comma-separated URLs). Default: EPA Press Releases, NOAA Climate News, UN Environment News
- RSS articles normalized to `NewsArticle` interface (same shape as NewsAPI results)
- Dedup handled by existing UNIQUE constraint on `articles.url`
- Batch log entry indicates which source was used: "Fetched 12 articles from NewsAPI" or "NewsAPI unavailable — fetched 8 articles from RSS (EPA, NOAA)"
- If BOTH sources fail: batch logs critical error, exits without updating scores (don't score with 0 articles)

**Complexity:** M (RSS parser + adapter to NewsArticle + fallback logic + new env var)
**Dependencies:** None

---

### US-5.2: Show data source attribution per article
**As a** topic researcher, **I want** to see which data source provided each article, **so that** I can assess source authority and reliability.

**Why this matters:** After US-5.1, articles come from multiple sources. An EPA press release carries different weight than a random NewsAPI result. The researcher should know.

**Acceptance Criteria:**
- `articles` table gains: `source_type TEXT DEFAULT 'newsapi'` (values: "newsapi", "rss")
- Batch pipeline sets `source_type` when inserting articles
- ArticleList component shows a small source-type indicator next to each article's source name. E.g., "Reuters · NewsAPI" or "EPA · RSS Feed"
- Subtle styling — doesn't clutter the article list

**Complexity:** S (1 new column + batch change + small UI badge)
**Dependencies:** US-5.1

---

## Recommendation #6: Shareable Public URLs and Embed Widget

> Godin: "The product is trapped inside the app. There's no way to share it. The ticker bar is the remarkable thing — but nobody outside the app can see it."

### US-6.1: Share a topic page with rich social previews
**As a** journalist, **I want** to share a link to a topic's status page that looks good on social media, **so that** I can reference EcoTicker in my articles and tweets.

**User journey (Jordan, journalist):**
1. Jordan writes an article about Amazon deforestation
2. Wants to cite EcoTicker: "According to EcoTicker, the ecological impact is rated SIGNIFICANT (72/100)"
3. Pastes `ecoticker.com/topic/amazon-deforestation` into their article
4. On Twitter, the link shows a rich card: "Amazon Deforestation — Score: 82 (BREAKING) | EcoTicker" with a description and image

**Architectural note:** The topic detail page (`src/app/topic/[slug]/page.tsx`) is currently `"use client"`. OG meta tags MUST be server-rendered for social crawlers (Twitter/LinkedIn don't execute JavaScript). Next.js App Router supports this via `generateMetadata()` in a server component. Options:
1. Split the page: server layout with `generateMetadata()` + client interactive section
2. Move metadata to a `layout.tsx` in the `topic/[slug]/` directory
3. Fetch topic data server-side for metadata, pass to client component via props

Option 2 is cleanest with Next.js App Router conventions.

**Acceptance Criteria:**
- Add `src/app/topic/[slug]/layout.tsx` (server component) with `generateMetadata()`:
  - Fetches topic data server-side (direct DB call, not API fetch)
  - Sets `og:title`: "[Topic Name] — Score: [Score] ([URGENCY]) | EcoTicker"
  - Sets `og:description`: topic's overallSummary or impactSummary (first 200 chars)
  - Sets `og:image`: static fallback initially. Dynamic via US-6.3 later.
  - Sets `og:url`: canonical URL
  - Sets Twitter card meta tags
- "Share" button on topic detail page:
  - Copies current URL to clipboard
  - Shows brief "Link copied!" confirmation (2s fade)
  - Uses Clipboard API with `<button>` (not navigator.share — broader support)
- `<title>` tag includes topic name + score

**Complexity:** S (layout file + generateMetadata + share button)
**Dependencies:** None for basic implementation. US-1.1 enriches `og:description` with overallSummary.

---

### US-6.2: Embed a live topic widget on external websites
**As a** blogger or journalist, **I want** to embed a live EcoTicker widget on my site, **so that** readers can see current environmental scores without leaving my page.

**User journey (Jordan, journalist):**
1. Jordan writes a long-form piece about Arctic sea ice
2. Wants to show live data inline: the current score and trend
3. Goes to the Arctic Ice topic on EcoTicker
4. Clicks "Embed" → gets: `<iframe src="ecoticker.com/embed/arctic-sea-ice-decline?theme=light" width="300" height="150" />`
5. Pastes into their CMS. Readers see a live mini-widget with score, sparkline, and urgency badge.

**Acceptance Criteria:**
- New route: `/embed/[slug]/page.tsx` — minimal page with NO navigation, header, or footer
- Renders: topic name (small), current score (large, colored), urgency badge, sparkline
- Auto-refreshes every 5 minutes (same as TickerBar)
- Theme via query param: `?theme=dark` or `?theme=light` (default: light)
- Dimensions: designed for 300x150 (default) but responsive within iframe
- "Copy embed code" button on the topic detail page (near the Share button from US-6.1)
- CSP: update middleware to allow framing from any origin for `/embed/*` routes (currently CSP blocks framing)
- Minimal JS bundle — embed page should be lightweight

**Complexity:** M (new route + responsive mini-component + CSP update + embed code generator)
**Dependencies:** None

---

### US-6.3: Generate dynamic social card images
**As a** social media user, **I want** visually appealing preview cards when sharing EcoTicker links, **so that** shared links attract clicks and convey information at a glance.

**User journey:** Jordan shares `ecoticker.com/topic/arctic-sea-ice-decline` on Twitter. Instead of a generic placeholder, the card shows: "Arctic Sea Ice Decline" in bold, a large "85" in red, "BREAKING" badge, mini sparkline, and three small sub-score bars (health/eco/econ).

**Acceptance Criteria:**
- New API route: `/api/og/[slug]/route.tsx` using Next.js `ImageResponse` (built-in OG image generation)
- Image content: topic name, current score (large, colored by urgency), urgency badge, sparkline (simplified SVG), sub-score mini bars (3 horizontal bars with labels)
- Dimensions: 1200x630 (Twitter/LinkedIn standard)
- Referenced by `og:image` in US-6.1's `generateMetadata()`
- Cache strategy: images cached by CDN. URL includes score hash so it regenerates when score changes: `/api/og/[slug]?v=[score]`
- Graceful degradation: if sub-scores aren't available (pre-US-1.1 or all INSUFFICIENT_DATA), show only overall score

**Complexity:** M (OG image generation with layout + data fetching)
**Dependencies:** US-6.1 (provides the generateMetadata() that references this image). US-1.1 enhances with sub-score bars.

---

## Recommendation #7: Score Anomaly Detection

> **ABSORBED into US-1.1.** See US-1.1 acceptance criteria.

### ~~US-7.1: Flag suspicious score jumps~~ → ABSORBED into US-1.1
`detectAnomaly()` is part of the scoring pipeline. Threshold: >25 points (one full rubric level). Stored in `score_history.anomaly_detected`. Warning logged.

**Future story (not v2):** Dedicated admin anomaly browser with filtering and bulk acknowledgment.

### ~~US-7.2: Store raw LLM responses~~ → ABSORBED into US-1.1
`raw_llm_response TEXT` is a column in the new `score_history` schema. Stored for every scoring run. No retention limit initially.

**Future story (not v2):** Admin API endpoint for querying raw responses + 90-day auto-pruning.

---

## Recommendation #8: Basic Analytics

> Drucker: "Zero product metrics. No way to know if the product is useful." At minimum: know which topics people actually look at.

### US-8.1: Track page views per topic
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

### US-8.2: View a simple analytics dashboard
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

## Recommendation #9: Database Backup

> Taleb: "Single-file SQLite database with no backup mechanism. A corrupt file = total data loss."

### US-9.1: Automatic daily database backup
**As a** site operator, **I want** the database backed up daily before the batch run, **so that** I can recover from corruption, bad batch runs, or accidental deletion.

**Why BEFORE the batch run:** If the batch corrupts the DB (unlikely with SQLite WAL but possible with disk full, power loss, etc.), you want a backup from BEFORE the corruption. Backup at 5:55 AM, batch at 6:00 AM.

**Acceptance Criteria:**
- New script: `scripts/backup.ts`
  - Uses `better-sqlite3`'s `.backup()` API (not shell commands — native, atomic, handles WAL correctly)
  - Destination: `/backups/ecoticker-YYYY-MM-DD.db`
  - After backup: scan `/backups/`, delete files older than 7 days
  - On success: log "Backup complete: ecoticker-2026-02-12.db (2.4 MB)"
  - On failure: log error with details. Exit code 0 (don't block the cron pipeline)
- Crontab updated: `55 5 * * * /app/scripts/backup.sh` (before the 6 AM batch)
- Docker: backup directory mapped to the named volume (persists across container restarts)

**Complexity:** S (10-line script + crontab entry)
**Dependencies:** None

---

## Recommendation #10: User Feedback Mechanism

> Collins' flywheel: "More users → More feedback → Better calibration → More trust → More users." Meadows: "The system has no feedback loop. Information flows one way."

### US-10.1: Report an inaccurate score with per-dimension targeting
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

### US-10.2: View aggregated feedback to identify calibration issues
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

## Recommendation #11: GDPR Compliance & Data Policy

> Launching in the EU means GDPR applies from day one. This is not optional — it's a legal requirement. Article 13 requires transparent disclosure of data processing. Article 5(1)(c) requires data minimization.

### US-11.1: Display a GDPR-compliant data policy page
**As a** European visitor, **I want** to understand what data EcoTicker collects and how it's used, **so that** I can trust the service and exercise my rights under GDPR.

**Why this is a launch blocker:**
EcoTicker launches in Europe. Under GDPR, any service accessible to EU residents must:
1. Disclose what personal data is collected (Article 13)
2. State the legal basis for processing (Article 6)
3. Explain retention periods (Article 13(2)(a))
4. Provide contact information for the data controller (Article 13(1)(a))
5. Inform users of their rights (access, deletion, portability — Articles 15-20)

Without this page, operating in the EU is a legal liability.

**What personal data does EcoTicker actually collect?**
After the GDPR audit, very little:
- **Truncated IP addresses** in audit_logs and score_feedback — last octet zeroed, not reversible to individuals. Legal basis: legitimate interest (abuse prevention).
- **No cookies** (theme preference uses localStorage, not cookies — no cookie banner needed).
- **No user accounts** — no email, no name, no password.
- **No tracking pixels** — no Google Analytics, no Meta Pixel, no third-party trackers.
- **No fingerprinting** — user_agent removed from audit_logs.
- **Page view counts** — aggregated daily per topic, no individual identification.

**This is a strong privacy story.** Most competing sites collect far more. The data policy page should communicate this clearly — privacy-by-design is a competitive advantage, not just compliance.

**Acceptance Criteria:**

**Data Policy page (`/data-policy`):**
- Static page (server component, no client JS needed)
- Sections (following GDPR Article 13 structure):

  1. **What We Collect** — plain-language table:
     | Data | Where | Why | Retained |
     |------|-------|-----|----------|
     | Truncated IP addresses | Audit logs, feedback reports | Abuse prevention | 90 days |
     | Page view counts | Topic analytics | Understanding which topics matter | Indefinite (no PII) |
     | Feedback text | Score feedback form | Improving scoring accuracy | Indefinite (no PII) |
     | Theme preference | Your browser (localStorage) | Remembering light/dark mode | Until you clear browser data |

  2. **What We Don't Collect** — explicitly state:
     - No cookies (no cookie banner needed)
     - No user accounts or personal profiles
     - No email addresses
     - No tracking pixels or third-party analytics
     - No browser fingerprinting
     - No data sold to third parties

  3. **Legal Basis** — Legitimate interest (Article 6(1)(f)) for truncated IP storage (abuse prevention). No consent required because IPs are truncated and not individually identifiable.

  4. **Your Rights** — Under GDPR, you have the right to:
     - Access your data (Article 15)
     - Request deletion (Article 17)
     - Object to processing (Article 21)
     - Since we store no individually-identifiable data, there is typically nothing to access or delete. Contact us if you have questions.

  5. **Data Retention** — Audit logs auto-purged after 90 days. Aggregated analytics retained indefinitely (not PII). Score feedback retained indefinitely (not individually identifiable).

  6. **Data Controller** — Contact information (email address for privacy inquiries). Required by Article 13(1)(a).

  7. **Changes to This Policy** — "We'll update this page if our practices change. Last updated: [date]."

- SEO: proper `<title>`: "Data Policy | EcoTicker", `<meta description>`
- Linked from: site footer (persistent across all pages), scoring methodology page (US-2.2)
- Language: plain English, not legalese. GDPR requires information to be "concise, transparent, intelligible and in easily accessible form, using clear and plain language" (Article 12(1)).

**What this story does NOT include:**
- Cookie consent banner — not needed (no cookies used)
- DPIA (Data Protection Impact Assessment) — not required (no high-risk processing, no profiling, no large-scale systematic monitoring)
- DPO (Data Protection Officer) — not required (not a public authority, no large-scale processing of sensitive data)

**Complexity:** S (static content page + footer link)
**Dependencies:** None (can ship in any phase, but should be ready at launch)
**Blocks:** Nothing

---

### GDPR: Schema & Code Changes (bundled into Phase 0)

These are NOT a separate user story — they're engineering tasks inside Phase 0:

1. **Remove `audit_logs.user_agent` column** — not needed, PII risk
2. **Truncate IP addresses before storage** — utility function:
   ```typescript
   function truncateIp(ip: string): string {
     if (ip.includes(":")) {
       // IPv6: zero last 80 bits (keep /48 prefix)
       return ip.replace(/:[\da-f]*:[\da-f]*:[\da-f]*:[\da-f]*:[\da-f]*$/i, "::0");
     }
     // IPv4: zero last octet
     return ip.replace(/\.\d+$/, ".0");
   }
   ```
3. **Apply truncation** in `audit-log.ts` (`logSuccess`, `logFailure`) and score feedback endpoint
4. **Add 90-day auto-purge** for audit_logs — run in batch pipeline or as separate cron step:
   ```sql
   DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days'
   ```
5. **Add footer link** to `/data-policy` in root layout

---

## Summary

| Rec # | Stories | Complexity | Notes |
|-------|---------|------------|-------|
| 1. Scoring + sub-scores + categories | US-1.1, 1.2, 1.3, 1.4, 1.5 | L + M + M + S + S | US-1.1 is the foundation for everything |
| 2. Explainability | US-2.1, 2.2 | S + M | Merged old 2.1 into 1.2; renumbered |
| 3. Dynamic headline | US-3.1 | S | Level transitions, not raw deltas |
| 4. Configurable keywords | US-4.1, 4.2, 4.3 | M + S + S | Search keywords, not topics |
| 5. Backup news source | US-5.1, 5.2 | M + S | RSS from government agencies |
| 6. Shareable/embeddable | US-6.1, 6.2, 6.3 | S + M + M | Needs generateMetadata() architecture |
| 7. Anomaly detection | ~~7.1, 7.2~~ | — | Absorbed into US-1.1 |
| 8. Basic analytics | US-8.1, 8.2 | S + M | Fire-and-forget counting |
| 9. Database backup | US-9.1 | S | Before batch, not after |
| 10. User feedback | US-10.1, 10.2 | S + S | Per-dimension with reasoning context |
| 11. GDPR & data policy | US-11.1 | S | EU launch requirement, privacy-by-design |

**Total: 21 stories** (was 23 → 2 absorbed into US-1.1, 1 merged into US-1.2, 1 added for GDPR)
**Breakdown: 1 Large, 6 Medium, 14 Small**

---

## Recommended Implementation Order

### Phase 1: Foundation
**US-1.1** — Scoring architecture (L)
Everything else either depends on this or is enhanced by it. After this ships, the data is correct.

### Phase 2: Make It Visible
**US-1.2** (M), **US-1.5** (S), **US-2.2** (M), **US-11.1** (S)
Sub-score breakdown with reasoning, category labels on cards, scoring methodology page, GDPR data policy page. After this ships, users can see AND understand the new architecture — and we're legally compliant for EU launch.

### Phase 3: Depth
**US-1.3** (M), **US-1.4** (S), **US-3.1** (S), **US-2.1** (S)
Sub-score history trends, category filters, dynamic headline, article count indicator. Deeper engagement features.

### Phase 4: Operational Resilience
**US-5.1** (M), **US-5.2** (S)
Backup news source, source attribution. US-9.1 eliminated (Railway managed backups). The system becomes reliable.

### Phase 5: Admin & Measurement
**US-4.1** (M), **US-4.2** (S), **US-4.3** (S), **US-8.1** (S), **US-8.2** (M)
Keyword management, analytics. We can now grow topic coverage and measure usage.

### Phase 6: Growth & Feedback Loop
**US-6.1** (S), **US-6.2** (M), **US-6.3** (M), **US-10.1** (S), **US-10.2** (S)
Sharing, embedding, social cards, user feedback. The product escapes the app and improves through usage.

---

**Next step:** Review each story. Approve, modify, or reject. Then begin implementation with US-1.1.
