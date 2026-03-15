# Crew Retro — Run 0005: Fix Ghost Scoring

## Sentinel
My contracts caught the shape of the bug correctly but I wrote them as if the implementation was a black box I could test through return values alone, and Storm exposed that I was testing the easy outputs while ignoring the hard invariants. The critical miss was the correction script mock: I assumed a single-query implementation when the plan explicitly specified two sequential SELECTs — the re-invoke with `mockTwoSelects` was the right fix but should have been my first instinct given I'd already built that pattern for `mockForDaily`. The all-duplicate test originally proved zero inserts but never asserted that scoring was skipped (fetch call count) or that the skip was observable (console.log), meaning a broken implementation that scored but discarded results would have passed. Next time I would test the negative path (what must NOT happen) with the same rigor as the positive path, and for any script that touches the DB more than once, I would trace the query sequence from the plan into the mock structure before writing a single assertion.

## Storm
My TDD review was the highest-value pass this run — the critical finding (mock/implementation strategy mismatch for fix-article-counts) and the high finding (no assertion that scoring was skipped) were real gaps that would have shipped green-but-hollow tests. The plan review's high finding about `scoreTopic` receiving all articles turned out to be an intentional design decision, which means I correctly identified the tension but rated it too high — that was a design disagreement, not a bug, and the user had to override me. My biggest miss was not catching earlier that the mock infrastructure was the real blocker for this entire fix — I flagged it as a pre-existing "medium" in the plan review and a "low" in TDD, but it was the hardest implementation problem and consumed the most rework. Severity calibration: TDD severities were accurate, plan review had one false-high, and verify's "high" was correctly identified as a false positive before it wasted anyone's time.

## Monkey
The GROUP BY orphan finding was the only one that actually mattered — it targeted the exact worst-case scenario and Scale Shift was the winning technique ("what does this query return when count is zero?"). My TOCTOU race finding was technically correct but practically irrelevant on a single-user project, and I spent my highest-confidence score on the URL near-dupes finding that was dismissed as pre-existing scope. The assumption I should have flipped but didn't: I assumed the batch pipeline was the only place `articleCount` could go wrong, so I never probed whether the correction script's own query could be structurally blind to the damage pattern it was designed to repair — I got there eventually via Scale Shift at Frame, but I should have caught it at Plan when the algorithm was first described.

## Shipwright
The plan was clear and buildable — exact code snippets for all four changes meant zero guessing on the core logic. The one gap was articleCount in the initial `values()` block: the plan specified `onConflictDoUpdate` but the same arithmetic bug existed earlier, and I had to discover that during the test run. The integration test breakage (`batch-rss-integration.test.ts`) was a predictable consequence of adding a new SELECT, but the plan only warned about `run-batch-pipeline.test.ts` mock restructuring — it didn't flag that a second test file had its own `where.mockResolvedValue`. The "run assigned tests only" worktree boundary is what let that slip through; Task 7's full-suite verification existed but ran post-merge, too late to catch it in isolation.

## Cartographer
The skip was wrong. A pre-query guard that intercepts existing mock chains is exactly the kind of structural path addition that needs mechanical enumeration — the integration test breakage proves it. Path enumeration would have mapped every `db.select` call site in `batch-pipeline.ts`, noted that the new pre-query shares the same mock interception point as existing queries, and flagged that test isolation depended on call ordering. The "small triage" heuristic failed here because the bug fix wasn't a value change — it was a structural insertion into an existing call graph, which is exactly the Cartographer's trigger condition regardless of changeset size.

---

## Lookout Synthesis

**What went right:** Mock restructuring on first pass. Storm TDD high-value (critical + 2 high all real). GROUP BY ?? 0 catch. Minimal diff held.

**What went wrong:** Integration breakage post-merge (grep missed). Plan missed values() block bug. Sentinel wrote single-query mock for two-query script. Storm Verify false positive from design decision not visible in diff. Cartographer skip was the wrong call.

**Key disagreement:** Cartographer vs triage — structural DB insertions in existing pipelines are her trigger regardless of "small." Next time: if new DB calls are inserted inside existing pipeline loops, run Cartographer.

**One-line summary below.**
