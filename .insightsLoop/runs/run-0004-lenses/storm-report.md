# Storm Report — Lenses v0.13

## Introduced Issues (9 found, 8 fixed, 1 deferred)

| # | Location | Issue | Severity | Status |
|---|----------|-------|----------|--------|
| 1 | devloop SKILL.md Verticals table | "Lens" column naming collision | high | Fixed — renamed to "Focus" |
| 2 | QM vs Navigator lens contradiction | Navigator says "wrong > none" but QM told to infer | high | Fixed — QM infers, surfaced at gate |
| 3 | QM frame.md template missing Lens slot | Non-deterministic lens placement | medium | Fixed — added ## Lens to template |
| 4 | Orchestrator lens source ambiguity | plan.md vs frame.md, no precedence | high | Fixed — frame.md is authoritative |
| 5 | devloopfast auto-confirms lens | Wrong lens goes unseen in speed mode | medium | Fixed — always surface at gate |
| 6 | Sentinel idempotency too narrow | Misses "prevent second run" pattern | medium | Fixed — widened definition |
| 7 | Replay Probe only at Ship step | Lens paragraph says any step | low | Deferred — agent judgment handles it |
| 8 | Retro can't see QM-inferred lens | Reads plan.md not frame.md | medium | Fixed — reads frame.md |
| 9 | QM brief has {{LENS}} circular | QM determines lens but receives it | medium | Fixed — removed from QM template |

## Consistency
Lens paragraphs consistent across all personas. Terminology clean. One pre-existing naming issue (Verticals "Lens" column) resolved.

## Pre-existing Issues
- plan SKILL.md Phase 5 uses "lenses" for challenge perspectives (third meaning of "lens"). Low severity, cosmetic.
