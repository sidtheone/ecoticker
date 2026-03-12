# Engine Fixes Proposed

Compiled 2026-03-12 after run-0003 retro. All items are unresolved. Sources: fix-monkey-findings.md, sentinel-issues.md, retro review.

---

## 1. Sentinel SKILL.md — add filtering/aggregation fixture rule

**File:** `.claude/skills/insight-sentinel/SKILL.md`
**Section:** Rules

**Add:**
> **For filtering/aggregation functions, mock the unfiltered shape.** If the function filters or aggregates query results, at least one test must pass data the implementation must filter out — not data that's already filtered. `mockSelect([])` for a "no matches" contract is not sufficient when the real query returns all rows and the implementation must exclude some.

**Why:** Run-0003: Sentinel wrote `mockSelect([])` for "no duplicates." Shipwright built without HAVING filter. All 7 tests passed. Cartographer caught it at Ship.

---

## 2. Devloop SKILL.md — Ship Monkey is required, not optional

**File:** `.claude/skills/insight-devloop/SKILL.md`
**Section:** "### The Monkey at Ship"

**Add at top of that block:**
> **Do not skip.** Ship Monkey runs AFTER fixes are applied and tests pass, before writing summary.md. If Storm/Cartographer/fixes consumed your attention, the Ship Monkey is still required. It is the last chaos check before archive.

**Why:** Run-0003: Monkey at Build was launched alongside Storm and Cartographer (wrong step). Ship Monkey never ran. Archive happened without it.

---

## 3. Devloop SKILL.md — Monkey at Build brief for single-worktree runs

**File:** `.claude/skills/insight-devloop/SKILL.md`
**Section:** "### The Monkey at Build"

**Problem:** The brief says *"find where two worktrees made different assumptions about a shared concept."* For Small triage with a single Shipwright, there are no cross-worktree seams. The Monkey defaults to Cross-Seam Probe even when no seam exists — technique repeat across steps.

**Add:**
> **Single-worktree runs:** If frame.md shows one Shipwright, the "two worktrees" framing doesn't apply. Brief the Monkey instead to look for implementation-to-intent divergence: does what was built match what the plan said to build? Best techniques in this context: **Assumption Flip, Delete Probe, Requirement Inversion**.

---

## 4. Shipwright SKILL.md — commit changes in worktree before returning

**File:** `.claude/skills/insight-shipwright/SKILL.md`
**Section:** Output

**Add:**
> **Commit your changes.** Before returning, stage and commit all created/modified files to the worktree branch. Unstaged changes in a worktree defeat the purpose of isolation — the orchestrator merges from the branch, not from the working tree.

**Why:** Run-0003: Shipwright left all changes unstaged. Worktree branch had zero new commits. Orchestrator had to manually copy 7 files instead of merging from the branch.

---

## 5. Fix Contract 1 in `tests/dedup-score-history.test.ts`

**File:** `tests/dedup-score-history.test.ts`
**Test:** `"returns zeros and does not delete when no duplicates exist"`

**Current (wrong):**
```typescript
mockDb.mockSelect([]);
const result = await dedupScoreHistory(db, false);
expect(result).toEqual({ topicsAffected: 0, rowsDeleted: 0 });
```

**Fix:**
```typescript
// Mock returns a singleton group (count=1) — what the DB actually returns for non-duplicate data
mockDb.mockSelect([{ topicId: 1, recordedAt: "2026-03-01", count: 1, maxId: 5 }]);
const result = await dedupScoreHistory(db, false);
expect(result).toEqual({ topicsAffected: 0, rowsDeleted: 0 });
expect(mockDb.chain.delete).not.toHaveBeenCalled();
```

**Why:** Original fixture mocked the ideal output (empty array), not the real DB shape (all groups including singletons). The missing HAVING filter was invisible.

---

## 6. Fix `onConflictDoUpdate` assertion in `tests/run-batch-pipeline.test.ts`

**File:** `tests/run-batch-pipeline.test.ts`
**Test:** `"uses onConflictDoUpdate when inserting score_history"`

**Current (weak):**
```typescript
expect(mock.chain.onConflictDoUpdate.mock.calls.length).toBeGreaterThanOrEqual(2);
```

**Problem:** Passes if any two `onConflictDoUpdate` calls happen for any reason (e.g. two topic upserts). Doesn't verify the call is for score_history specifically.

