# AI Development Forge Comparison

A side-by-side evaluation of five AI-assisted development frameworks for Claude Code and similar AI coding tools: **Forge-AI**, **Feature-Dev**, **BMAD**, **GSD**, and **nWave**.

> **Who this is for:** Developers choosing a framework for AI-assisted development — whether you're a solo dev shipping features, a team lead evaluating process, or just curious about the current landscape. This comparison looks at what each framework actually does, not what it markets itself as.

---

## At a Glance

| | **Forge-AI** | **Feature-Dev** | **BMAD** | **GSD** | **nWave** |
|---|---|---|---|---|---|
| **What it is** | Adversarial planner + deterministic executor | Guided feature dev workflow | Full product lifecycle framework | Spec-driven multi-agent development system | Disciplined 6-wave delivery methodology |
| **Scope** | Plan → PR | Explore → Build → Review | Idea → PRD → Code → Review | Project → Roadmap → Phases → Code → Verify | Discovery → Requirements → Architecture → Infra → Tests → TDD Implementation |
| **Language** | Python 3.12+ | Markdown (Claude plugin) | Markdown + YAML + XML | Markdown + JS (Claude plugin) | Python + Markdown (Claude plugin) |
| **License** | Apache 2.0 | Apache 2.0 | MIT | MIT | MIT |

---

## Layer Coverage

| Layer | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Discovery / Market** | — | — | Brainstorm + Research | Optional research | DISCOVER wave (product discovery, assumption testing) |
| **Requirements / PRD** | — | Partial (discovery + questions) | **Full 12-step PRD** | Requirements.md with IDs + traceability | **JTBD + BDD acceptance criteria + DoR validation** |
| **Architecture** | Adversarial (2 architects argue, judge picks) | Multi-approach (2-3 architects, user picks) | Single architect, step-by-step | Single planner, goal-backward | Solution architect + ADRs |
| **DevOps / Infra** | — | — | — | — | **DEVOPS wave** (infrastructure readiness, CI/CD guidance) |
| **Test Design** | — | — | **TEA plugin** (enterprise test architecture) | — | **DISTILL wave** (BDD, walking skeleton, hexagonal boundaries) |
| **Implementation** | Deterministic DAG pipeline | Single build phase | Per-story TDD loop | Wave-based parallel plans, atomic commits | **5-phase Outside-In TDD** (PREPARE → RED → GREEN → COMMIT) |
| **Review / Quality** | LLM judge per step + pre-PR gate | 3 reviewers with confidence scoring (≥80) | Adversarial review + edge case hunter | Goal-backward verification + Nyquist auditor | Peer review + DES enforcement + mutation testing (≥80% kill rate) |
| **Plugin System** | Presets / skins | None | **Module system** (5 official modules) | Config toggles | Rigor profiles (lean → exhaustive) |

---

## Detailed Comparison

### PRD / Requirements

| | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Approach** | None — starts from a one-liner | Discovery phase + clarifying questions | 12-step collaborative PRD workflow with validation gate | Requirements.md with REQ IDs, traceability to phases | JTBD analysis, journey maps, user story mapping, BDD acceptance criteria |
| **Validation** | — | User approves answers | Separate validate-PRD workflow | 100% requirement coverage enforced — no orphaned requirements | 9-point Definition of Ready checklist |
| **Traceability** | — | — | Story references PRD section + Epic ID | REQ-01 → Phase → Plan → Artifact | Every user story traces to ≥1 job story |

### Planning & Architecture

| | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Approach** | Two independent architects with opposing constraints, adversarial critics, refiners, then judge synthesizes | 2-3 architect agents (minimal, clean, pragmatic), user picks | Single architect agent, step-by-step with user | Single planner, goal-backward derivation of success criteria | Solution architect with ADRs |
| **Adversarial pressure** | Yes — core design | No | No | No — plan-checker validates but doesn't compete | No — but peer reviewer (Atlas) validates bias and completeness |
| **Output** | final-plan.md | User-chosen approach | Architecture document | PLAN.md with must-haves in frontmatter | Architecture document + ADRs + wave decisions |

### Execution Model

| | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Model** | DAG pipeline: code → lint → test → review → PR | Single implementation phase | Per-story loop: tests → code → review | Wave-based parallel plans, atomic task commits | 5-phase TDD per step: PREPARE → RED_ACCEPTANCE → RED_UNIT → GREEN → COMMIT |
| **Parallelism** | Fixed DAG with dependency resolution | None | None | Plans grouped into waves by dependency | Sequential steps with dependency resolution |
| **Context rot prevention** | Fresh agent per step, state on disk | Not addressed | Artifact linking + project-context.md | Multi-layer memory (PROJECT → STATE → ROADMAP → PLAN → SUMMARY) | Wave decisions summaries + skill-embedded methodology + execution-log.json |
| **Build verification** | Immediate build after code agent; retries with errors | None | Tests must pass 100% | Verify command per task | All tests must pass before commit phase |

### Quality Gates

| | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Review type** | LLM judge (pass/fail per item) | 3 parallel reviewers with confidence scoring | Adversarial review (3-10 findings) + edge case hunter | Goal-backward verification (did code deliver user behavior?) | Peer reviewers + DES enforcement + mutation testing |
| **Enforcement** | Pre-PR gate blocks if critical steps failed | User decides: fix now / fix later / proceed | 100% test pass required before story done | Verification creates structured gaps for closure | DES enforcement monitors skipped phases; ≥80% mutation kill rate |
| **Unique strength** | Judge checks work against plan, not just completion | Confidence threshold (≥80) filters noise | Edge case hunter walks every branching path | Checks observable user behaviors, not task completion | DES enforcement flags skipped TDD phases |

### User Involvement

| | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Model** | Fire-and-forget after initial prompt | Stops at every phase for approval | Checkpoint [C] at every section; YOLO mode for auto | Configurable gates — 3 types (human-verify, decision, human-action) | Mandatory checkpoints between every wave — no autonomous mode |
| **Hands-off option** | Yes — default mode | No | Yes — YOLO mode per workflow | Yes — auto_advance in config | No — human review required between waves |
| **Decision points** | 0 (after launch) | 5-7 | Per-section checkpoints | Configurable (toggle gates on/off) | 4-7 per wave |

### Recovery & Fault Tolerance

| | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Crash recovery** | Checkpoint/resume system | None | State in frontmatter; resume at last step | Per-task commits; STATE.md position tracking; checkpoint resume | execution-log.json; `/nw:continue` auto-detects resume point |
| **Backtracking** | Retry failed phases (max 2) | Start over | "Correct Course" loops back to PRD/Architecture/Sprint | Gap closure planning from verification | Contradictions flagged to prior waves |
| **State durability** | Disk-backed checkpoint state | In-memory only | Frontmatter stepsCompleted array | STATE.md + continuation files + git history | execution-log.json + wave decision artifacts |

### Cost & Overhead

| | Forge-AI | Feature-Dev | BMAD | GSD | nWave |
|---|---|---|---|---|---|
| **Ceremony level** | Medium | **Low** | **High** | Medium (configurable) | **High** (scalable via rigor profiles) |
| **Agent count** | Multiple (configurable) | 7-8 total | 12 personas + 5 studio | 11 specialized (4-5 active) | **23 total** (6 wave + 6 specialist + 11 reviewers) |
| **Cost control** | None | None | Quick Flow (2 agents) vs full BMAD | Model profiles: quality / balanced / budget | Rigor profiles: lean (haiku) → standard (sonnet) → thorough (opus) → exhaustive (opus + mutation) |
| **Token overhead** | Heavy — adversarial doubles everything | Moderate | Scales with ceremony choice | Scales with model profile | Scales with rigor profile |
| **Setup** | Presets + manifests required | Zero — just `/feature-dev` | Config files + module installation | `.planning/config.json` | `.nwave/des-config.json` + rigor selection |

---

## What Each Gets Right Uniquely

### Forge-AI
- **Zero context rot** — fresh agent per step with disk-backed state. No other framework fully solves this.
- **Real crash recovery** — checkpoint/resume system means a killed process resumes cleanly.
- **Adversarial planning** — two architects with opposing constraints stress-test designs before code.

### Feature-Dev
- **Deep codebase understanding** — explorer agents trace execution paths, call chains, and data flow.
- **Confidence-scored reviews** — ≥80 threshold filters noise; only high-confidence issues reported.
- **Zero ceremony** — no config, no setup, just `/feature-dev`. Lowest barrier to entry.

### BMAD
- **Fullest PRD workflow** — 12-step collaborative requirements process. Nobody else has this depth.
- **Pluggable module system** — BMM (core), BMB (builder), CIS (creative intelligence), GDS (game dev), TEA (test architecture).
- **"Correct Course" backtracking** — loops back to the right layer (PRD / Architecture / Sprint) when something changes.
- **Party Mode** — multi-agent brainstorming with rotating specialist participation.

