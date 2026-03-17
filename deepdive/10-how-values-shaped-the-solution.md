# How VALUES.md Shaped the Solution After the Switch

## Context

VALUES.md was created alongside the InsightsLoop engine. BMAD didn't have a values document — decisions were made per-story based on PRD requirements. After the switch, every InsightsLoop plan has a **Values Alignment** section where proposed work is checked against values before execution starts. Storm and Monkey use values as ammunition to challenge decisions.

This document traces each value to specific decisions it forced in the post-switch codebase.

---

## Product Values

### "The data hurts. That's the point."

**What it killed:** The old dashboard was comfortable. Card grid, filter chips, ticker bar — it read like a control panel. Organized, navigable, forgettable.

**What it forced:**
- **Run-0001 (gut-punch landing page):** The entire redesign intent was this value. Giant 72px score digit in the hero section. Severity-colored numbers that make you feel the state of the environment before you read a word. The plan literally says: "If the first view doesn't make you uncomfortable, the design failed."
- **Score-first layout (run-0002):** Topic detail page was restructured so the score IS the page. The number appears before the topic name. You see `85` in red before you see "Delhi Air Quality Crisis." The data hits before the context.
- **StaleDataWarning component:** Amber warning banner when data is >24h old. Doesn't hide the staleness — surfaces it. "Data may be outdated" is uncomfortable by design.
- **INSUFFICIENT_DATA shown as "N/A":** Dimensions with score -1 show "N/A" with "No Data" badge instead of being hidden. The absence of data is itself data that should hurt.

### "Insight, not information."

**What it killed:** Raw data dumps. The old TopicGrid showed all topics in a 3-column card grid with filters — it was a browsable list, not a curated view.

**What it forced:**
- **`computeHeadline()` — 6-rule waterfall:** Instead of showing all topics equally, the homepage now generates a single insight sentence: "Amazon Fires reached BREAKING" or "2 topics escalated." The headline is computed, not stored — it's insight derived from data, not information repeated from the database.
- **`selectHeroTopic()` — weighted selection:** The hero topic isn't the highest score — it's the highest `computeHeroScore` (score×0.6 + |change|×0.4). A topic at 60 that jumped +20 beats a stable 75. Movement IS insight. Stability is not.
- **Dimension reasoning (not just scores):** Each dimension shows 2-3 sentences of LLM reasoning explaining why that score was given. The number alone is information. The reasoning is insight. The values kept this when Monkey questioned whether dimensions earn their place at all.
- **`truncateToWord(impactSummary, 120)`:** Impact summaries are shown on cards but capped at 120 chars. Enough for insight, not enough for information overload.

### "Nothing decorative."

**What it killed:** This is the most aggressive value. It killed more things than it kept.

**What it forced to be deleted:**
- **Card backgrounds and rounded corners** (run-0002): `bg-[#f5f0e8] rounded-lg p-4` stripped from dimensions, articles, and score chart. These were chrome that didn't serve the data.
- **ScoreInfoIcon** (run-0002): The `?` tooltip with urgency scale was decorative next to a 72px number. Cut. The scoring page link lives in the footer for those who want it.
- **Weight percentages in dimension rows** (run-0002): "40% weight" labels were visual noise at row scale. The info lives on the scoring page.
- **Duplicate `<h3>Score History</h3>`** inside ScoreChart (run-0002): The section `<h2>` above already labeled it. The internal heading was redundant.
- **TopicGrid filter chips on homepage** (run-0001): Filters are a UI pattern for browsing. The new design is not for browsing — it's for confronting.
- **TickerBar from layout** (run-0001): The stock-ticker scroll was aesthetic, not functional. It duplicated data already shown in the hero and list.

**What it kept (because it passed the value check):**
- **SeverityGauge compact bars** in TopicList rows (run-0001): Monkey caught that text-only kills "peripheral dread." The gauge encodes score visually — it's data, not decoration. It stayed.
- **Left-border accent** on hero and dimension rows (run-0002): Severity-colored borders signal data hierarchy — hero = overall, dimension = per-aspect. That's information encoding, not decoration.
- **Article summaries as `line-clamp-1`** (run-0002): Titles alone can be ambiguous. One line of summary prevents misinterpretation. It survived "subtract until it breaks" because removing it broke comprehension.

---

## Engineering Values

### "Three lines beat a clever abstraction."

