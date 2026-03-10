# CLAUDE.md — EcoTicker

## Working Style

- **Never assume.** Confirm before building. Ask first, always.
- **Ask before structural changes.** File renames, restructuring, architecture need approval.
- **Pause at checkpoints.** Show result, wait for approval before next step.
- **TDD.** Consult `TDD-MATRIX.md` before every change. When it says TDD, tests first — no exceptions.
- **Verify your work.** After implementing, run tests and confirm they pass. Never hand back unverified code.
- **Use subagents for exploration.** Don't read 10+ files in the main context. Delegate to a subagent and get a summary back.
- **Use `/feature-dev` for features.** Default workflow for new features.
- **Use GSD for multi-phase epics only.** Artifacts in `.planning/`.
- **Pre-commit.** Run `npx tsc --noEmit` and `npx jest` before every commit. Git hooks enforce this.
- **Log decisions.** Every decision goes in `DECISIONS.md` with what, why, and files touched.

## On Compaction

When context compacts, always preserve: list of modified files, test commands used, current task state, and any decisions made with the user.

## Values

@VALUES.md

## Key Commands

```bash
npm run dev               # Dev server :3000
npx jest                  # 641 tests (41 suites)
npx drizzle-kit push      # Push schema to PostgreSQL
npx tsx scripts/batch.ts  # Run batch pipeline
npx tsx scripts/seed.ts   # Seed sample data
docker compose up -d      # Production stack
```

## Reference

@PATTERNS.md
@TDD-MATRIX.md

When editing this file, refer to @.claude/BEST-PRACTICES.md