### GSD
- **Goal-backward verification** — checks "did the code deliver the user behavior?" not just "did tasks complete."
- **Wave-based parallel execution** — plans grouped by dependency; non-overlapping plans run concurrently.
- **Tightest requirement traceability** — REQ-01 → Phase → Plan → Artifact, enforced end-to-end.
- **Model profile system** — quality / balanced / budget. One of two frameworks (with nWave) that actively manages token cost.

### nWave
- **Most engineering-rigorous** — 5-phase TDD cycle with DES enforcement that flags skipped phases.
- **Mutation testing** — ≥80% kill rate as a quality gate. Tests that don't catch mutations fail the build.
- **Only DevOps wave** — dedicated infrastructure readiness and CI/CD guidance phase.
- **Dedicated peer reviewers** — every agent has a matching reviewer agent (11 total).
- **Rigor profiles** — lean (haiku, fast) to exhaustive (opus, mutation testing). Fine-grained cost control.

---

## What's Missing Across All Five

- **Cross-session learning** — some frameworks persist state (GSD's STATE.md, nWave's execution-log.json, Forge-AI's checkpoints), but none learn from past runs to improve their own process.
- **Adaptive ceremony** — none auto-scale their process to match task complexity. GSD comes closest with configurable toggles, nWave with rigor profiles.
- **Cost prediction** — none estimate token cost before execution.

---

## Best Fit Guide

| Scenario | Recommended | Why |
|---|---|---|
| Solo dev, single feature | **Feature-Dev** | Zero setup, deep exploration, user stays in control |
| Solo dev, multi-phase project | **GSD** | Requirement traceability, parallel execution, goal-backward verification |
| Team with CI/CD wanting automation | **Forge-AI** | Hands-off execution, crash recovery, deterministic pipeline |
| Complex product, full lifecycle | **BMAD** | PRD → Architecture → Stories → Code with pluggable modules |
| Engineering discipline (TDD/BDD) | **nWave** | Enforced TDD phases, mutation testing, hexagonal architecture |
| Rapid prototype / spike | **Feature-Dev** | Minimal ceremony, zero config, fast iteration |
| Regulated / enterprise | **nWave (thorough/exhaustive)** + **BMAD (TEA)** | Full audit trail, DES enforcement, risk-based test strategy |

---

## Versions Compared

| Framework | Version | Released | Install |
|---|---|---|---|
| **Forge-AI** | Pre-release | 2026 | `pip install forgeai` |
| **Feature-Dev** | v1.0.0 (official Anthropic plugin) | Ongoing | Install from Claude Code plugin marketplace |
| **BMAD** | v6.0.4 (stable) | March 2026 | `npx bmad-method install` |
| **GSD** | v1.22.4 | March 2026 | `npx get-shit-done-cc` |
| **nWave** | v2.3.0 (framework) / v1.1.16 (CLI installer) | March 2026 | `pip install nwave-ai` |

---

## References

| Framework | Repository | Docs / Site |
|---|---|---|
| **Forge-AI** | [github.com/elitecoder/forge-ai](https://github.com/elitecoder/forge-ai) | [PyPI: forgeai](https://pypi.org/project/forgeai/) |
| **Feature-Dev** | [github.com/anthropics/claude-code/tree/main/plugins/feature-dev](https://github.com/anthropics/claude-code/tree/main/plugins/feature-dev) | [Claude Code Docs](https://code.claude.com/docs/en/skills) |
| **BMAD** | [github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | [docs.bmad-method.org](https://docs.bmad-method.org/) |
| **GSD** | [github.com/gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) | [GSD Releases](https://github.com/gsd-build/get-shit-done/releases) |
| **nWave** | [github.com/nWave-ai/nWave](https://github.com/nWave-ai/nWave) | [nwave.ai](https://nwave.ai) |

---

## Methodology

This comparison was built by reading each framework's documentation, README, and public release notes as of March 2026. Most claims map to something observable in the repo — agent definitions, config schemas, workflow files, or CLI commands. Where a feature is documented but the implementation mechanism isn't publicly verifiable, we've described it in general terms rather than guessing specifics. No framework was tested end-to-end on the same project; this is a structural comparison, not a benchmark. Recommendations are based on documented capabilities, not practical testing.

---

*Comparison prepared March 2026 by [@sidtheone](https://github.com/sidtheone).*
