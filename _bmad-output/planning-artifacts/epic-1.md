# Epic 1: Scoring Foundation

**Status:** DONE
**Phase:** 1 — Foundation
**Goal:** Rebuild the scoring pipeline with calibrated rubrics, sub-scores, reasoning, and anomaly detection.

## Story 1.1: Research optimal sub-scoring approach with LLMs (US-1.0)
**Status:** DONE
**Size:** Research
**Description:** Research and document the optimal LLM scoring strategy with rubrics, few-shot calibration, and multi-dimensional scoring.
**Output:** `docs/plans/2026-02-09-llm-scoring-research.md`

## Story 1.2: Implement the scoring architecture (US-1.1)
**Status:** DONE
**Size:** L
**Description:** Rebuild the scoring pipeline per US-1.0 research — 4-level rubric, 3 dimensions (Eco 40%, Health 35%, Econ 25%), reasoning-first prompting, server-side aggregation, anomaly detection, raw response storage.
**Commits:** 9f351f1, 9d33fc3
**Dependencies:** Story 1.1
