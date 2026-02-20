# LLM Sub-Scoring Strategy — Deep Research (v2)

**Date:** 2026-02-09
**User Story:** US-1.0
**Status:** Research complete — awaiting review
**Revision:** v3 — fresh launch (no migration), corrected scale, few-shot calibration, fixed temperature, anti-bias instructions

---

## Executive Summary

After researching LLM-as-a-judge literature (G-Eval, Rubrics-as-Rewards, AutoCalibrate), environmental scoring frameworks (Yale EPI, MSCI ESG, ISO 14001, Sustainalytics), and prompt engineering best practices, the recommended approach is:

> **4-level rubric-based chain-of-thought scoring with few-shot calibration examples, reasoning-first output order, temperature 0, and server-side weighted aggregation.**

Key changes from v1:
- **4 levels, not 5** — research shows LLMs are most reliable with compact scales (3-4 levels). 4 aligns with the existing urgency system.
- **Few-shot calibration examples added** — research shows +25-30% accuracy improvement over zero-shot.
- **Temperature dropped to 0** (from current 0.3) — scoring requires maximum determinism.
- **Anti-bias instructions added** — explicitly counter central tendency and severity bias.
- **"Insufficient data" option added** — LLM can declare a dimension not assessable rather than guessing.

---

## Part 1: What's Wrong with the Current Approach

The current `scoreTopic()` prompt in `scripts/batch.ts:149-193`:

```
Rate severity on 0-100 scale. Respond with ONLY valid JSON:
{ "score": 50, "healthScore": 40, "ecoScore": 60, "econScore": 45, ... }
```

Current `callLLM()` uses `temperature: 0.3`.

### Five critical problems:

**1. No calibration criteria.**
The LLM invents what "40" means each time. Research: LLMs are "not naturally calibrated for high-precision scoring" on 0-100 scales. Binary or low-precision evaluations are significantly more reliable.
— [Evidently AI: LLM-as-a-Judge Guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)