**What it killed:** The urge to refactor during fixes.

**What it forced:**
- **Ghost scoring fix (run-0005):** 15 lines of guard logic inserted into the existing loop body. No function extraction, no restructuring of the 1,312-line pipeline. The plan explicitly says: "Minimal diff — 4 targeted changes inside the existing loop, no function extraction." A "clean code" instinct would have extracted a `checkForDuplicates()` function, added a `ScoringDecision` type, maybe an `ArticleDeduplicator` class. Values said no — three lines of `filter` + `Set` + `continue` beat all of that.
- **TopicList as a new component (run-0001):** Instead of making TopicGrid "flexible" with a `variant="list"` prop, a new 40-line `TopicList` component was created. No shared base, no abstraction. Two components that do two different things. The plan explicitly chose this over modifying TopicGrid because TopicGrid had 14 tests validating filter behavior that doesn't exist in the new design. Modifying it would have required a clever abstraction to support both modes.
- **`severityColor()` returns a flat object:** 6 color values, no class hierarchy, no `SeverityTheme` abstraction. Every component calls it directly and picks the field it needs. Duplication across 8 call sites is cheaper than an abstraction that would need to know about gauges, badges, borders, sparklines, and change indicators.

### "Read it top to bottom or rewrite it."

**What it forced:**
- **Batch pipeline's linear flow:** The 1,312-line file reads top to bottom: fetch → merge → classify → score → persist → cleanup. No inversion of control, no event emitters, no middleware chain. Each step calls the next. You can trace the entire data flow by scrolling down.
- **Run-0005 plan as literal line numbers:** The plan specifies changes by line number ("Change 2: after line 1119", "Change 3: line 1166"). This only works because the file is readable linearly. If the pipeline used callbacks or plugins, line numbers would be meaningless.

### "Delete before you add."

**What it forced:**
- **Run-0001 net reduction:** The landing page redesign removed more than it added. TickerBar removed from layout. Sparklines removed from landing. Filters removed. TopicGrid still exists (not deleted — kept for potential future use) but is no longer rendered. Net fewer components on the page.
- **Run-0002 explicit cuts list:** The plan has a "Cuts" section: ScoreInfoIcon, weight percentages, dimension card backgrounds, article card backgrounds, chart background fill, duplicate heading. Six cuts for one feature.
- **Ghost scoring fix (run-0005):** "Removes the broken `articleCount++` counter, replaces arithmetic with reality." The old counter was deleted, not wrapped in a compatibility layer.
- **Copy tightening (run-0002):** "← Back to dashboard" → "← Back". "Latest score based on {n} articles" → "Scored from {n} articles". "No articles available for this topic" → "No sources yet". Every string got shorter.

### "Untested code doesn't leave the engine."

**What it forced:**
- **TDD as a gate, not a suggestion:** Every InsightsLoop run starts with Sentinel writing failing tests. Run-0001 went from 622 → 653 tests. Run-0002 from 653 → 665. Run-0005 created `fix-article-counts.test.ts` before `fix-article-counts.ts` existed.
- **The ghost scoring fix restructured mocks before writing implementation:** Task 1 in the plan is "Write failing tests — MUST restructure `mockForDaily` to discriminate by table." The test infrastructure change was the hardest part of the fix, and it was done first. Under "move fast" thinking, you'd write the fix, then update the tests. Values said no.
- **Source code audit tests:** `source-type-default.test.ts` uses `fs.readFileSync` to scan `src/` for the string `"newsapi"` — a value that was deprecated. This isn't a unit test. It's a regression gate enforced by the "untested code doesn't ship" value applied to deletion.

---

## UX Values

### "Useful on first load."

**What it forced:**
- **Server-rendered homepage:** `page.tsx` is a server component that queries the DB directly — no loading spinner, no skeleton, no "fetching topics..." state. The page arrives with data. This was an explicit architectural decision in run-0001: "Fully server-rendered landing page. No client-side fetch."
- **StaleDataWarning instead of empty state:** When the database has no data (first deploy before any batch run), instead of showing nothing, it shows: "We're monitoring the environment. Scores will appear after the next batch run (twice daily)." The user knows the system works and when to come back. No "add your first topic" onboarding.
- **`computeHeadline` fallback chain:** Even if there's only one topic and it's stable, the function produces "All topics stable today" — not an empty headline. Every state has a meaningful sentence.

