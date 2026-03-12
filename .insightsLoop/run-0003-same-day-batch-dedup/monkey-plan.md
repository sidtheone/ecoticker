# Monkey — Plan

**Technique:** Assumption Flip
**Target:** The assumption that `onConflictDoUpdate` on `UNIQUE(topic_id, recorded_at)` is a safe, lossless dedup — specifically that no other row references `score_history.id` by the time this ships.
**Confidence:** 72
**Survived:** yes

## Observation

The `scoreFeedback` table (`src/db/schema.ts:169`) has a foreign key `score_history_id` referencing `scoreHistory.id`. The plan's `onConflictDoUpdate` strategy silently mutates the row in place when batch runs twice on the same day — the `score_history.id` (serial primary key) stays the same, but every scored column (`score`, `healthScore`, `ecoScore`, `econScore`, all reasoning fields, `rawLlmResponse`, `anomalyDetected`) gets overwritten with new values.

Today this is harmless because no feedback API route exists yet. But `scoreFeedback` is already in the schema with an explicit FK to `scoreHistory.id`, meaning it is clearly on the roadmap. The moment a user submits feedback referencing a specific score history entry ("I disagree with this 82 for health"), and then batch re-runs later that same day, the `onConflictDoUpdate` silently replaces the score, reasoning, and raw LLM response underneath that feedback. The feedback now points to a score the user never saw.

## Consequence

If ignored and feedback ships later without revisiting this decision: user feedback becomes orphaned from the score it was actually about. The `rawLlmResponse` that justified the score a user disputed gets silently overwritten. You lose the ability to answer "what did the user actually see when they flagged this score?" — which is exactly the kind of question an audit trail exists to answer.

Documented in plan.md Architecture section: `score_history` is a mutable daily snapshot. When feedback ships, reference `(topic_id + recorded_at)` rather than `score_history.id` if immutability is required.
