# What Changed From v1 and Why

The original 23 stories were written BEFORE US-1.0's research was complete. That research revealed the current scoring is fundamentally broken:

- The LLM clusters scores around 40-60 (central tendency bias) because there's no calibration criteria
- Users see "72" with no explanation — Christensen: "Users can't build trust in numbers they can't reason about"
- The LLM computes the overall score, but it should be server-side (deterministic, transparent, tunable)
- Sub-scores, levels, and reasoning exist as concepts but aren't produced or displayed

**The 4-level rubric is the key insight.** Users don't think in 0-100. They think "how bad is it?" MINIMAL / MODERATE / SIGNIFICANT / SEVERE answers that in human language. The numbers (0-25, 26-50, 51-75, 76-100) provide granularity within levels. But the LEVEL is what gets cited, shared, and remembered. "EcoTicker rates the ecological impact as SEVERE" — that's a sentence a journalist can write. "EcoTicker gave it a 78" is not.

## Structural changes:

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

## Dependency chain:

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
