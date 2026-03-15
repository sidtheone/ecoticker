# PRD Session Context — COMPLETED

**Last updated:** 2026-02-20
**Status:** ✅ PRD COMPLETE
**Purpose:** Pre-digested context so next session can resume immediately without re-reading all input docs.

---

## Workflow State

- **Workflow:** create-prd
- **Output file:** `_bmad-output/planning-artifacts/prd.md`
- **Steps completed:** step-01-init, step-02-discovery, step-03-success, step-01b-continue, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional
- **Current step:** `step-11-polish.md` — ready to begin
- **Step file path:** `_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-11-polish.md`
- **After polish:** PRD COMPLETE

---

## Step 5 Completed (Domain Requirements)

Domain complexity = general/LOW, but user chose to explore anyway. Party Mode session produced 4 domain requirements now saved in PRD:

1. **Content Sourcing & Licensing** — RSS-first, GNews Essential (~€40/mo) as supplement, NewsAPI dev-only, Google News excluded
2. **LLM Scoring Accuracy & Transparency** — weekly manual audit (5 topics, logged), re-run as escalation, no manual overrides
3. **GDPR & Privacy** — already fully implemented, no additional work
4. **Environmental Claims & Greenwashing** — news analysis tool framing, topic-not-entity naming, classifier prompt guardrail

**Side output:** Emergency story created — `_bmad-output/implementation-artifacts/emergency-replace-newsapi-with-gnews.md` (replace NewsAPI with GNews API, launch blocker, prioritized above Epic 4)

## Step 6 Completed (Innovation Discovery)

Innovation signals confirmed — EcoTicker is genuinely novel, not just solid execution. Three innovation areas documented:
1. Financial ticker metaphor for environmental news (no existing tool does this)
2. AI-scored severity at topic level (beyond sentiment analysis)
3. Score as viral unit (number + badge, not headline)

Core assumption challenged: "People don't care until it's personal." Validation: geographic disconnect + share action.

## Step 7 Completed (Project-Type Deep Dive)

Web app specific requirements documented:
- MPA with client-side hydration (Next.js App Router)
- Modern evergreen browsers only (last 2 versions)
- SEO: supplementary, not primary (social sharing is growth channel)
- Data refresh: daily batch, no real-time/WebSocket
- Accessibility: best-effort semantic HTML, no formal WCAG target

---

## What's in the PRD (completed sections)

### Success Criteria ✅
- **User:** Casey (10s clarity), Jordan (citable share card), Returning Visitor (headline tells what changed)
- **Business:** 100 organic visits / 3 months; first organic share Month 1; 5+ shares Month 3; 40% weekly return rate
- **Technical:** <3s mobile load; <1% batch failure; anomaly detection >25pt jumps; no silent model drift

### Product Scope ✅
- **MVP:** Epics 1–3 PLUS RSS fallback (US-5.1/5.2) + Share button (US-6.1) — minimum for viral loop
- **Growth:** Keyword management, analytics, embed, dynamic OG, feedback
- **Vision:** API access revenue, white-label, user accounts with alerts

### User Journeys ✅ (9 journeys — written in full narrative form)

| # | Journey | Type |
|---|---|---|
| 1 | Casey — Concerned Citizen | Primary, success path |
| 2 | The Bounced Visitor | Primary, failure + recovery |
| 3 | Jordan — Journalist | Professional, cite + share |
| 4 | Morgan — Sustainability Officer | Professional, report + embed |
| 5 | The Skeptic / Angry Expert | Edge case, trust-repair |
| 6 | The Translator / Newsletter Amplifier | Growth, content creator |
| 7 | Operator (Reactive) | Admin, reliability + anomaly |
| 8 | Operator (Strategic) [sketch] | Admin, keyword + analytics |
| 9 | Developer / API Consumer [sketch] | Future-seed |

**Journey Requirements Summary** also written and appended to PRD.

**How journeys were developed:** Party Mode session with Sally (UX), John (PM), Mary (Analyst). Key additions vs original 4 personas: Bounced Visitor, Skeptic, Translator/Amplifier, Operator split into Reactive + Strategic.

