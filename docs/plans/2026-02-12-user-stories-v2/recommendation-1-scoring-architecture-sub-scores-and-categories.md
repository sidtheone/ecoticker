# Recommendation #1: Scoring Architecture, Sub-Scores, and Categories

> Kim & Mauborgne: "Don't add new capabilities. Surface the capabilities you already have." The data is richer than the UI reveals. But first, the data must be CORRECT — and right now it isn't.

## US-1.0: Research optimal sub-scoring approach with LLMs
**Status:** DONE
**Output:** `docs/plans/2026-02-09-llm-scoring-research.md` (v3, 30+ sources)

---

## US-1.1: Implement the US-1.0 scoring architecture
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

## US-1.2: View sub-score breakdown with reasoning on topic detail page
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

## US-1.3: Toggle sub-score trend lines on the score history chart
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

## US-1.4: Filter dashboard by category
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

## US-1.5: Show category label on topic card
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