**2. Central tendency bias.**
Without explicit criteria, LLMs cluster scores around the middle of the scale (40-60 range). This makes most environmental topics look "moderate" regardless of actual severity.
— [arXiv: Evaluating Scoring Bias in LLM-as-a-Judge](https://arxiv.org/html/2506.22316v1)

**3. Reasoning suppressed.**
The prompt says "Respond with ONLY valid JSON" — actively preventing chain-of-thought. G-Eval research shows that CoT decomposition into sub-criteria reduces bias and improves accuracy, BUT only when paired with explicit rubrics. CoT without rubrics has no significant effect on scoring accuracy.
— [G-Eval: Liu et al., EMNLP 2023](https://arxiv.org/abs/2303.16634)
— [ScienceDirect: Applying LLMs and CoT for Automatic Scoring](https://www.sciencedirect.com/science/article/pii/S2666920X24000146)

**4. Temperature too high for scoring.**
Current `temperature: 0.3` introduces unnecessary randomness. For scoring tasks, temperature should be 0 (greedy decoding) to maximize consistency. Even temperature 0 isn't perfectly deterministic due to floating-point arithmetic and distributed systems, but it's the closest we can get.
— [Mervin Praison: LLM-as-Judge Best Practices](https://mer.vin/2025/11/llm-as-a-judge-best-practices-for-consistent-evaluation/)
— [mbrenndoerfer: Why Temperature=0 Doesn't Guarantee Determinism](https://mbrenndoerfer.com/writing/why-llms-are-not-deterministic)

**5. Silent model drift.**
If OpenRouter swaps the underlying model, all scores shift with zero detection. No ground truth, no level distribution tracking, no anomaly alerting exists.

---

## Part 2: Are health/eco/econ the Right Dimensions?

### What the professionals use

**Yale Environmental Performance Index (2024)** — 58 indicators across 11 categories, three top-level dimensions:

| Dimension | Weight | Sub-categories |
|---|---|---|
| **Ecosystem Vitality** | 45% | Biodiversity, Forests, Fisheries, Agriculture, Water, Air Pollution |
| **Environmental Health** | 30% | Air Quality, Sanitation, Heavy Metals, Waste Management |
| **Climate Change** | 25% | CO2 mitigation, Methane, F-gases, Projections |

— [Yale EPI 2024](https://epi.yale.edu/measure/2024/epi)

**MSCI ESG Ratings** — 35 key issues per industry, scored on Exposure (how exposed) and Management (how well managed). Materiality-weighted.
— [MSCI ESG Ratings](https://www.msci.com/data-and-analytics/sustainability-solutions/esg-ratings)

**Sustainalytics** — Three axes: preparedness, disclosure, performance. 70+ indicators per industry. Five risk levels: negligible, low, medium, high, severe.
— [Sustainalytics ESG Risk Ratings](https://www.sustainalytics.com/esg-data)

**ISO 14001** — Environmental aspect significance scored via FMEA (Failure Mode and Effects Analysis): severity x frequency x detection. Severity uses qualitative levels (negligible through catastrophic). Total risk score of 100.
— [ISO 14001 Environmental Aspects Evaluation](https://advisera.com/14001academy/blog/2016/10/31/iso-140012015-how-to-set-criteria-for-environmental-aspects-evaluation/)
— [GlenView Group: Scoring Environmental Aspects](https://glenviewgroup.com/2016/05/31/identifying-scoring-environmental-aspects-iso-14001-environmental-management-system/)

### Assessment

| Current | Maps to | Fit |
|---|---|---|
| `healthScore` | EPI "Environmental Health" | Strong — standard dimension across all frameworks |
| `ecoScore` | EPI "Ecosystem Vitality" | Strong — core to every environmental framework |
| `econScore` | Not in EPI (purely environmental) | Reasonable for news — ISO 14001 includes "business factors" in significance scoring |

### Decision: Keep health/eco/econ

The three dimensions are sound for a news severity tool. They map to established frameworks and cover the three angles people intuitively ask about environmental events: "Is this dangerous to people? Is it damaging nature? What does it cost?"

But they need **explicit, rubric-level definitions** (see Part 4).

---

## Part 3: Scoring Approaches Compared

| Approach | Reliability | Explainability | Cost | Practical? |
|---|---|---|---|---|
| **A. Direct Numeric** (current) | Low — central tendency bias, no calibration | None | 1 call | Yes but insufficient |
| **B. CoT + Numeric 0-100** | Medium — CoT helps but 0-100 is too granular | Good | 1 call | Better, but false precision |
| **C. Rubric-Based 4-Level + CoT** | **High** — categorical with defined criteria | **Excellent** | 1 call | **Recommended** |
| **D. Multi-Pass Self-Consistency** | Highest — majority vote across 3 runs | Good | 3x calls | Overkill for daily batch |
| **E. G-Eval Probability Weighting** | Very High — token-level log-prob scoring | Medium | 1 call + logprobs | Not practical on OpenRouter |

### Why Approach C wins

Research converges on this:

1. **"LLMs are more reliable with compact integer scales like 1 to 4 because they are well-defined points"** — 4 levels is the sweet spot. 3 is too coarse for environmental scoring, 5+ degrades reliability.
— [Monte Carlo Data: 7 Best Practices](https://www.montecarlodata.com/blog-llm-as-judge/)

2. **Rubric-based categorical outperforms direct numeric** — "Rubrics as Rewards replaces the opaque reward signal of subjective preference with a detailed, structured, and verifiable rubric."
— [Rubrics as Rewards (RaR)](https://arxiv.org/html/2507.17746v2)

3. **CoT improves accuracy ONLY when paired with rubrics** — "CoT, when used without item stem and scoring rubrics, did not significantly affect scoring accuracy. However, CoT enhances accuracy and transparency, particularly when used with item stem and scoring rubrics."
— [ScienceDirect: Automatic Scoring with CoT](https://www.sciencedirect.com/science/article/pii/S2666920X24000146)

4. **Few-shot examples add 25-30% accuracy** — "Zero-shot baseline accuracy improves by 15-20% with 1 example per score and 25-30% with 2-3 examples per score."
— [Towards Data Science: LLM-as-a-Judge Practical Guide](https://towardsdatascience.com/llm-as-a-judge-a-practical-guide/)

5. **Reason-first, then score** — "Placing the score after the reasons allows it to reference both the reasons and the input prompt, a dynamic not possible when this order is reversed."
— [arXiv: LLM as a Scorer: Impact of Output Order](https://arxiv.org/html/2406.02863v1)

### Why NOT the other approaches

| Approach | Why not |
|---|---|
| **Keep 0-100 direct** | Central tendency bias. LLMs cluster around 50. No calibration possible without rubric. |
| **Binary** | Too coarse for environmental news. "Severe/Not severe" loses critical nuance. |
| **5-level scale** | Research shows reliability drops with 5+ levels. 4 aligns with existing urgency system (informational/moderate/critical/breaking). |
| **Multi-pass** | 3x cost, marginal gain. Self-consistency with 8 samples can match 30-sample accuracy using confidence weighting (CISC), but even that is overkill for daily batch. |
| **G-Eval** | Requires logprob API access. OpenRouter proxies multiple models — logprob support varies. Not portable. |
| **Separate call per dimension** | 3x cost AND loses cross-dimensional context. A health crisis has eco and econ impacts — single-call captures this. |

---

## Part 4: The Recommended Architecture

### 4.1: The 4-Level Severity Rubric

Aligned with the existing urgency system (informational/moderate/critical/breaking) and Sustainalytics risk levels.

**Each dimension uses this scale:**

| Level | Label | Score Range | Criteria | Real-World Anchor |
|---|---|---|---|---|
| 1 | **MINIMAL** | 0-25 | No measurable impact on this dimension. Theoretical, hypothetical, or negligible risk. Routine monitoring only. No population affected. | New recycling policy announced. Research paper published on future climate models. |
| 2 | **MODERATE** | 26-50 | Localized, limited impact. Affects a small population or confined area. Reversible with standard response. Some concern but not urgent. | Air quality advisory in one city. Minor chemical spill contained within hours. Local fishery reports declining catch. |
| 3 | **SIGNIFICANT** | 51-75 | Widespread or serious impact. Affects a large population, region, or critical ecosystem. Difficult to reverse. Requires significant response. | Multi-state wildfire season with evacuations. Industrial contamination of regional water supply. Major species population decline documented. |
| 4 | **SEVERE** | 76-100 | Catastrophic, potentially irreversible impact. Mass casualties, ecosystem collapse, or economy-wide disruption. Emergency-level response required. | Fukushima-level disaster. Amazon deforestation reaching tipping point. Pandemic-scale health emergency from environmental cause. |

**Why 4 levels, not 5:**
- Research shows 3-4 levels are the reliability sweet spot for LLMs
- Maps directly to existing urgency: MINIMAL=informational, MODERATE=moderate, SIGNIFICANT=critical, SEVERE=breaking
- Equal 25-point ranges per level (clean, no uneven bands)
- Sustainalytics uses a similar 4-tier core classification

**Why equal 25-point ranges:**
The initial v1 doc used uneven ranges (16/20/24/20/21 points). Equal ranges are:
- Simpler for the LLM to understand
- Easier to validate (score / 25 → level)
- No artificial precision in boundary placement

### 4.2: Few-Shot Calibration Examples

Research shows +25-30% accuracy improvement with examples. One example per level, covering different environmental event types.

```
## Calibration Examples

EXAMPLE 1 — Topic: "Urban Park Restoration Initiative"
Articles describe a city announcing a new park restoration program.
- healthLevel: MINIMAL, healthScore: 12
  Reasoning: No direct health risk or benefit yet. The program is in planning stages.
- ecoLevel: MINIMAL, ecoScore: 15
  Reasoning: Positive future ecological impact, but no measurable change has occurred yet.
- econLevel: MINIMAL, econScore: 8
  Reasoning: Minor budget allocation, no economic disruption.

EXAMPLE 2 — Topic: "Delhi Air Quality Crisis"
Articles describe PM2.5 levels reaching hazardous levels in Delhi for a week.
- healthLevel: MODERATE, healthScore: 42
  Reasoning: Hazardous air quality affects millions of residents. Schools closed. Vulnerable populations at risk of respiratory illness.
- ecoLevel: MODERATE, ecoScore: 30
  Reasoning: Air pollution damages local vegetation and contributes to regional haze, but is seasonal and partially reversible.
- econLevel: MODERATE, econScore: 38
  Reasoning: Construction halts, school closures, and reduced outdoor economic activity. Tourism affected. Temporary but significant.

EXAMPLE 3 — Topic: "Great Barrier Reef Mass Bleaching"
Articles describe the 5th mass bleaching event in 8 years affecting 80% of the reef.
- healthLevel: MODERATE, healthScore: 28
  Reasoning: No immediate human health impact, but long-term food security concerns for coastal communities dependent on reef fisheries.
- ecoLevel: SIGNIFICANT, ecoScore: 72
  Reasoning: 80% of the world's largest coral reef system affected. Repeated bleaching events prevent recovery. Cascading effects on marine biodiversity are well-documented.
- econLevel: SIGNIFICANT, econScore: 58
  Reasoning: Reef tourism generates $6.4B annually. Fisheries decline affects thousands of livelihoods. Recovery costs are enormous.

EXAMPLE 4 — Topic: "Fukushima Wastewater Release"
Articles describe Japan beginning release of treated radioactive wastewater into the Pacific.
- healthLevel: SIGNIFICANT, healthScore: 55
  Reasoning: Tritium and other radionuclides released into ocean. While diluted, long-term bioaccumulation risks are uncertain. Seafood contamination fears are widespread.
- ecoLevel: SEVERE, ecoScore: 78
  Reasoning: Unprecedented release of radioactive material into the Pacific over decades. Marine ecosystem effects are unknown and potentially irreversible. Sets a precedent for nuclear waste disposal.
- econLevel: SIGNIFICANT, econScore: 62
  Reasoning: China and South Korea ban Japanese seafood imports. Japanese fishing industry devastated. Regional trade disrupted.
```

### 4.3: The Complete Prompt

```
You are an environmental impact analyst scoring the severity of news events.
Analyze the following articles about "${topicName}".

Articles:
${articleSummaries}

## Scoring Rubric

For EACH of the three dimensions below, you MUST:
1. First, write 2-3 sentences of reasoning citing specific articles
2. Then, classify the severity level (MINIMAL / MODERATE / SIGNIFICANT / SEVERE)
3. Then, assign a numeric score within the level's range

### Severity Levels:
- MINIMAL (0-25): No measurable impact. Theoretical or negligible risk. Routine monitoring only.
- MODERATE (26-50): Localized, limited impact. Affects small population or confined area. Reversible.
- SIGNIFICANT (51-75): Widespread or serious impact. Large population or critical ecosystem affected. Difficult to reverse.
- SEVERE (76-100): Catastrophic, potentially irreversible. Mass casualties, ecosystem collapse, or economy-wide disruption.

### Dimensions:
1. **Health Impact**: Risk to human health and wellbeing — air/water quality, disease, food safety, physical harm, mortality
2. **Ecological Impact**: Damage to ecosystems and biodiversity — species loss, habitat destruction, deforestation, ocean/water/soil damage
3. **Economic Impact**: Financial and livelihood consequences — industry disruption, job losses, infrastructure damage, agricultural losses, cleanup costs

${fewShotExamples}

## Anti-Bias Instructions
- Do NOT default to MODERATE. Use the full range of levels based on evidence.
- Base severity ONLY on what the articles describe, not on general knowledge about the topic.
- If the articles do not contain enough information to assess a dimension, use "INSUFFICIENT_DATA" as the level and -1 as the score.
- A new recycling program and a nuclear disaster should NOT receive similar scores.

## Response Format

Respond with ONLY valid JSON:
{
  "healthReasoning": "2-3 sentences citing specific articles",
  "healthLevel": "MODERATE",
  "healthScore": 38,
  "ecoReasoning": "2-3 sentences citing specific articles",
  "ecoLevel": "SIGNIFICANT",
  "ecoScore": 65,
  "econReasoning": "2-3 sentences citing specific articles",
  "econLevel": "MINIMAL",
  "econScore": 18,
  "overallSummary": "1-2 sentence synthesis of the combined environmental impact",
  "category": "climate",
  "region": "Global",
  "keywords": ["keyword1", "keyword2"]
}

IMPORTANT:
- The numeric score MUST fall within the range for the level you chose.
- The overall score and urgency will be computed server-side. Do NOT include them.
- Use "INSUFFICIENT_DATA" and -1 if a dimension cannot be assessed from the articles.
```

### 4.4: Server-Side Scoring Logic

```typescript
// --- Level validation ---
const LEVEL_RANGES: Record<string, [number, number]> = {
  MINIMAL: [0, 25],
  MODERATE: [26, 50],
  SIGNIFICANT: [51, 75],
  SEVERE: [76, 100],
};

function validateScore(level: string, score: number): { level: string; score: number; clamped: boolean } {
  // Handle insufficient data
  if (level === "INSUFFICIENT_DATA" || score === -1) {
    return { level: "INSUFFICIENT_DATA", score: -1, clamped: false };
  }

  // Handle unknown level — fall back to MODERATE with warning
  if (!LEVEL_RANGES[level]) {
    console.warn(`Unknown level "${level}", falling back to MODERATE`);
    return { level: "MODERATE", score: Math.max(26, Math.min(50, score)), clamped: true };
  }

  const [min, max] = LEVEL_RANGES[level];
  const clampedScore = Math.max(min, Math.min(max, score));
  return {
    level,
    score: clampedScore,
    clamped: clampedScore !== score,
  };
}

// --- Weighted overall score ---
function computeOverallScore(
  healthScore: number,
  ecoScore: number,
  econScore: number
): number {
  // Handle insufficient data dimensions — exclude from average
  const dimensions: { score: number; weight: number }[] = [];

  if (healthScore >= 0) dimensions.push({ score: healthScore, weight: 0.35 });
  if (ecoScore >= 0) dimensions.push({ score: ecoScore, weight: 0.40 });
  if (econScore >= 0) dimensions.push({ score: econScore, weight: 0.25 });

  if (dimensions.length === 0) return 50; // fallback: truly no data

  // Normalize weights to sum to 1.0
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weightedSum = dimensions.reduce((sum, d) => sum + d.score * (d.weight / totalWeight), 0);

  return Math.round(weightedSum);
}

// --- Urgency derivation (backward compatible) ---
function deriveUrgency(overallScore: number): string {
  if (overallScore >= 80) return "breaking";
  if (overallScore >= 60) return "critical";
  if (overallScore >= 30) return "moderate";
  return "informational";
}

// --- Anomaly detection ---
function detectAnomaly(
  previousScore: number,
  newScore: number,
  topicName: string,
  dimension: string
): boolean {
  const delta = Math.abs(newScore - previousScore);
  if (delta > 25) { // one full level jump
    console.warn(
      `ANOMALY: ${topicName} ${dimension} jumped ${delta} points ` +
      `(${previousScore} → ${newScore}). Review recommended.`
    );
    return true;
  }
  return false;
}
```

### 4.5: Weight Rationale

| Dimension | Weight | Rationale |
|---|---|---|
| **Ecological** | 40% | Core mission of EcoTicker. "Eco" is in the name. Maps to EPI Ecosystem Vitality (45%). Slightly reduced because we're scoring news events, not policy. |
| **Health** | 35% | Most immediately salient to users. "People are getting sick" is the most attention-driving frame. Maps to EPI Environmental Health (30%). Slightly increased for news context. |
| **Economic** | 25% | Contextual but important. Not in EPI (purely environmental), but ISO 14001 includes business factors. Lowest weight because economic impact alone doesn't make something an *environmental* crisis. |

**Why not let the LLM set the overall score?**
The LLM's job is classification and reasoning. Server-side aggregation is:
- Deterministic (same sub-scores always produce same overall)
- Transparent (users can see exactly how it's computed)
- Tunable (weights can be adjusted without re-prompting)
- Auditable (no hidden weighting decisions in the LLM's head)

### 4.6: Temperature and Model Settings

| Setting | Current | Recommended | Why |
|---|---|---|---|
| `temperature` | 0.3 | **0** | Scoring requires maximum determinism. 0.3 introduces randomness that serves no purpose in classification. |
| `top_p` | (default) | **1** | Ensure top_p doesn't override temperature=0. Some APIs ignore temp when top_p is set. |
| `response_format` | (none) | **json_object** (if supported) | OpenRouter supports `response_format: { type: "json_object" }` which constrains output to valid JSON. |

---

## Part 5: What Changes in the Codebase

### Database schema (fresh — update `db/schema.sql` directly)

No migration needed — this is a fresh launch. The complete schema for the affected tables:

```sql
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'climate',
  region TEXT,
  current_score INTEGER DEFAULT 0,
  previous_score INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 0,
  eco_score INTEGER DEFAULT 0,
  econ_score INTEGER DEFAULT 0,
  urgency TEXT DEFAULT 'informational',
  impact_summary TEXT,
  score_reasoning TEXT,
  image_url TEXT,
  article_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  score INTEGER NOT NULL,
  health_score INTEGER,
  eco_score INTEGER,
  econ_score INTEGER,
  health_level TEXT,
  eco_level TEXT,
  econ_level TEXT,
  health_reasoning TEXT,
  eco_reasoning TEXT,
  econ_reasoning TEXT,
  impact_summary TEXT,
  overall_summary TEXT,
  raw_llm_response TEXT,
  anomaly_detected INTEGER DEFAULT 0,
  recorded_at DATE DEFAULT (date('now'))
);
```

Note: `articles`, `topic_keywords`, and `audit_logs` tables are unchanged.

### Batch pipeline changes (`scripts/batch.ts`)

1. Replace `scoreTopic()` prompt with rubric-based version (Part 4.3)
2. Change `temperature: 0.3` to `temperature: 0` in `callLLM()`
3. Add `response_format: { type: "json_object" }` to `callLLM()`
4. Add `validateScore()` for level-score consistency (Part 4.4)
5. Compute `overallScore` server-side via `computeOverallScore()` (Part 4.4)
6. Derive `urgency` server-side via `deriveUrgency()` (Part 4.4)
7. Store reasoning fields, levels, raw LLM response, and anomaly flag
8. Add anomaly detection via `detectAnomaly()` (Part 4.4)
9. Update `TopicScore` interface to include new fields
10. Update `insertScore` and `insertTopic` prepared statements for new columns

### API changes

1. `/api/topics` — include `healthScore`, `ecoScore`, `econScore` in response
2. `/api/topics/[slug]` — include reasoning fields and levels in detail response
3. `score_history` entries include reasoning and levels when available

### UI changes (separate stories — US-1.1, US-1.2, US-2.1, US-2.3)

- Topic detail page shows sub-scores with color indicators
- Topic detail page shows reasoning text
- Score history chart shows sub-score trends
- Score explainer modal describes the 4-level system

---

## Part 6: Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM ignores rubric, scores arbitrarily | Medium | High | `validateScore()` clamps to level range. Log all clamping events. Alert if >30% of scores are clamped in a batch run. |
| LLM returns invalid JSON | Low | Medium | `extractJSON()` already handles this. Add `response_format: { type: "json_object" }` as additional guard. Existing fallback to score=50 remains. |
| Model swap shifts all scores | Medium | High | Store `raw_llm_response`. Track level distribution per batch run. Alert if >50% of topics change level in one run. |
| CoT reasoning is wrong / hallucinates | Medium | Medium | Reasoning is stored and displayed. Users can spot bad reasoning. Score feedback mechanism (US-10.1) enables human correction signal. |
| One dimension returns INSUFFICIENT_DATA | Medium | Low | `computeOverallScore()` excludes that dimension and re-normalizes weights. Score still computed from remaining dimensions. |
| All dimensions return INSUFFICIENT_DATA | Very Low | Medium | Fallback to overall score of 50 ("moderate"). Log as critical warning. |
| Few-shot examples bias scoring toward example topics | Low | Medium | Examples chosen from diverse categories (urban planning, air quality, marine, nuclear). No overlap with common tracked topics. |
| Longer prompt = higher cost | N/A | Negligible | ~500 tokens longer. At $0.003/1K input tokens: +$0.0015 per topic. For 20 topics: +$0.03 per batch run. |
| ~~Backward compatibility~~ | N/A | N/A | Not applicable — fresh launch. All rows will have reasoning from day one. |

---

## Part 7: CoT Failure Modes — When It Can Hurt

Research identified specific cases where chain-of-thought HURTS rather than helps:

1. **Small models (<100B params):** CoT leads to "illogical chains of thought" and worse accuracy than direct scoring. Mitigation: use capable models (GPT-4-class or Claude) via OpenRouter.
— [arXiv: Why CoT Fails in Clinical Text Understanding](https://arxiv.org/html/2509.21933)

2. **Without rubrics:** CoT alone doesn't improve scoring accuracy. Must be paired with explicit criteria. Mitigation: our approach always includes rubrics.
— [ScienceDirect: Automatic Scoring](https://www.sciencedirect.com/science/article/pii/S2666920X24000146)

3. **Error accumulation:** Wrong reasoning in early steps cascades to wrong scores. Mitigation: we validate scores against declared levels, catching the most common cascading error (level says MINIMAL but score is 65).

4. **Hallucinated citations:** LLM may "cite" articles that don't say what it claims. Mitigation: reasoning is stored and displayable. Score feedback mechanism (US-10.1) lets users flag this.

---

## Part 8: Implementation Checklist

In priority order (fresh launch — no migration):

- [ ] Update `db/schema.sql` with new columns (topics + score_history)
- [ ] Update `TopicScore` interface in `scripts/batch.ts` with new fields
- [ ] Update `callLLM()`: temperature 0, add response_format json_object
- [ ] Replace `scoreTopic()` prompt with rubric-based version + few-shot examples
- [ ] Add `validateScore()`, `computeOverallScore()`, `deriveUrgency()`, `detectAnomaly()`
- [ ] Update `main()`: new prepared statements, store reasoning/levels/raw response/anomaly flag
- [ ] Update `Topic` and `ScoreHistoryEntry` types in `src/lib/types.ts`
- [ ] Update `/api/topics` and `/api/topics/[slug]` to include new fields in response
- [ ] Update seed script if it generates sample data (ensure it includes sub-scores)
- [ ] Update existing tests for new schema and response shapes
- [ ] Test with real batch run and verify score distributions across all 4 levels

---

## Sources

### LLM-as-a-Judge & Scoring Research
- [G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment (Liu et al., EMNLP 2023)](https://arxiv.org/abs/2303.16634)
- [G-Eval Definitive Guide — Confident AI](https://www.confident-ai.com/blog/g-eval-the-definitive-guide)
- [LLM-as-a-Judge Complete Guide — Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Calibrating Scores of LLM-as-a-Judge — GoDaddy](https://www.godaddy.com/resources/news/calibrating-scores-of-llm-as-a-judge)
- [LLM-as-a-Judge: 7 Best Practices — Monte Carlo Data](https://www.montecarlodata.com/blog-llm-as-judge/)
- [LLM-as-a-Judge Best Practices — Mervin Praison](https://mer.vin/2025/11/llm-as-a-judge-best-practices-for-consistent-evaluation/)
- [LLM-as-a-Judge Practical Guide — Towards Data Science](https://towardsdatascience.com/llm-as-a-judge-a-practical-guide/)
- [Rubrics as Rewards: RL Beyond Verifiable Domains](https://arxiv.org/html/2507.17746v2)
- [Rethinking Rubric Generation for LLM Judges](https://arxiv.org/abs/2602.05125v1)
- [Evaluating Scoring Bias in LLM-as-a-Judge](https://arxiv.org/html/2506.22316v1)

### Scoring Biases & Calibration
- [LLM as a Scorer: Impact of Output Order on Evaluation (arXiv)](https://arxiv.org/html/2406.02863v1)
- [Self-Consistency Prompting — Mirascope](https://mirascope.com/docs/mirascope/guides/prompt-engineering/chaining-based/self-consistency/)
- [Confidence Improves Self-Consistency (CISC)](https://arxiv.org/html/2502.05233v1)
- [Calibrate Before Use: Improving Few-Shot Performance (Zhao et al.)](https://arxiv.org/abs/2102.09690)
- [Why Temperature=0 Doesn't Guarantee Determinism — mbrenndoerfer](https://mbrenndoerfer.com/writing/why-llms-are-not-deterministic)

### CoT Failure Modes
- [Why CoT Fails in Clinical Text Understanding (arXiv)](https://arxiv.org/html/2509.21933)
- [Applying LLMs and CoT for Automatic Scoring (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2666920X24000146)
- [Understanding CoT in LLMs through Information Theory (arXiv)](https://arxiv.org/abs/2411.11984)

### Environmental Scoring Frameworks
- [2024 Environmental Performance Index — Yale](https://epi.yale.edu/measure/2024/epi)
- [MSCI ESG Ratings Methodology](https://www.msci.com/data-and-analytics/sustainability-solutions/esg-ratings)
- [Sustainalytics ESG Risk Ratings](https://www.sustainalytics.com/esg-data)
- [ISO 14001 Environmental Aspects Evaluation — Advisera](https://advisera.com/14001academy/blog/2016/10/31/iso-140012015-how-to-set-criteria-for-environmental-aspects-evaluation/)
- [Environmental Risk Assessment — ProBiologists](https://www.probiologists.com/article/environmental-risk-assessment-era)

### Prompt Engineering & Structured Output
- [Using LLMs for Evaluation — Cameron Wolfe](https://cameronrwolfe.substack.com/p/llm-as-a-judge)
- [LLM-as-a-Judge 2026 Guide — Label Your Data](https://labelyourdata.com/articles/llm-as-a-judge)
- [OpenRouter API Parameters](https://openrouter.ai/docs/api/reference/parameters)
- [Structured Output Generation — Emre Karatas](https://medium.com/@emrekaratas-ai/structured-output-generation-in-llms-json-schema-and-grammar-based-decoding-6a5c58b698a6)

### Real-World Environmental Impact Data
- [Global Trends in Forest Fires — WRI](https://www.wri.org/insights/global-trends-forest-fires)
- [Environmental Health Impacts of Wildfires — UC Davis](https://environmentalhealth.ucdavis.edu/wildfires/environmental-health-impacts)
- [Climate Change and Extreme Fire Years — Nature Communications](https://www.nature.com/articles/s41467-025-61608-1)
