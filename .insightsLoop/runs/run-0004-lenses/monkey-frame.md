# Monkey — Frame

## Finding 1
**Technique:** Assumption Flip
**Target:** "A lens is a string, not a system" — the core bet that Opus personas will reliably interpret a bare string
**Confidence:** 75
**Survived:** no
**Impact:** values-gap

### Observation
The plan's strongest assumption is that a single word like `stateful` will cause seven different personas to independently converge on the *same domain-specific adjustments*. The Monkey reads `lens: stateful` and thinks "replay behavior, idempotency, duplicate detection." The Sentinel reads the same word and thinks... what exactly? "Write idempotency contracts"? "Check for repeat-run safety"? "Test that state persists across invocations"?

There's no shared contract for what a lens *means* to each persona. The plan says "one paragraph: read the lens, adjust your focus" (Task 3). But "adjust your focus" is a delegation to vibes. Seven personas will read the same string and produce seven different interpretations of what "stateful" demands of them. The EcoTicker ghost scoring bug was missed precisely because each persona applied generic techniques — now the plan adds a word but no shared definition of what that word obligates.

Flip the assumption: what if Opus personas are *too smart* — each one interprets `stateful` through its own lens (pun intended), producing a constellation of unrelated adjustments instead of converging on the actual domain risk? The Monkey probes replay behavior. The Sentinel writes persistence contracts. Storm checks coupling. None of them check the specific thing — "does a second run on the same data produce a different result?" — because each persona mapped `stateful` to a different slice of the concept.

I haven't verified this by running all seven personas with the string, so I'm capping at 75. But the plan explicitly says "trust the agents" and provides zero convergence mechanism. That's the assumption I'm flipping.

### Consequence
The lens becomes a placebo. Each persona does *something* domain-flavored, but without a shared contract for what `stateful` demands, the crew produces the illusion of domain awareness while still missing the exact class of bugs (like ghost scoring) that motivated the feature. The validation dry-run (Task 7) might pass because the Monkey is specifically told to find ghost scoring — but that's a rigged test. In the wild, with a lens like `concurrent` or `eventual-consistency`, the convergence gap widens.

This violates **"Insight, not information."** Adding domain flavor without domain precision is information without insight.

## Finding 2
**Technique:** Scale Shift
**Target:** The `{{LENS}}` slot appearing in only 3 of 10 brief templates (monkey-frame, sentinel, storm-tdd)
**Confidence:** 85
**Survived:** no
**Impact:** breaks-build

### Observation
The plan (Task 5) says: "Add `{{LENS}}` slot to brief templates that currently pass `{{TRIAGE_LEVEL}}`." I checked every brief template in `/Users/sidhartharora/dev/claude/insightsloop/skills/insight-devloop/brief-templates/`. Here's the current state:

| Template | Has `{{TRIAGE_LEVEL}}`? | Gets `{{LENS}}`? |
|----------|------------------------|------------------|
| monkey-frame.md | Yes | Yes (per plan) |
| sentinel.md | No | Yes (per plan) |
| storm-tdd.md | No | Yes (per plan) |
| storm-verify.md | No | Not in plan |
| shipwright.md | No | Not in plan |
| monkey-build.md | No | Not in plan |
| cartographer.md | No | Not in plan |
| quartermaster.md | No | Not in plan (QM reads lens from plan.md directly) |
| quartermaster-correction.md | No | Not in plan |
| shipwright-scaffold.md | No | Not in plan |

Wait — the plan says templates "that currently pass `{{TRIAGE_LEVEL}}`" but only `monkey-frame.md` has `{{TRIAGE_LEVEL}}`. The sentinel and storm-tdd templates don't have it. So the selection criterion is already inconsistent with reality. More importantly: **the Build Monkey (`monkey-build.md`), Storm Verify (`storm-verify.md`), and Shipwright (`shipwright.md`) never receive the lens.**

Scale this up: in a `lens: stateful` run, the Sentinel writes idempotency contracts (gets lens), the Shipwright implements them (no lens — doesn't know *why* those contracts exist), Storm Verify reviews the merged code (no lens — can't check for domain-specific risks in the diff), and the Build Monkey hunts for what Storm missed (no lens — operating generically on post-build code, exactly the state that missed ghost scoring the first time).

The Frame Monkey gets the lens. The Build Monkey doesn't. That's the exact moment where domain awareness matters most — reviewing real code — and it's the exact moment the lens disappears.

### Consequence
The lens influences the front half of the pipeline (plan, frame, TDD) but vanishes for the back half (build, verify, ship). The Shipwright implements without domain context. Storm Verify reviews without domain focus. Build Monkey hunts generically. The pipeline has a domain-awareness cliff at Step 2b. Post-merge verification — the last line of defense — is lens-blind.

This is operationally broken. The crew that reviews the actual code (not just the plan and tests) doesn't know what domain they're in.

## Finding 3
**Technique:** Existence Question
**Target:** Quartermaster lens inference — "If the plan comes from an external system with no lens set, the Quartermaster infers one from plan content or sets `none`"
**Confidence:** 70
**Survived:** no
**Impact:** values-gap

### Observation
Should the Quartermaster infer lenses at all? The plan says: "If the plan comes from an external system with no lens set, the Quartermaster infers one from plan content or sets `none`."

This is a fallback that sounds reasonable but creates a silent failure mode. Consider the flow:

1. Navigator writes a plan, forgets to set `### Lens`
2. Quartermaster receives the plan, sees no lens, infers `stateful` from context clues
3. Crew operates with `lens: stateful`
4. Navigator never knows a lens was set — they didn't ask for one

The inference is invisible. There's no gate, no confirmation, no "I inferred lens: stateful from your plan — approve?" The Quartermaster doesn't present the inferred lens for approval; it just flows into frame.md silently (per Task 2: "read from plan, include in frame.md, infer if missing").

Now consider the worse case: the Quartermaster infers the *wrong* lens. A plan about "migrating database schema" gets inferred as `stateful` when it's really `migration` (or whatever string would better focus the crew). The personas now adjust their focus to the wrong domain. This is worse than no lens at all — it's a confident misdiagnosis that nobody reviews because the inference was silent.

The plan even acknowledges this: "QM picks wrong lens from ambiguous plans. Acceptable — the Navigator should set it explicitly." But "acceptable" contradicts a core value. The plan is saying "we know it might silently pick the wrong domain focus, and that's fine because someone else should have done it right."

### Consequence
Silent inference violates **"Validate at the door."** External input (the absence of a lens) is being interpreted rather than rejected or surfaced. The plan explicitly says it's acceptable for the QM to guess wrong — but wrong domain focus is worse than no domain focus. A wrong lens actively misleads the crew into checking for risks that don't apply while missing the ones that do.

The simpler, more values-aligned design: if no lens is set, the Quartermaster writes `lens: none` and the crew operates generically — exactly as they do today. No inference, no silent failure. If the Navigator cares about domain focus, they set a lens. If they don't, the crew doesn't pretend to have one.

This also violates **"Three lines beat a clever abstraction."** Inference logic is complexity that serves a case the plan itself calls a fallback. Delete before you add.
