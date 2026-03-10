# Decision Log

Reverse chronological. Every decision with context on why.

---

## 2026-03-10

### Added feature-dev values override rule
- **Why:** `/feature-dev` plugin doesn't receive VALUES.md context. It planned too extensively for Phase 2 (full explore + clarify when we already had context). Rule now injects values check at planning phase, not just implementation.
- **Files:** .claude/rules/feature-dev.md (new)

### Phase 2 complete — LLM retries + batch inserts shipped with TDD
- **Why:** callLLM() had no retries (single failure = topic skipped), articles/keywords inserted one-by-one. Both caused silent data loss and unnecessary DB round-trips.
- **Decisions:** 3 attempts with 1s/2s exponential backoff. Retry on 5xx, 429, timeout, network errors. No retry on 4xx. No chunking for batch inserts (PostgreSQL handles hundreds of rows). Empty array guard on both.
- **Files:** src/lib/batch-pipeline.ts, tests/batch-pipeline.test.ts (+6 tests), tests/run-batch-pipeline.test.ts (+3 tests), tests/batch-rss-integration.test.ts, tests/api-batch-route.test.ts

### Saved CLAUDE.md best practices locally
- **Why:** Fetching from Anthropic docs every time wastes API calls. Local copy at `.claude/BEST-PRACTICES.md` is faster and always available.
- **Files:** .claude/BEST-PRACTICES.md (new), CLAUDE.md (updated import)

### Added compaction, verification, and subagent rules to CLAUDE.md
- **Why:** Anthropic best practices recommend these. We were missing: explicit "verify your work" instruction, compaction survival rules, and subagent-for-exploration guidance.
- **Files:** CLAUDE.md

### Restructured CLAUDE.md — moved reference content out
- **Why:** CLAUDE.md was 122 lines of mixed instructions and reference material. Per Anthropic best practices, only behavioral instructions belong here. Reference content burns tokens every session without changing behavior.
- **Files:** CLAUDE.md (52 → 38 lines), PATTERNS.md (new), .claude/rules/security.md (new), .claude/rules/testing.md (new)

### Created path-specific rules for security and testing
- **Why:** Security rules only matter when touching API routes. Testing rules only matter when touching test files. Path-scoped `.claude/rules/` files load on demand instead of every session.
- **Files:** .claude/rules/security.md (new), .claude/rules/testing.md (new)

### Decision log over database
- **Why:** 2-person project. Markdown is searchable, diffable, git-tracked, zero overhead. Database is overkill until we need querying across hundreds of entries.
- **Files:** DECISIONS.md (new)

### TDD matrix over blanket TDD rule
- **Why:** Blanket "always TDD" was being skipped for changes that felt obvious (retry logic, batch inserts). The skip was wrong for those cases but right for others (pure refactors, deletions). Matrix makes the decision explicit per change type.
- **Files:** TDD-MATRIX.md (new), CLAUDE.md (updated rule)

### Reverted implementation to do TDD properly
- **Why:** Built retry + batch inserts without writing tests first. Both were new behavior and interface changes — the TDD matrix says tests first for both. Reverted and committed to doing it right.
- **Files:** src/lib/batch-pipeline.ts (reverted), tests/ (reverted)

### Marked Phase 1 complete
- **Why:** Traced the cron auth code — already fixed. Uses Bearer CRON_SECRET, calls runBatchPipeline() directly, timing-safe comparison in auth.ts. No work remaining.
- **Files:** .planning/ROADMAP.md, .planning/STATE.md

### Phase 2 scope reduced — batch consolidation already done
- **Why:** `scripts/batch.ts` and `src/app/api/batch/route.ts` both call `runBatchPipeline()` from shared module. Only LLM retries and batch inserts remain.
- **Files:** None (assessment only)

### Confirmed prompt injection is YAGNI
- **Why:** Security review flagged LLM prompt injection via article titles. Attack requires poisoning GNews results targeting our specific prompt format. For 2 users on a personal project, effort-to-impact doesn't justify it.
- **Files:** None (decision to not build)
