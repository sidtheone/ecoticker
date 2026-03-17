# Plan: Domain-Aware Lenses (v0.13)

## Story
Add lenses to the InsightsLoop orchestrator — a single string tag that tells the crew what kind of problem they're working on, so they ask the right questions.

Born from EcoTicker ghost scoring bug: batch pipeline re-scored topics on duplicate articles. No persona caught it because no AC defined repeat-run behavior. The crew's techniques are generic — they apply the same to a UI component as to a cron job. A lens focuses existing crew on domain-specific risks.

## Intent
A lens is a string, not a system. `lens: stateful` in the plan tells every persona to adjust their focus to stateful/repeat-run concerns. The Monkey probes for replay behavior. The Sentinel writes idempotency contracts. Storm checks for atomic coupling. No new personas, no new skills, no config system, no lookup tables.

## Out of Scope
- Predefined lens vocabulary or enum — personas are smart enough to interpret any string
- Per-lens technique mapping tables — trust the agents
- Lens-specific brief templates — one `{{LENS}}` slot is enough
- Config system for lenses — no config.md changes
- EcoTicker batch fix — separate devloop run after engine ships

## Architecture
One string field flows through the existing plan → frame → brief → persona pipeline:

```
plan.md (Challenge section)    → lens: stateful
  ↓
frame.md (Quartermaster)       → reads lens, includes in frame output
  ↓
brief templates ({{LENS}} slot) → passes lens to each persona
  ↓
persona SKILL.md               → one paragraph: "read the lens, adjust your focus"
```

If the plan comes from an external system with no lens set, the Quartermaster infers one from plan content or sets `none`.

## Tasks
- [ ] Task 1: Add `### Lens` field to plan.md template in insight-plan SKILL.md (Phase 6 artifact template) (independent)
- [ ] Task 2: Add lens detection/passthrough to insight-quartermaster SKILL.md — read from plan, include in frame.md, infer if missing (independent)
- [ ] Task 3: Add one paragraph to each crew persona SKILL.md (monkey, sentinel, storm, shipwright, edge-case-hunter, ux, retro) explaining what a lens is (independent)
- [ ] Task 4: Add Replay Probe as technique #9 to insight-monkey SKILL.md (independent)
- [ ] Task 5: Add `{{LENS}}` slot to brief templates that currently pass `{{TRIAGE_LEVEL}}` (independent)
- [ ] Task 6: Add lens to devloop/devloopfast SKILL.md — orchestrator passes lens through brief construction (independent)
- [ ] Task 7: Validation — dry-run EcoTicker batch pipeline scenario through `/insight-plan` with Stateful lens, confirm Monkey finds ghost scoring, Sentinel writes idempotency contract (depends on: 1-6)

## Key Files
All edits in `/Users/sidhartharora/dev/claude/insightsloop/skills/`:

| File | Change |
|------|--------|
| `insight-plan/SKILL.md` | Add `### Lens` to Phase 6 plan.md template |
| `insight-quartermaster/SKILL.md` | Lens read/infer logic in decomposition |
| `insight-monkey/SKILL.md` | Technique #9: Replay Probe + one lens paragraph |
| `insight-sentinel/SKILL.md` | One lens paragraph |
| `insight-storm/SKILL.md` | One lens paragraph |
| `insight-shipwright/SKILL.md` | One lens paragraph |
| `insight-edge-case-hunter/SKILL.md` | One lens paragraph |
| `insight-ux/SKILL.md` | One lens paragraph |
| `insight-retro/SKILL.md` | One lens paragraph |
| `insight-devloop/SKILL.md` | Lens in brief construction |
| `insight-devloopfast/SKILL.md` | Lens in brief construction |
| `insight-devloop/brief-templates/monkey-frame.md` | Add `{{LENS}}` slot |
| `insight-devloop/brief-templates/sentinel.md` | Add `{{LENS}}` slot |
| `insight-devloop/brief-templates/storm-tdd.md` | Add `{{LENS}}` slot |

Post-edit: sync insightsloop → ecoticker/.claude/skills/

## Challenge

### Triage
Small

### Lens
stateful (this plan is about engine behavior that repeats across runs — meta, but real)

### Values Alignment
- "Three lines beat a clever abstraction" — one string, one paragraph per persona, one technique. No framework.
- "Delete before you add" — adds minimally. Earned by a production bug, not speculation.
- "Read it top to bottom" — lens appears in plan.md, flows to frame.md, read by personas. Linear path.

### Dependency Map
Tasks 1-6 are all independent (different files). Task 7 depends on all of them.

### Top Failure Modes
1. **One paragraph is too vague** — agents ignore the lens and operate generically. Caught by Task 7 validation. Fix: sharpen the paragraph, don't build a table.
2. **Quartermaster lens inference drifts** — QM picks wrong lens from ambiguous plans. Acceptable — the Navigator should set it explicitly. QM inference is a fallback, not the primary path.

### Go/No-Go
GO
