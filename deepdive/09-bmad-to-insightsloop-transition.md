# BMAD → InsightsLoop: How the Engine Switch Affected Execution

## Timeline

```
Feb 7 – Feb 23   BMAD era        (40 commits, 14 sessions)
Mar 8             GSD rename      (1 commit — the trigger)
Mar 8             GSD scaffolding (8 commits — roadmap, requirements, phases, plans)
Mar 8 – Mar 9     GSD execution   (7 commits — security fixes, SEO, pipeline extraction)
Mar 10            Engine switch    (InsightsLoop run-0001 lands on engine-test-landing-page branch)
Mar 10 – Mar 12   InsightsLoop    (6 commits — runs 0001–0003)
Mar 14            InsightsLoop    (run-0005 ghost scoring fix)
Mar 15            Revert + launch (GSD→BMAD revert, OG images, README, public launch)
```

---

## What BMAD Looked Like (Feb 7 – Feb 23)

**Structure:** PRD → Epics → Stories → Implementation artifacts → Retros

BMAD produced 8 epics, 45+ planning/implementation artifacts in `_bmad-output/`. Commits reference story numbers directly (`Story 8-1`, `Story 4.3`, `US-1.2`). Work was organized in waterfall-ish batches:

| Period | Work | Commits |
|---|---|---|
| Feb 7 | Initial build through Railway deployment | 20 commits in one day |
| Feb 9 | Security hardening, CI pipeline | 4 commits |
| Feb 12–13 | v2: Postgres migration, multi-dimensional scoring, LLM filtering | 10 commits |
| Feb 17 | OG meta, Epic 2+3 | 3 commits |
| Feb 20–22 | Epic 4 (RSS), Epic 7 (UX), Epic 8 (pipeline consolidation), dashboard restyle | 13 commits |
| Feb 23 | Track artifacts in git | 1 commit |

**Characteristics:**
- Story-driven commits (`feat: Story 8-1 — extract shared batch pipeline module`)
- Code review as a separate step per story (documented in implementation artifacts)
- Retros per epic (`epic-3-retro`, `epic-4-retro`, `epic-7-retro`, `epic-8-retro`)
- No adversarial review — code review was verification, not challenge
- No persona-based decomposition — one author, one reviewer (Claude)
- Emergency fixes handled ad-hoc (`emergency-fix-newsfilter`, `emergency-replace-newsapi-with-gnews`)

---

## The GSD Interlude (Mar 8)

You renamed BMAD to GSD across all artifacts (`5397d52`), then immediately scaffolded a full GSD project: codebase mapping → requirements → roadmap → phase plans → execution.

**8 scaffolding commits in one day.** The GSD machinery produced a 3-phase roadmap, phase plans, context sessions, and execution summaries. But the actual code output from GSD was modest:
- Cron auth bypass fix + timing-safe comparison (security)
- npm audit vulnerability fixes
- Batch pipeline extraction into `runBatchPipeline()`
- SEO (robots.txt, sitemap, OG cards, JSON-LD)

Then you switched to InsightsLoop on `engine-test-landing-page` branch.

---

## What InsightsLoop Changed (Mar 10 – Mar 14)

### 1. Adversarial Review Became Structural

BMAD had code review. InsightsLoop has **Storm** (adversarial reviewer) and **Monkey** (chaos agent) as first-class participants at every step.

**Concrete impact:**
- Run-0001: Monkey caught the `computeHeadline` semantic lie at Ship — a function that returned "Delhi Air improved" when it hadn't actually improved, just hadn't worsened. BMAD's code review wouldn't have caught this because it verified the code worked, not whether it was truthful.
- Run-0002: Storm caught duplicate timestamp rendering (old action-bar left in place after MOVE instruction). Editor caught copy divergence ("← Back" vs "Back to dashboard" — same href, two labels).
- Run-0005: Storm TDD review was the highest-value pass — caught mock/implementation strategy mismatch that would have shipped green-but-hollow tests.

### 2. Persona Decomposition Forced Explicit Handoffs

BMAD: one agent does everything. InsightsLoop: Quartermaster frames → Sentinel writes contracts → Shipwright builds → Storm reviews → Monkey chaos-tests → Editor normalizes.

**Concrete impact:** The ghost scoring fix (run-0005) revealed that Cartographer was incorrectly skipped ("small triage"). A structural DB insertion into an existing pipeline loop broke an integration test that wasn't in the worktree scope. This became a PATTERNS.md entry — learned once, never repeated.

Under BMAD, this would have been a "fix the broken test" commit with no process learning captured.

### 3. PATTERNS.md Created Institutional Memory