---

## Classification (frontmatter)
- Brownfield web app, medium complexity, domain: general
- Core problem: people disconnected from environmental news — lacks immediacy + emotional weight
- Primary metric: viral coefficient (shares/session)
- Engagement model: social contagion — gut-punch moment → share → new user

---

## Input Documents (loaded in PRD frontmatter — 9 files)

- `_bmad-output/planning-artifacts/research/domain-rss-environmental-news-feeds-research-2026-02-17.md`
- `docs/plans/2026-02-09-llm-scoring-research.md`
- `_bmad-output/project-context.md`
- `docs/plans/2026-02-12-user-stories-v2.md`
- `docs/plans/2026-02-09-business-panel-analysis.md`
- `docs/plans/2026-02-12-postgresql-drizzle-design.md`
- `docs/plans/2026-02-13-phase0-workflow.md`
- `docs/index.md`
- `_bmad-output/planning-artifacts/index.md`

Key facts:
- **RSS research:** 10 feeds across EU/USA/India, ~40-90 articles/day, legally clear
- **LLM scoring:** 4-level rubric, Eco 40% / Health 35% / Econ 25%, temperature 0, few-shot calibration
- **DB:** PostgreSQL 17 + Drizzle ORM, 8 tables, all live
- **User stories v2:** 21 stories across 6 phases
- **Business panel:** 9 experts, consensus = surface existing data > add features

## Step 8 Completed (Scoping)

MVP boundary confirmed. Party Mode surfaced two additions:

**MVP (Phase 1) — 3 remaining items:**
1. RSS fallback pipeline (US-5.1/5.2)
2. GNews API integration (replace NewsAPI — emergency story, NewsAPI removed entirely)
3. Score scale indicator on dashboard (cold-landing retention, minor enhancement)

**Production pipeline:** RSS (primary, free) + GNews Essential (~€40/mo, supplementary). NewsAPI removed.

**Growth phase ordering (user-confirmed):**
1. Embed widget (US-6.2) — persistent backlinks
2. Dynamic OG images (US-6.3) — viral loop amplifier
3. User feedback (US-10.1/10.2) — trust repair
4. Basic analytics (US-8.1/8.2) — operator visibility
5. Keyword management (US-4.1/4.2/4.3) — coverage expansion

**Pivot trigger:** If Month 2 shows <3 total shares, begin supplementary SEO investment (sitemap, JSON-LD).

---

## Step 9 Completed (Functional Requirements)

44 FRs total: 38 MVP + 6 Growth, organized into 8 capability areas.

**Elicitation methods applied:**
- Comparative Analysis Matrix — found 3 gaps (score freshness timestamp, category filtering, article publication date)
- Critique and Refine — moved 2 misplaced NFRs (rate limiting, audit log purge) to step-10 carry-forward
- Party Mode — found 4 gaps (topic naming, score snapshots, previous score tracking, urgency badge display)

**Step-10 carry-forward (NFRs):**
- Rate limiting (availability/security)
- Audit log auto-purge at 90 days (GDPR)
- Graceful degradation for empty/error/low-data states

---

## Step 10 Completed (Non-Functional Requirements)

5 categories documented: Performance, Security, Reliability, Scalability, Accessibility.

**Elicitation methods applied:**
- Chaos Monkey Scenarios — 3 reliability gaps (total source failure, batch atomicity, web app uptime)
- Security Audit Personas — 5 security NFRs (ingestion sanitisation, LLM prompt injection, HTTPS, secret hygiene, dependency scanning)
- Challenge from Critical Perspective — 2 changes (uptime reframed as recovery speed, partial batch visibility)

**Key NFR counts:** Performance 5, Security 12, Reliability 11, Scalability 3, Accessibility 5 = 36 total NFRs.

---

## PRD COMPLETE — Next Steps

PRD workflow finished 2026-02-20. All 12 steps completed.
Output: `_bmad-output/planning-artifacts/prd.md`
