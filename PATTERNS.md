# Patterns

Conventions and learnings from InsightsLoop runs. Updated by `/insight-retro`.

## Monkey Patterns

- **Monkey can find Storm-class bugs.** Run-0001: Monkey at Ship caught the `computeHeadline` single-element semantic lie before Storm even ran. Don't treat Monkey findings as lesser — if `Survived: no` and confidence is high, it's a real issue regardless of which crew member found it.

## Visual Spec Patterns

- **MOVE implies DELETE.** Run-0002: Visual Spec said "MOVE: Share button + updated time to metadata line." Shipwright added the new location but left the old action-bar section in place — duplicate timestamp on every page. Storm caught it. Lesson: every MOVE instruction must explicitly list a DELETE at the source. The plan writer owns this, not the Shipwright.

## Cartographer Patterns

- **Skip for visual-only changes.** Run-0002: Cartographer found 2 things, both already caught by Storm. Mechanical path enumeration adds nothing when no new code paths exist. For layout/CSS-only stories, skip the Cartographer and let Storm carry verification alone.

## Editor Patterns

- **Editor catches what Storm doesn't.** Run-0002: Editor found back-link copy divergence (normal "← Back" vs error "Back to dashboard") — same `href`, two different labels depending on error state. Storm was focused on failure modes, not naming consistency. Editor earned her spot on multi-file changes.

## Run History

- `2026-03-11 run-0002 topic-detail-visual-alignment: Storm best performer (3/3 introduced = fixes). Monkey 5 findings, zero technique repeats, confidence trend 82→75→79→84→86. Cartographer redundant on visual change. Shipwright first-pass clean. Editor caught copy divergence Storm missed.`
- `2026-03-11 run-0001 gut-punch-landing-page: Monkey hit hard (4/5 findings fixed) but used Inversion 3x — technique accumulation and crew SKILL.md files shipped same session.`
