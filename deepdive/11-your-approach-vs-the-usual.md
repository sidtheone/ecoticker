# Your Approach vs. The Usual

## What "The Usual" Looks Like

A solo developer building an environmental news tracker with AI scoring. Typical path:

1. Scaffold Next.js app
2. Build the UI first (looks good in screenshots)
3. Wire up the API
4. Add the LLM integration
5. Deploy
6. Write some tests if there's time
7. Fix things as they break
8. Move on to the next project

No methodology. No values document. No adversarial review. Tests are an afterthought. The LLM prompt is whatever worked on the first try. Deployment is "push and pray." The project works, looks decent in a portfolio, and is never touched again.

Most AI-assisted side projects die here. They ship once and rot.

---

## What You Actually Did

### Phase 1: Structured Build (BMAD, Feb 7–23)

Instead of jumping into code, you started with a PRD, user stories with personas, and 8 epics. Then you built in story order with code review per story and retros per epic.

**What this gave you that "the usual" doesn't:**
- A real schema design before writing code (8 tables, proper FK relationships, UNIQUE constraints for dedup)
- Security from day one (timing-safe auth, rate limiting, CSP, audit logging, GDPR IP truncation) — not bolted on after a scare
- 604 tests before switching methodologies
- A batch pipeline that handles GNews failures, RSS failures, bad LLM responses, and duplicate articles — not just the happy path

**The usual:** Schema is whatever Prisma generates from your first `npx prisma init`. Security is adding `cors: true` to the API. Tests don't exist. The batch job is a single `fetch → parse → save` with no error handling.

---

### Phase 2: Engine Switch (InsightsLoop, Mar 10–15)

You didn't just switch tools. You introduced adversarial personas, a values document, and institutional memory — then used a working production app as the test bed.

**What this gave you that "the usual" doesn't:**

#### Values as a Decision Framework

The usual approach: every decision is ad-hoc. "Should I add a loading spinner?" depends on how the developer feels that day. "Should I extract this into a utility?" depends on whether they just read a Clean Code article.

Your approach: VALUES.md answers these questions before they're asked. "Nothing decorative" kills the loading spinner debate — is it data or chrome? "Three lines beat a clever abstraction" kills the utility extraction debate — is there a real duplication problem or are you pattern-matching on DRY?

The result is a codebase where every decision is traceable to a principle. That's not normal for a solo project. That's not even normal for most teams.

#### Adversarial Review as Default

The usual approach: you write code, you look at it, you think "looks good," you ship it. Self-review is confirmation bias with extra steps.

Your approach: Storm actively tries to break the code. Monkey flips assumptions. Editor checks naming consistency across files. The `computeHeadline` semantic lie (run-0001) — a function that said "improved" when nothing actually improved — would never be caught by self-review. You'd look at the output, see a plausible sentence, and move on.

The usual developer doesn't have an adversary. You built one into the process.

#### Institutional Memory That Compounds

The usual approach: you learn a lesson ("oh, adding a UNIQUE constraint breaks other insert sites"), fix the immediate problem, and forget. Next time the same class of bug hits, you debug from scratch.

Your approach: PATTERNS.md captures the lesson as a rule ("Constraint change = audit all insert sites"). Next run, the Quartermaster and Storm reference PATTERNS.md during planning. The lesson is applied proactively, not reactively.

After 5 runs, PATTERNS.md has entries for:
- Monkey can find Storm-class bugs
- MOVE implies DELETE in visual specs
- Skip Cartographer for visual-only changes
- New DB query in existing pipeline = grep test files for mock interception
- Schema constraint change = audit all insert sites
- Storm Verify needs key design decisions, not just the diff

These aren't documentation. They're process antibodies. Each one prevents a class of bug from recurring. The usual developer accumulates this knowledge in their head and loses it when context switches.

---

## Side-by-Side Comparison