**Fix:** Assert that at least one call includes `scoreHistory.topicId` and `scoreHistory.recordedAt` in its target argument.

---

## 7. Commit run-0003 changes

**Branch:** `engine-test-landing-page`

All run-0003 changes are unstaged. Files to commit:
- `scripts/dedup-score-history.ts` (new)
- `tests/dedup-score-history.test.ts` (new)
- `src/db/schema.ts`
- `src/lib/batch-pipeline.ts`
- `src/app/api/seed/route.ts`
- `scripts/seed.ts`
- `tests/run-batch-pipeline.test.ts`
- `docs/deployment/deployment.md`
- `PATTERNS.md`
- `.insightsLoop/run-0003-same-day-batch-dedup/` (all artifacts)
- `.insightsLoop/fix-monkey-findings.md`
- `.insightsLoop/sentinel-issues.md`
- `.insightsLoop/engine-fixes-proposed.md` (this file)

---

## 8. Devloop SKILL.md — add "Write immediately" for monkey-*.md files

**Files:** `.claude/skills/insight-devloop/SKILL.md`, `.claude/skills/insight-devloopfast/SKILL.md`
**Sections:** Monkey at Frame (line 133), Monkey at TDD (line 170), Monkey at Build (line 204), Monkey at Ship (line 280)

**Problem:** storm-report.md, edge-cases.md, and normalization.md all have "IMPORTANT: Write immediately" warnings. The four monkey-*.md files do not, despite being: (1) referenced in subsequent Monkey briefs for dedup ("Previous Monkey findings this run: [1-line summary of monkey-frame.md finding]"), and (2) in the archive keep-set ("monkey-*.md — her performance over time is how you tune the system"). If the orchestrator doesn't persist them to disk, the next Monkey gets an empty dedup list and hits the same target twice. The archive contains no Monkey artifacts despite listing them as keepers.

**Fix:** Add after each Monkey invocation block:
> **IMPORTANT: Write `monkey-[step].md` immediately** after the Monkey agent returns. Agent output alone is not persistent — if you don't write the file, the next Monkey loses dedup context and the archive loses the artifact.

**Source:** Storm + Cartographer review, 2026-03-12

---

## 9. Devloop SKILL.md — guard merge against stopped worktrees

**File:** `.claude/skills/insight-devloop/SKILL.md`
**Section:** Step 3a: Merge (line 214)

**Problem:** Error handling (line 346) says "Shipwright can't make tests pass after 3 attempts: Stop the worktree." Step 3a iterates "For each worktree: Check which files were modified" with no completion guard. A stopped worktree with partial, non-passing implementation enters merge. Tests fail post-merge, but root cause is obscured — looks like an integration bug when it's a known-stopped worktree.

**Fix:** Add before the merge loop:
> **Pre-merge check:** Only merge worktrees where the Shipwright completed successfully (all assigned tests pass). Skip stopped worktrees entirely. Present to the user: "Merging worktrees: [list]. Skipped (Shipwright stopped): [list]." If all worktrees were stopped, do not proceed to merge — present the failures and loop back to the user.

**Source:** Storm review, 2026-03-12

---

## 10. Devloop SKILL.md — make Challenge section a hard gate

**File:** `.claude/skills/insight-devloop/SKILL.md`
**Section:** Prerequisites (line 96) and Step 1: Frame (line 107)

**Problem:** Line 96 describes the prerequisite as "plan.md (with a `## Challenge` section)" but the actual gate only checks plan.md existence. If plan.md exists without a Challenge section, the gate passes but Frame tries to "confirm the triage label from the `## Challenge` section" and finds nothing. The triage table (Small/Medium/Architectural) can't be applied. Wrong triage cascades through every step — wrong skip decisions, wrong approval gates, wrong parallelization plan.

**Fix:** Amend the prerequisite check:
> This skill expects `plan.md` with a `## Challenge` section — either in `.insightsLoop/current/` or the repo root. If plan.md doesn't exist, **do not proceed** — tell the user to run `/insight-plan` first. If plan.md exists but has no `## Challenge` section, **do not proceed** — tell the user the plan is incomplete. Both are hard gates.

**Source:** Storm + Cartographer review, 2026-03-12

---

