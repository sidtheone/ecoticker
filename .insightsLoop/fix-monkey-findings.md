# Fix: Monkey at Ship Not Running

**Discovered:** run-0003 retro, 2026-03-12

## What happened

Ship Monkey was never launched. During Step 3 (Ship), I launched Monkey at Build alongside Storm and Cartographer — conflating two separate steps. Then went straight to fix → test → archive without running a proper Monkey at Ship.

## Root cause

Monkey at Build was launched late (during the Ship step) and treated as if it covered the Ship step. It doesn't — they have different contexts and different best techniques.

| Step | Monkey context | Best techniques |
|------|----------------|-----------------|
| Build | What each Shipwright built, file lists | Cross-Seam Probe, Time Travel, Scale Shift |
| Ship | Merged diff + storm-report + edge-cases | Time Travel, Scale Shift, Hostile Input |

## Fix to apply

In the devloop SKILL.md (`.claude/skills/insight-devloop/SKILL.md`), Step 3d ("The Monkey at Ship") — add an explicit checkpoint note:

> **Do not skip.** Ship Monkey runs AFTER fixes are applied and tests pass, before writing summary.md. If Storm/Cartographer/fixes consumed your attention, the Ship Monkey is still required. It is the last chaos check before archive.

## Where to add it

`.claude/skills/insight-devloop/SKILL.md` — find the "### The Monkey at Ship" section and add the note at the top of that block.
