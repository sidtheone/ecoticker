# Recommendation #7: Score Anomaly Detection

> **ABSORBED into US-1.1.** See US-1.1 acceptance criteria.

## ~~US-7.1: Flag suspicious score jumps~~ → ABSORBED into US-1.1
`detectAnomaly()` is part of the scoring pipeline. Threshold: >25 points (one full rubric level). Stored in `score_history.anomaly_detected`. Warning logged.

**Future story (not v2):** Dedicated admin anomaly browser with filtering and bulk acknowledgment.

## ~~US-7.2: Store raw LLM responses~~ → ABSORBED into US-1.1
`raw_llm_response TEXT` is a column in the new `score_history` schema. Stored for every scoring run. No retention limit initially.

**Future story (not v2):** Admin API endpoint for querying raw responses + 90-day auto-pruning.

---