BMAD had retros, but they were per-epic summaries filed in `_bmad-output/` and never referenced again. InsightsLoop retros update PATTERNS.md — a living document that feeds future runs.

**Patterns that wouldn't exist under BMAD:**
- "MOVE implies DELETE" — plan writer must list deletion at source
- "Constraint change = audit all insert sites" — adding a uniqueIndex requires grepping all insert calls
- "New DB query in existing pipeline = grep test files for mock interception"
- "Structural DB insertions trigger Cartographer regardless of triage"
- "Storm Verify needs key design decisions, not just the diff"

These are process-level learnings that compound. BMAD didn't have a mechanism for this.

### 4. Monkey Found Real Bugs, Not Just Style Issues

Across 5 runs, Monkey produced findings that required actual code changes:

| Run | Finding | Technique | Fixed? |
|---|---|---|---|
| 0001 | `computeHeadline` semantic lie | Inversion | Yes |
| 0001 | 4/5 findings fixed total | Mixed | Yes |
| 0002 | 5 findings, zero technique repeats | Mixed | Partial |
| 0003 | Seed scope gap + HAVING filter | Mixed | Yes |
| 0005 | GROUP BY orphan gap (count=0 case) | Scale Shift | Yes |

BMAD's code review didn't have a "try to break it" mandate. It verified correctness, not resilience.

### 5. The Work Got Smaller and Sharper

**BMAD commits were large.** `feat: Epic 7 UX foundations` touched hero section, severity gauge, stale warning, topic card, AND topic detail in one commit. `feat: Epic 4 RSS integration` bundled RSS fetching, parsing, badge UI, and frontend hardening.

**InsightsLoop commits were atomic.** Each run produced 1-3 focused commits:
- run-0001: `feat: rebuild landing page — gut-punch design with severity list` (one thing)
- run-0002: `feat: topic detail visual alignment` (one thing)
- run-0003: `feat: same-day batch dedup, score history` (one thing)
- run-0005: `fix: prevent ghost scoring on duplicate articles` (one thing)

Smaller scope = less blast radius per change = fewer emergencies.

---

## What It Cost

### 1. More Artifacts Per Feature

BMAD: 1 story doc + 1 implementation artifact per feature.
InsightsLoop: plan.md + monkey-plan.md + monkey-frame.md + monkey-tdd.md + monkey-build.md + monkey-ship.md + storm-report.md + summary.md per run.

Run-0005 alone produced 8 artifact files for a single bug fix. The `.insightsLoop/` directory has 40+ files across 5 runs.

### 2. Slower Per-Feature Velocity

BMAD shipped Epic 4 (RSS integration — 4 stories, fetching + parsing + badges + health logging + pipeline alignment) in 2 days.

InsightsLoop run-0002 (topic detail visual alignment — a CSS/layout change) took a full run cycle with Storm, Monkey, Editor, and Cartographer.

The overhead is worth it for structural changes (run-0005 proved that). For visual tweaks, it's arguably too heavy — the retro itself noted "Cartographer redundant on visual change."

### 3. The GSD Detour Was Wasted Motion

8 scaffolding commits, then reverted 7 days later (`2c239c7 Revert "refactor: rename BMAD to GSD"`). The GSD roadmap/requirements/phase plans were discarded. The actual code produced during the GSD window (security fixes, SEO) would have been built regardless — those were backlog items, not GSD-driven discoveries.

---

## Net Assessment

| Dimension | BMAD | InsightsLoop |
|---|---|---|
| **Speed** | Faster per feature | Slower per feature, but fewer post-ship fixes |
| **Bug detection** | Reactive (fix after production incident) | Proactive (Monkey + Storm catch before merge) |
| **Commit granularity** | Large, multi-concern | Atomic, single-concern |
| **Process learning** | Epic retros filed and forgotten | PATTERNS.md — living, referenced, compounding |
| **Adversarial thinking** | None — review verified correctness | Built-in — Storm challenges, Monkey breaks |
| **Overhead** | Low (1-2 artifacts per feature) | High (6-8 artifacts per run) |
| **Emergency handling** | Ad-hoc (`emergency-fix-*` commits) | Structured (run-0005 for ghost scoring) |

**The switch happened mid-execution on a working product.** BMAD got EcoTicker from zero to deployed with 604 tests in 16 days. InsightsLoop then refined it — catching the ghost scoring bug, fixing visual alignment issues, hardening the batch pipeline — with higher confidence per change but lower throughput.

BMAD was the right tool for building fast. InsightsLoop was the right tool for building carefully. The transition cost was the GSD detour (wasted day) and the naming revert, but the process learnings captured in PATTERNS.md are permanent value that BMAD never produced.