### "Content over chrome."

**What it forced:**
- **No leaf icons, no green gradients:** The warm cream/beige light theme and charcoal dark theme are deliberately non-environmental. No eco-aesthetic. The `VALUES.md` explicitly states: "No green gradients, no leaf icons, no eco-aesthetic." The favicon is an "E" with severity bars, not a leaf.
- **Score leads everything:** On the homepage, the hero's giant score digit appears before the topic name. On cards, the score is the first element in the row. On the detail page, the score is the first thing rendered. Content (the data) always leads over chrome (the label).
- **OG images are data cards, not marketing:** The per-topic OG image shows the score, urgency badge, and three dimension scores. It's a score card, not a promotional graphic. No taglines, no calls to action.

### "Subtract until it breaks, then add one back."

This is the most active UX value. It was used as a decision framework in every run.

**Run-0001:**
- Subtracted: ticker bar, sparklines from landing, filter chips, card grid layout.
- Broke: Monkey caught that text-only topic list killed "peripheral dread" — you need the compact gauge to feel the accumulation of severity.
- Added back: compact SeverityGauge in TopicList rows. Minimum element needed to restore the visceral effect.

**Run-0002:**
- Subtracted: card backgrounds, rounded corners, ScoreInfoIcon, weight percentages, duplicate heading, 3-column dimension grid.
- Monkey questioned: Do dimensions earn their place at all? (confidence 82)
- Survived: Dimensions stayed because the overall score is a weighted composite — without dimensions you can't answer "which aspect is driving this number?" That's insight, not information.
- But: Dimension rows must NOT look like navigable topic rows. Left-border accent (not card background) signals "data, not link."

**Run-0005:**
- Subtracted: The entire scoring step for all-duplicate topics. The `continue` statement skips scoring, topic upsert, score_history, and keywords.
- Didn't break: Correct behavior — no new data means no new score. The subtraction IS the fix.

---

## Security Values

### "Validate at the door."

**What it forced:**
- **Ghost scoring fix framed as a validation problem:** The run-0005 plan says: "The pre-query IS validation at the door. External data (fetched articles) checked against DB state before any scoring or writes." The fix isn't error handling — it's input validation. Fetched articles are external input; checking them against the DB is boundary validation.
- **Zod schemas on all write endpoints:** `articleCreateSchema`, `articleUpdateSchema`, `articleDeleteSchema`, `topicDeleteSchema`. No write operation accepts unvalidated input.
- **Enum validation on GET params:** `/api/topics?urgency=invalid` returns 400, not an empty result set. Invalid input is rejected, not silently handled.

### "No secrets in code. Ever."

**What it forced:**
- **CI security linting** (`security.yml`): Scans `src/` and `scripts/` for hardcoded secrets via regex. Checks for committed `.env` files. This is the value enforced as automated infrastructure.
- **Source-type-default audit test:** Scans entire `src/` for stale `"newsapi"` references — not a secret, but the same "scan for things that shouldn't be in code" pattern applied to deprecated values.

### "Default closed."

**What it forced:**
- **Auth matrix split:** Public reads, authenticated writes. Not the other way around. Every new endpoint starts locked; you explicitly open GET endpoints.
- **Rate limiting on everything:** Even public GET endpoints have 100/min limits. The default isn't "open until you add a limit" — it's "limited unless you remove it."
- **CRON_SECRET separate from ADMIN_API_KEY:** The cron trigger uses Bearer token auth, not the same key as write endpoints. Two separate secrets, two separate access patterns. Default closed means each access path gets its own gate.

---

## The Compound Effect

Individual values are constraints. Together they compound into a design language.

"The data hurts" + "Nothing decorative" + "Subtract until it breaks" = a homepage where a giant red `85` is the first thing you see, with no visual comfort around it. No card, no gradient, no icon. Just the number and its color.

"Three lines beat a clever abstraction" + "Untested code doesn't leave the engine" + "Delete before you add" = a 15-line bug fix with 6 test files, no new abstractions, and a correction script that was tested before it existed.

"Useful on first load" + "Content over chrome" + "Insight, not information" = a server-rendered page that arrives with a computed headline, a selected hero topic, and a severity-sorted list — not a loading spinner followed by a data dump.

The values didn't make the code better in isolation. They made every decision **consistent** — and consistency is what turns a collection of features into a product with a point of view.