## 11. Devloop SKILL.md — copy plan.md into current/ at run start

**File:** `.claude/skills/insight-devloop/SKILL.md`
**Section:** Phase 0 or Step 1 (before Frame)

**Problem:** Prerequisites accept plan.md "in `.insightsLoop/current/` or the repo root." Archive step (line 338) renames `current/` to `run-NNNN/`. If plan.md lives in repo root, it's not inside `current/` when the rename happens. The archived run has no plan.md — the artifact the skill calls "Without this, the rest means nothing" is silently lost.

**Fix:** Add to Phase 0 or start of Step 1:
> **Normalize plan.md location:** If plan.md is found in the repo root (not in `.insightsLoop/current/`), copy it into `.insightsLoop/current/plan.md` before proceeding. All downstream steps and the archive operate on the `current/` copy.

**Source:** Storm + Cartographer review, 2026-03-12

---

## 12. Devloop SKILL.md — add error handler for post-fix test regression

**File:** `.claude/skills/insight-devloop/SKILL.md`
**Section:** Error Handling (line 342) and Step 3d (line 284)

**Problem:** Error handling covers 5 scenarios (Sentinel compile, Shipwright 3-attempt, merge conflict, post-merge test fail, typecheck fail). None covers "tests fail after applying Step 3d fixes." Concrete scenario: Storm finds a critical issue, the fix touches a shared utility, a previously-passing test regresses. "Re-run tests after fixes" has no defined next step on failure.

**Fix:** Add to Error Handling:
> - **Tests fail after Step 3d fixes**: The fix broke something — this is a regression, not the original issue. Present both the original Storm/Cartographer finding and the newly failing test to the user. Do not retry the fix. Do not revert silently. The user decides: fix the regression, revert the fix and backlog the finding, or take a different approach.

**Source:** Storm + Cartographer review, 2026-03-12

---

## 13. Devloop SKILL.md — reconcile monkey_findings_per_step config with brief templates

**Files:** `.claude/skills/insight-devloop/SKILL.md`, `.claude/skills/insight-devloopfast/SKILL.md`
**Sections:** Phase 0 (line 42) and all Monkey brief templates (lines 125-131, 162-168, 196-202, 272-278)

**Problem:** Phase 0 says "If > 1, tell the Monkey: 'Produce N findings, each using a different technique.'" All four Monkey brief templates hardcode "Pick **one** technique and apply it with specificity." The Monkey's SKILL.md knows about multi-finding mode (line 114), but the devloop templates are the most salient text in each brief — they override the config instruction.

**Fix:** Add a note after Phase 0's config reading section:
> **When constructing Monkey briefs:** If `monkey_findings_per_step` > 1, replace "Pick one technique and apply it with specificity" in each Monkey brief with: "Produce {N} findings, each using a different technique. Each finding gets its own Technique/Target/Confidence/Survived block in the output file." The templates below assume the default (1). Modify them based on config.

**Source:** Storm + Cartographer review, 2026-03-12

---

## 14. Devloopfast SKILL.md — make borderline rule relative to confidence threshold

**File:** `.claude/skills/insight-devloopfast/SKILL.md`
**Section:** Step 3c filtering (line 150)

**Problem:** Borderline rule hardcodes "75-79: round up, show it." The confidence threshold is configurable in config.md (default: 80). If threshold changes to 90, findings at 75-79 still surface (below the new threshold) while 80-89 falls into a dead zone — neither shown as above-threshold nor caught by the borderline rule.

**Fix:** Change the borderline rule to:
> Borderline (threshold-5 to threshold-1): round up, show it. Better to over-surface than to miss.

**Source:** Storm review, 2026-03-12

---

## 15. Devloop SKILL.md — clarify Small triage step coverage

**File:** `.claude/skills/insight-devloop/SKILL.md`
**Section:** Step 1: Frame, triage table (line 109)

**Problem:** Small triage says "Steps to run: 2 → 3 (skip normalize)." This could be read as "only Build and Ship" — possibly skipping Storm/Cartographer verification. In practice, Storm and Cartographer still run for small changes. The table is ambiguous.

**Fix:** Clarify the Small row:
> Small | 1 file, no new interfaces, existing patterns | 2 → 3 (skip normalize; Storm + Cartographer still run)

**Source:** Storm review, 2026-03-12
