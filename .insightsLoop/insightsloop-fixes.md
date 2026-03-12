# InsightsLoop Fixes — Post Run-0001 Audit

Status: ALL COMPLETE

## Completed

### Fix 3: Plan.md Visual Spec section
- Added `## Visual Spec` to plan.md template in `/insight-plan`
- Exact before/after class values, DELETE/ADD/KEEP operations
- Required for UI stories, omitted for backend

### Fix 3b: Shipwright brief enforces Visual Spec
- Updated `/insight-devloop` Shipwright brief
- Visual Spec pasted verbatim into brief as build instruction

### Fix 1: SKILL.md for Sentinel, Shipwright, Storm, Editor (HIGH)
- Created `.claude/skills/insight-sentinel/SKILL.md` — Identity, Method (5-step TDD), Inputs/Output, Rules, Standalone usage
- Created `.claude/skills/insight-shipwright/SKILL.md` — Identity, Method (6-step build), Visual Spec handling, Rules, Standalone usage
- Created `.claude/skills/insight-storm/SKILL.md` — Identity, Method (5-step adversarial review), introduced vs pre-existing separation, Rules, Standalone usage
- Created `.claude/skills/insight-editor/SKILL.md` — Identity, Method (4-step normalization), skip condition, Rules, Standalone usage
- Updated devloop Phase 0 to read all 4 crew SKILL.md files and paste content into briefs
- Updated devloop Steps 2a, 2b, 3b, 3c to reference crew SKILL.md instead of inline briefs
- Updated devloopfast to reference crew SKILL.md files consistently

### Fix 2: Monkey technique alignment + context accumulation (HIGH)
- All 5 Monkey briefs (devloop: frame, tdd, build, ship + plan) now paste actual arsenal names
- Step-specific technique recommendations from Monkey's technique selection table included
- Previous Monkey findings accumulated across steps ("Pick a different target")
- Same updates applied to devloopfast Monkey briefs

### Fix 4: Storm/Cartographer/Editor report persistence (MEDIUM)
- Storm: "Write `storm-report.md` immediately. Do not proceed to Fix until the file exists on disk."
- Cartographer: "Write `edge-cases.md` immediately. Agent output alone is not persistent."
- Editor: "Write `normalization.md` immediately after the Editor returns."
- Same persistence rules added to devloopfast

### Fix 5: Navigator Phase 4 UI surface check (MEDIUM)
- Added `### UI Surface Check` subsection before architecture approaches
- Invokes `/insight-ux` (The Helmsman) when story has visual changes
- Helmsman output feeds into architecture design and Visual Spec foundation

### Fix 6: Cartographer invoked as actual skill (LOW)
- Changed devloop 3c: "invoke `/insight-edge-case-hunter` as the actual skill (use the Skill tool, not a general-purpose agent)"
- Same update in devloopfast 3c
