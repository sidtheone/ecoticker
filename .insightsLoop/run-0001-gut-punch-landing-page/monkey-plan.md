# Monkey Finding — Plan Phase

## Technique: Removal

## Target: `impactSummary` as the hero's central narrative + text-only TopicList

## Finding

The plan pins the landing page's emotional weight on `impactSummary` — a nullable, LLM-generated field with no guaranteed population. When null, the hero becomes a bare number without context, violating "Insight, not information."

Additionally, replacing the color-coded card grid with a plain text list amputates the "peripheral dread" — the visual accumulation of severity across many topics that creates the "data hurts" feeling.

## Resolution

1. Fallback narrative chain: `impactSummary` -> `computeHeadline()` -> `scoreReasoning` -> static text
2. Compact severity gauges in TopicList rows (gauge is data, not decoration)
3. `selectHeroTopic` weighting issue noted but deferred (pre-existing, out of scope)

## Survived: Yes (after adjustments)
