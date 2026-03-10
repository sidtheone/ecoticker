# Monkey Finding — TDD

## Technique: Inversion

## Target: Mixed red states — font size assertions vs impact-summary assertions vs dashboard mock

## Finding

The Monkey flagged that tests have two kinds of "red": font-size assertions targeting planned values (text-[72px]) against current implementation (text-[40px]), and impact-summary assertions for features that don't exist yet. The concern is that implementers can't distinguish intentional TDD-red from accidental bug-red.

## Evaluation

This is standard TDD red phase. ALL failures are intentional:
- Font size tests: fail because implementation has old values. Shipwright changes them. Tests go green.
- Impact-summary tests: fail because the element doesn't exist. Shipwright adds it. Tests go green.
- Dashboard test: fails because page.tsx still imports TopicGrid (not mocked), and data-testid="topic-list" doesn't exist. Shipwright swaps the import. Tests go green.

The Shipwright receives the plan + the tests. The plan tells them exactly what to build. The tests tell them when they're done.

## Survived: Yes

No changes needed to the test suite.
