# Monkey Finding — Ship

## Technique: Inversion

## Target: `computeHeadline([heroTopic])` — single-element array to a population function

## Finding

`computeHeadline` was designed for all topics. Passing a single hero topic inverts its contract. Rule 5 ("All topics stable today") triggers when the hero has a small change within the same urgency band — producing a headline that contradicts the 72px CRITICAL score above it.

Example: Hero at score 72 (critical), previous 68 (also critical). Change is +4 (within-band). `computeHeadline` says "All topics stable today" while the score screams danger. The headline becomes a semantic lie.

## Resolution

Pass full `mapped` array headline from page.tsx as a prop. HeroSection uses the prop when provided, falls back to single-topic computation when not (for test compatibility).

## Survived: No — fix required
