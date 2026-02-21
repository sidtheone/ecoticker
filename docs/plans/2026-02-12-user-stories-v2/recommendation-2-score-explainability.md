# Recommendation #2: Score Explainability

> Christensen: "Users can't build trust in numbers they can't reason about." Drucker: "What gets measured gets managed — but only if you can explain what you're measuring."
>
> With US-1.1, reasoning is PRODUCED. With US-1.2, reasoning is DISPLAYED. This recommendation covers the remaining explainability gaps: article linkage and methodology documentation.

## US-2.1: See which articles informed the latest score
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

## US-2.2: Understand the scoring methodology
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
