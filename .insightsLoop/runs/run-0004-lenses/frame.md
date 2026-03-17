# Frame: Domain-Aware Lenses (v0.13)

## Triage
Small

## Lens
stateful

## Adaptation
SKILL.md-only change — no code, no tests. Sentinel skipped. Direct edits → Storm review → validation dry-run.

## Task Plan (sequential — all same repo)

| Task | File | Change | Status |
|------|------|--------|--------|
| 1 | insight-plan/SKILL.md | Add `### Lens` to plan.md template | pending |
| 2 | insight-quartermaster/SKILL.md | Lens read/infer in decomposition | pending |
| 3 | 7 crew persona SKILL.md files | One lens paragraph each | pending |
| 4 | insight-monkey/SKILL.md | Technique #9: Replay Probe | pending |
| 5 | 3 brief templates | Add `{{LENS}}` slot | pending |
| 6 | insight-devloop + devloopfast SKILL.md | Lens in brief construction | pending |
| 7 | Validation dry-run | Replay EcoTicker batch scenario | depends: 1-6 |

## Post-Build
- Sync: insightsloop/skills/ → ecoticker/.claude/skills/
- Bump: package.json version to 0.13.0