| Dimension | The Usual | Your Approach |
|---|---|---|
| **Planning** | None, or a TODO list | PRD → Epics → Stories (BMAD), then Plan → Frame → Build → Review (InsightsLoop) |
| **Values** | Implicit, inconsistent | Explicit VALUES.md checked at every plan phase |
| **Testing** | 0-20 tests, written after bugs | 685 tests, TDD — tests written before implementation |
| **Coverage** | ~10-30% if any | ~98.6% statement coverage |
| **Security** | Bolted on after deployment | Day-one: timing-safe auth, rate limiting, CSP, GDPR, audit logging |
| **LLM integration** | Single prompt, trust the output | 2-pass pipeline, score validation with level-range clamping, anomaly detection, few-shot calibration, fallback scores |
| **Error handling** | `try/catch` around the happy path | Per-stage resilience: GNews failure doesn't kill RSS, one topic failure doesn't kill the batch, audit log failure doesn't kill the main operation |
| **Review** | Self-review (confirmation bias) | Adversarial personas: Storm (breaks it), Monkey (challenges assumptions), Editor (consistency), Cartographer (path enumeration) |
| **Learning** | In the developer's head | PATTERNS.md — institutional memory that feeds future runs |
| **Deployment** | Push and pray | CI pipeline: dependency audit, security lint, Dockerfile checks, full test suite. GHA cron for batch. |
| **Data integrity** | Trust the insert | Article dedup (UNIQUE + ON CONFLICT DO NOTHING), ghost scoring prevention (pre-query guard), score history one-per-day (composite unique), denormalized counter reconciliation script |
| **Cost awareness** | "It works" | Switched models ($0.32/M → $0.06/M), reduced cron frequency (every 4h → twice daily), estimated $77/mo → $0.50/mo |

---

## What the Usual Gets Right

Being honest — the usual approach has advantages:

1. **Faster to v1.** You'd have a deployed app in a weekend. Your BMAD phase took 16 days.
2. **Less overhead per feature.** No 8-artifact InsightsLoop run for a CSS change.
3. **Lower cognitive load.** No methodology to learn, no personas to manage, no values to reference.
4. **Good enough for demos.** If the goal is "show this at a meetup," the usual approach wins on effort-to-impression ratio.

The usual approach fails when:
- The project needs to run unattended (batch pipeline reliability)
- The project handles real data (dedup, score validation, anomaly detection)
- The project will be maintained past the first deploy (test coverage, institutional memory)
- Correctness matters more than speed (LLM output can't be trusted blindly)

---

## What Your Approach Gets Right

### 1. You Treated AI Output as Untrusted Input

Most developers using LLMs for scoring would do:
```
response = await llm.score(articles)
db.save(response.score)
```

You built:
- Level-range clamping (LLM says MINIMAL but returns 90 → clamped to 25)
- Anomaly detection (>25pt delta flagged)
- INSUFFICIENT_DATA handling (excluded from weighted average, weights renormalized)
- Few-shot calibration examples (anchoring the model's sense of scale)
- Fallback scores (bad JSON → MODERATE/50 instead of crash)
- Raw LLM response stored as JSONB (audit trail for debugging model drift)

This is "validate at the door" applied to AI. Most people trust the model. You validated it like you'd validate user input.

### 2. You Built the Boring Parts First

Security, rate limiting, audit logging, GDPR compliance, input validation — these were in the first 2 weeks. Most projects add these after an incident (or never).

The result: when you launched publicly, the security surface was already hardened. No last-minute "oh wait, I should add auth" scramble.

### 3. You Used the Project to Test the Engine

EcoTicker wasn't just a product — it was the proving ground for InsightsLoop. The engine-test-landing-page branch literally says "engine test" in the name. Each run produced learnings that improved the engine:

- Run-0001: Monkey technique accumulation → bump to 3 findings per step
- Run-0002: Cartographer redundant on visual changes → skip rule
- Run-0003: Schema constraint → audit all insert sites pattern
- Run-0005: Structural DB insertion → always run Cartographer regardless of triage

Most people use tools. You built the tool while using it, and used the project as the feedback loop.

### 4. You Knew When to Switch Approaches

BMAD for the build phase (speed mattered, zero users, no real data). InsightsLoop for the harden phase (confidence mattered, real data flowing, production deployment). This isn't "one methodology forever" — it's matching the tool to the phase.

Most people either have no methodology (the usual) or are dogmatic about one (always Agile, always TDD, always waterfall). You treated methodology as a tool, not an identity.

---

## The Real Difference

The usual approach produces a project. Your approach produced a **system** — the product, the engine that built it, the values that constrain it, and the institutional memory that improves it. The project is one output. The engine is reusable. The values are transferable. The patterns compound.

Most solo developers finish a project and start the next one from scratch. You finished a project and had a better toolchain for the next one.

That's the actual gap. Not 2x slower. Not more tests. The gap is that every project you build from here forward starts with a better engine than the last one. The usual approach starts from zero every time.
