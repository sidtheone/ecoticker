---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-01b-continue', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - '_bmad-output/planning-artifacts/research/domain-rss-environmental-news-feeds-research-2026-02-17.md'
  - 'docs/plans/2026-02-09-llm-scoring-research.md'
  - '_bmad-output/project-context.md'
  - 'docs/plans/2026-02-12-user-stories-v2.md'
  - 'docs/plans/2026-02-09-business-panel-analysis.md'
  - 'docs/plans/2026-02-12-postgresql-drizzle-design.md'
  - 'docs/plans/2026-02-13-phase0-workflow.md'
  - 'docs/index.md'
  - '_bmad-output/planning-artifacts/index.md'
workflowType: 'prd'
briefCount: 0
researchCount: 2
brainstormingCount: 0
projectDocsCount: 7
classification:
  projectType: web_app
  domain: general
  complexity: medium
  projectContext: brownfield
  coreProblem: People are disconnected from environmental news because it lacks immediacy and emotional weight
  primarySuccessMetric: Viral coefficient — shares per session
  secondaryMetric: Return visit rate driven by score changes
  engagementModel: Social contagion — individual gut-punch moment leads to share leads to new user
lastEdited: '2026-02-21'
editHistory:
  - date: '2026-02-21'
    changes: 'Traceability fixes — added Morgan/Fatima success criteria, annotated Journey 9 as no committed FRs, linked score history criteria to Journey 7'
  - date: '2026-02-21'
    changes: 'Implementation leakage — removed endpoint path from FR36, added brownfield disclaimer to NFR section header'
---

# Product Requirements Document — EcoTicker

**Author:** Sidhartharora
**Date:** 2026-02-20

## Executive Summary

**Problem:** Environmental news lacks immediacy and emotional weight. People scroll past climate articles because headlines don't convey severity in a way that creates urgency to act or share.

**Solution:** EcoTicker is an environmental news impact tracker that aggregates news via RSS feeds and a commercial news API, scores severity across three dimensions (ecological, health, economic) using AI models, and displays results in a stock-ticker style dashboard with sparklines, urgency badges, and trend indicators.

**Differentiator:** No existing tool combines news aggregation + AI severity scoring + stock-ticker UI for environmental events. Climate dashboards (NOAA, Climate TRACE) serve experts with scientific data. News aggregators (Google News, Feedly) present headlines without severity quantification. EcoTicker fills the gap: a severity *number* that hits you in the gut, wrapped in a shareable social card.

**Target Users:**
- **Concerned Citizens** (primary) — want to understand "how bad" without being experts
- **Journalists** — need citable severity data with rich social cards
- **Sustainability Officers** — need embeddable environmental context for reports
- **Newsletter/Content Creators** — need shareable severity data to amplify their content

**Growth Model:** Social contagion. A gut-punch moment (high score + BREAKING badge) leads to a share, which leads to a new visitor, who experiences their own gut-punch. The viral artifact is a number + urgency badge, not a headline.

**Current State:** Brownfield. Epics 1–3 shipped (scoring engine, dashboard UI, social sharing). Three remaining MVP items: RSS fallback pipeline, GNews API integration (replacing NewsAPI), and a score scale indicator for cold landings. 266 tests passing, TypeScript clean, build green.

**Tech Stack:** Next.js 16 (App Router), PostgreSQL 17, Drizzle ORM, Recharts, Tailwind CSS 4, Docker Compose, Railway deployment.

## Success Criteria

### User Success

- **Casey (Concerned Citizen):** Lands on a shared topic page, reads urgency level and score in under 10 seconds, understands "how bad" without expertise.
- **Jordan (Journalist):** Can cite a topic URL in an article. The shared link renders a rich social card without needing to explain what they're sharing.
- **Returning Visitor:** Opens EcoTicker and immediately knows whether anything changed since their last visit via the dynamic insight headline and biggest movers section.
- **Morgan (Sustainability Officer):** *(Growth phase — activates when embed widget FR39 ships)* Can embed a live topic widget in a quarterly ESG report and cite a stable topic URL in footnotes, replacing 3 hours of manual news assembly with 20 minutes on EcoTicker.
- **Fatima (Newsletter Creator):** *(Growth phase — activates when dynamic OG images FR40 ship)* Can use EcoTicker scores and share cards as a recurring newsletter feature, driving measurable referral traffic back to EcoTicker.

### Business Success

| Metric | Target | Timeframe |
|---|---|---|
| Organic visits | 100 | 3 months |
| First organic share | Observed at least once | Month 1 |
| Repeat shares | 5+ shares observed | Month 3 |
| Share rate (at scale) | 0.01% (1 per 10,000 visitors) | Once 10K+ visits reached |
| Historical score data | 90+ consecutive days | Month 3 |
| Weekly return rate | >40% of visitors return within 7 days | Month 3 |

### Technical Success

- Batch pipeline runs daily without manual intervention
- Topic pages load in <3s on mobile
- Share cards render correctly on Twitter and LinkedIn
- Score freshness: <24 hours from event to score update
- Score history accumulates without gaps (observable via sparkline continuity in Journey 7 — Operator batch health checks)
- No score anomaly goes unlogged; no silent model drift goes undetected

### Measurable Outcomes

- **Month 1:** Batch runs 30 consecutive days; first organic social share observed
- **Month 3:** 100 organic visits; 90 days of score history; 5+ shares observed; at least 1 external citation
- **At scale:** Viral coefficient of 0.01% (1 share per 10,000 visitors)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — validate that the viral loop (score → gut-punch → share → new visitor) can spin with the minimum feature set.

**MVP State:** Epics 1–3 are shipped (scoring foundation, dashboard UI, impact features including share button and OG meta). Three remaining items complete the MVP.

**Resource Requirements:** Solo developer. All remaining stories are Size S. No parallel workstreams required.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Casey (Concerned Citizen) — share path ✅ shipped
- Bounced Visitor — retention via insight headline ✅ shipped; cold-landing scale indicator 🔧 remaining
- Jordan (Journalist) — cite and share path ✅ shipped
- Reactive Operator — batch health monitoring (partial, completed with RSS fallback)

**Must-Have Capabilities:**

| Capability | Status | Story |
|---|---|---|
| Severity scoring with 4-level rubric | ✅ Shipped | Epic 1 |
| Dashboard with ticker bar, topic grid, sparklines | ✅ Shipped | Epic 2 |
| Dynamic insight headline | ✅ Shipped | US-3.1 |
| Social sharing + OG meta | ✅ Shipped | US-6.1 |
| Article count indicator | ✅ Shipped | US-2.1 |
| RSS fallback pipeline | 🔧 Ready for dev | US-5.1/5.2 (Epic 4) |
| GNews API integration (replace NewsAPI) | 🔧 Ready for dev | FR2 (unassigned — pending story creation) |
| Score scale indicator on dashboard | 🔧 Ready for dev | Minor enhancement (cold-landing retention) |

**Score scale indicator:** A one-line explainer on the dashboard (tooltip or subtitle) communicating the 0–100 scale and urgency levels to cold visitors who arrive without context. Addresses the Bounced Visitor journey's core failure: "the numbers mean nothing" without a reference frame.

**Production news pipeline:**
- RSS feeds (10 curated, primary, always-on, free)
- GNews API Essential tier (supplementary, ~€40/month)
- NewsAPI removed entirely (dev-only ToS incompatible with production)

### Post-MVP Features

**Phase 2: Growth** (ordered by strategic leverage)

| Priority | Feature | User Story | Journey Unlocked |
|---|---|---|---|
| Growth-1 | Embed widget | US-6.2 | Morgan — live widgets in corporate/intranet reports (persistent backlinks) |
| Growth-2 | Dynamic OG images | US-6.3 | Fatima — visual score cards in newsletters and social |
| Growth-3 | User feedback mechanism | US-10.1/10.2 | The Skeptic — trust repair, prevents negative amplification |
| Growth-4 | Basic analytics dashboard | US-8.1/8.2 | Strategic Operator — data-driven coverage decisions |
| Growth-5 | Keyword management | US-4.1/4.2/4.3 | Strategic Operator — topic coverage expansion and cleanup |

**Phase 3: Vision**

| Feature | Description |
|---|---|
| API access (revenue) | Documented, paginated, rate-limited public API with usage tiers |
| White-label offering | Branded EcoTicker instances for organisations |
| User accounts | Saved topics, threshold alerts, personalised dashboard |
| Batch failure alerting | Proactive notification (webhook, email, or push) on batch pipeline failure or critical anomaly — eliminates need for manual morning checks |
| Scoring methodology validation | External academic or NGO review of scoring approach |

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GNews API outage or discontinuation | Low | Medium | RSS is primary pipeline; GNews is supplementary. Product survives without it. |
| LLM model drift (silent scoring changes) | Medium | High | Anomaly detection (>25pt flag), batch drift warning (>30% clamped), weekly manual audit of 5 topics |
| Stale data during news events | Medium | High | RSS fallback activates automatically when primary source returns 0 results |

**Market Risks:**

| Risk | Likelihood | Impact | Mitigation | Pivot Trigger |
|---|---|---|---|---|
| Viral loop doesn't spin (users don't share) | Medium | High | Dashboard has standalone value; pivot to SEO-first acquisition if sharing underperforms | If Month 2 shows <3 total shares observed, begin supplementary SEO investment (sitemap, JSON-LD, long-tail content). Does not replace social — hedges the bet. |
| Trust gap (AI scores meet public scepticism) | Medium | Medium | `/scoring` transparency page, source article links, feedback mechanism (Growth-3) | — |
| Geographic bias in coverage | Medium | Low | 10 RSS feeds span EU/USA/India; GNews adds global supplementary coverage | — |

**Resource Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Solo developer bottleneck | High | Medium | All stories Size S; Growth features are independent, ship incrementally |
| GNews recurring cost (~€40/mo) | Low | Low | RSS-first architecture; GNews can be dropped without killing the product |

## User Journeys

### Journey 1: Casey — The Concerned Citizen
*Primary user, success path*

**Opening Scene:** Casey is scrolling Twitter at 11 PM when a journalist friend retweets a post about Arctic sea ice. The tweet includes a card: "Arctic Sea Ice Decline — Score: 87 (BREAKING) | EcoTicker." The number 87 means nothing to Casey. But "BREAKING" in red does. She taps the link.

**Rising Action:** Casey lands on the topic detail page. Before anything else, she sees the big red "87" and the word "BREAKING" in a badge. Below it: "Ecological impact has worsened significantly in the last 24 hours." That sentence lands. She scrolls and sees the sub-score breakdown — Ecological Impact SEVERE, Health Impact MODERATE, Economic Impact SIGNIFICANT. She reads the Ecological reasoning: "Sea ice extent has dropped 40% below the 1981–2010 average. Three consecutive record lows suggest a structural shift, not seasonal variation." She didn't know that. She keeps reading.

**Climax:** Casey finds the Share button. She copies the link. Before sharing, she taps the "?" next to the score and reads: "BREAKING (80+): Catastrophic, potentially irreversible." She now has a sentence she can say out loud. She shares it with a caption.

**Resolution:** Casey's followers see the card. Two of them click through. Casey bookmarks EcoTicker. She doesn't return for two weeks — until the dashboard headline changes to "Arctic Ice improved to SIGNIFICANT." She comes back because the product told her something *changed*.

---

### Journey 2: The Bounced Visitor
*Primary user, failure and recovery path*

**Opening Scene:** Alex is a high school teacher preparing a climate unit. He found EcoTicker through a Google search for "wildfire environmental impact tracker." He lands on the dashboard cold — no context, no friend who recommended it.

**Rising Action:** Alex sees a scrolling ticker bar and a grid of 12 topic cards. "Amazon Deforestation: 74." "Delhi Air Quality: 68." "California Wildfire Season: 81." The numbers mean nothing. He has no idea if 74 is bad, high, or out of what total. The page title says "EcoTicker — Environmental News Impact Tracker." No headline, no entry point for a newcomer, no sentence that says "here's why this number matters."

**Climax (failure):** Eight seconds in, Alex decides: "This is for experts. I can't use this in class." Back button. Gone.

**Recovery:** Three months later, a colleague sends him a tweet with a shared EcoTicker card for a wildfire topic. The card says "California Wildfire Season — Score: 81 (BREAKING). Ecological impact rated SEVERE." Now he has context. He clicks. He lands on the *topic detail page* — not the dashboard. One topic, one score, clear urgency, plain-language reasoning. He understands immediately. He bookmarks it for his class.

**What this journey reveals:** The dashboard's cold-landing is the product's biggest retention failure. The dynamic insight headline and a brief scale indicator are retention mechanisms, not nice-to-haves. Topic detail pages are more accessible first impressions than the dashboard for zero-context visitors.

---

### Journey 3: Jordan — The Climate-Beat Journalist
*Professional user, cite and share path*

**Opening Scene:** Jordan covers environmental policy for a digital outlet. It's 7:45 AM. She opens five tabs every morning: Reuters, AP wire, Climate Home News, her Google Alerts digest, and — since last month — EcoTicker. She's writing about the EU's new methane regulation and needs to answer: "How bad is methane pollution in Europe right now?"

**Rising Action:** Jordan opens EcoTicker. The insight headline reads: "Methane Emissions reached SIGNIFICANT — largest weekly increase this month." That's her lede. She clicks through. Sub-score breakdown: Ecological SIGNIFICANT (61), Health MODERATE (44), Economic SIGNIFICANT (58). Under Ecological reasoning: "Satellite data shows methane concentrations 15% above pre-industrial baselines in three EU member states. New IPCC assessment links current concentrations to 0.3°C additional warming by 2040." She can cite that.

**Climax:** Jordan writes: *"According to EcoTicker's environmental severity index, methane pollution in Europe is currently rated SIGNIFICANT (61/100). The scoring methodology is available at ecoticker.com/scoring."* She pastes the topic URL into her article. When her editor previews the link in the CMS, a rich social card appears. It renders perfectly on Twitter and LinkedIn.

**Resolution:** Jordan's article gets picked up. Three other journalists DM her asking what EcoTicker is. She sends the link. EcoTicker gets cited in two more articles that week without anyone at EcoTicker doing anything.

---

### Journey 4: Morgan — The Sustainability Officer
*Professional user, quarterly report and embed path*

**Opening Scene:** Morgan works at a mid-size manufacturing firm with EU operations. Every quarter she produces an ESG report for the board. Slide 7 is always "Environmental Risk Context." She used to spend 3 hours manually assembling it from news searches. Now she spends 20 minutes with EcoTicker.

**Rising Action:** Morgan visits EcoTicker on the first Monday of each quarter. She filters by category — Water and Air Quality topics relevant to her firm's operations. She notes the 90-day sparkline trends and copies EcoTicker topic URLs into her slide footnotes. This quarter she wants to go further: embed a live widget in the digital version of the report.

**Climax:** Morgan finds the "Embed" button on the Rhine River Pollution topic. She copies the iframe code and pastes it into her company's intranet where the report lives. Now her board members see a live sparkline showing the last 30 days of Rhine River pollution scores — updating daily without Morgan touching it.

**Resolution:** The board's sustainability committee chair asks where the live data comes from. Morgan forwards the `/scoring` methodology page. The committee considers citing EcoTicker in their external sustainability report.

---

### Journey 5: The Skeptic — The Angry Expert
*Edge case, trust-repair path*

**Opening Scene:** Dr. Priya is an atmospheric scientist in Delhi. A colleague sends her the Delhi Air Quality EcoTicker page. She opens it sceptically.

**Rising Action:** Dr. Priya sees "Delhi Air Quality — Score: 52 (MODERATE)." She knows this is wrong. Last week's AQI readings showed hazardous levels across the entire city. She reads the reasoning: "Air quality concerns noted in several articles. PM2.5 levels elevated above safe limits." She looks at the articles. Two are three weeks old. The most recent severe episode isn't represented — the data is stale.

**Climax (without feedback):** No way to report the error. She closes the tab and tweets: "EcoTicker has Delhi Air Quality at MODERATE right now. It was literally hazardous this week. Don't trust automated scoring for public health data." Damage done.

**Climax (with feedback):** Dr. Priya finds a small "Report" link on the Health dimension card. A compact inline form appears. She selects "Too low" and types: "AQI hazardous levels this week not reflected. Check data recency for India sources." She submits. The form says: "Thanks — your feedback helps improve our scoring." She's been heard. She doesn't tweet negatively.

**Resolution:** Two weeks later, after Indian RSS sources are added and the score updates to SIGNIFICANT (71), Dr. Priya notices. She tweets: "Delhi Air Quality now SIGNIFICANT on EcoTicker — more accurate. Worth watching." EcoTicker gains followers from Indian environmental researchers.

---

### Journey 6: The Translator — The Newsletter Amplifier
*Growth user, content creator path*

**Opening Scene:** Fatima runs a climate newsletter with 12,000 subscribers. Every Friday she sends "This Week in Climate." She discovered EcoTicker six weeks ago and has been experimenting with it as a source.

**Rising Action:** Every Thursday, Fatima checks the Biggest Movers section. This week: "Ocean Acidification moved from MODERATE to SIGNIFICANT." That's her lead item. She reads the reasoning, grabs the EcoTicker score, writes her commentary, and pastes the topic URL into her newsletter.

**Climax:** Fatima writes: "Ocean Acidification just crossed into SIGNIFICANT territory on EcoTicker's severity index (score: 58). Here's what that means for coral reefs…" Her subscribers click the link. 340 people visit EcoTicker that week from her newsletter alone — more than from any other source. Three subscribers follow Fatima specifically because she found EcoTicker.

**Resolution:** Fatima wants to make this a regular feature. She wants to share scores as images — email clients don't always render OG cards. There's no "copy as image" option yet, so she screenshots manually. She tweets about wanting the feature, which brings more attention to EcoTicker.

---

### Journey 7: The Reactive Operator — Batch Health Monitor
*Admin user, reliability and anomaly triage path*

**Opening Scene:** It's 6:47 AM. The batch runs at 6 AM. The operator checks the admin panel on their phone before getting out of bed.

**Rising Action:** One scan: did it run? How many articles? Any anomalies? They see: "Batch completed 06:04 AM — 47 articles from RSS + GNews, 12 topics scored. 1 anomaly flagged: Arctic Sea Ice +28 points." They tap to read the reasoning. The reasoning is coherent — a major ice loss event covered by multiple sources. Not a model hallucination. They dismiss the anomaly.

**Climax:** Next week, GNews returns 0 results. Old behaviour: silent failure, stale data. New behaviour: "Batch completed 06:05 AM — GNews returned 0 results, fell back to RSS only (EPA: 8 articles, NOAA: 5 articles). 9 topics scored. Coverage reduced." The operator sees the fallback worked. Total morning check: 90 seconds. No manual intervention.

**Resolution:** The operator has confidence in the system. No late-night "did it run?" anxiety.

---

### Journey 8 (Sketch): The Strategic Operator — Growth and Coverage
*Admin user, keyword and analytics management*

The operator reviews keyword coverage monthly. Checks which topics are getting the most views via the analytics dashboard. Identifies gaps — no wildfire topics covering Australia despite major news coverage. Adds new keywords via `/admin/keywords`. Reviews which keywords are returning zero results and cleans them up. Notices "microplastic fish" has had 0 results for 3 consecutive runs and removes it.

---

### Journey 9 (Sketch): The Developer — API Consumer
*Technical user, future-seed path*
*⚠️ Discovery only — no committed FRs. API pagination, documentation, and rate-limit headers are Phase 3 Vision items, not committed requirements.*

A data journalist at a news organisation discovers EcoTicker, hits `GET /api/topics`, gets clean JSON back. Tries to build a small widget. Finds no API documentation, no pagination, no rate-limit headers in responses. Considers building on top of it but can't commit without docs. Shares the API informally with a colleague — "it's rough but the data is good." Plants the seed for future programmatic usage.

---

### Journey Requirements Summary

| Journey | Key Capabilities Revealed |
|---|---|
| Casey | Dynamic insight headline, OG meta cards, share button, urgency badge tooltip, score history |
| Bounced Visitor | Insight headline, score scale indicator on dashboard, accessible cold landing |
| Jordan | `/scoring` methodology page, rich OG meta, reasoning citations, "last updated" timestamp |
| Morgan | Category filter, embed widget, embed code button, stable topic URLs |
| The Skeptic | Per-dimension feedback form, data recency signal, source attribution per article |
| The Translator | Dynamic OG image, Biggest Movers prominence, newsletter-friendly share formats |
| Operator (Reactive) | Batch health log, anomaly display, RSS fallback status in admin |
| Operator (Strategic) | Keyword management, analytics dashboard, topic view counts |
| Developer | API pagination, rate-limit headers, documentation — *Phase 3 Vision, no committed FRs* |

## Domain-Specific Requirements

*Domain classification: general / low complexity. Explored anyway due to news aggregation + AI scoring intersection.*

### 1. Content Sourcing & Licensing

**Policy:** All production news sources must be either (a) direct-from-publisher RSS feeds or (b) commercially licensed APIs with explicit production-use rights.

| Source | Role | Legal Basis | Cost |
|--------|------|-------------|------|
| 10 curated RSS feeds | Primary — always-on | Fair use (headline + snippet + link back to source) | Free |
| GNews API (Essential) | Supplementary — broader coverage | Commercial ToS | ~€40/month |

**Removed:** NewsAPI (free tier is localhost-only, incompatible with production deployment). Eliminated during scoping — replaced by GNews API.

**Excluded sources:** Google News (no license, ToS prohibits scraping), social media scrapers, and other meta-aggregators. All feeds must be direct-from-publisher or via licensed APIs.

**Display format:** Headline + short snippet (≤200 chars) + link back to original article. No full article text reproduction.

**Attribution:** Source publisher name displayed on every article card (e.g., "via Reuters", "via The Guardian").

**Takedown process:** If a publisher requests removal, delete the article record and exclude the feed. No formal DMCA system required at launch.

### 2. LLM Scoring Accuracy & Transparency

**Disclosure:** The `/scoring` methodology page discloses that scores are AI-generated, documents the full rubric, dimension weights, and limitations. This page is linked from topic detail pages.

**Existing safeguards:**
- Anomaly detection flags any >25-point score change between batch runs
- Batch-level drift warning fires if >30% of dimension scores are clamped in a single run
- Newsworthiness pre-filter rejects Q&A, educational, and non-journalistic content before LLM scoring
- Blocked domain list prevents known junk sources from entering the pipeline
- Score clamping enforces rubric ranges (MINIMAL 0–25, MODERATE 26–50, SIGNIFICANT 51–75, SEVERE 76–100)

**Weekly manual audit:**
- Review 5 topics per week: read source articles, compare against dimension scores
- Log findings in `docs/scoring-audit-log.md` — date, topic, expected severity, actual severity, action taken
- If score is suspect: re-run `scoreTopic()` for that topic against its existing articles
- If re-run produces the same bad score: open a prompt-fix story to adjust the rubric or classification prompt
- No manual score overrides — improve the system, not individual results

**Score confidence (future, not MVP):** Surface article count as a trust signal — a score backed by 8 articles is more reliable than one backed by 1 article. Defer to Growth phase.

### 3. GDPR & Privacy (EU Launch)

Already fully implemented:
- No raw IPs stored — last octet truncated via `CF-Connecting-IP` header
- No cookies, no user accounts, no third-party trackers
- `/data-policy` page published and accessible from footer
- 90-day automatic audit log purge runs in every batch
- Cloudflare as reverse proxy — no server-side IP logging

No additional GDPR work required for launch.

### 4. Environmental Claims & Greenwashing

**Framing principle:** EcoTicker is a **news analysis tool**, not an environmental authority. Scores represent the AI model's interpretation of news coverage severity, not objective measurements of environmental reality.

**Design principle — topic-level, not entity-level:** EcoTicker scores environmental *topics* ("Amazon Deforestation", "Delhi Air Quality Crisis"), never specific companies or organisations. Topic names describe the environmental issue, not assign blame. This is enforced via a classifier prompt instruction: "Topic names should describe the environmental issue, not blame a specific entity."

**Regulatory position:** The EU Green Claims Directive targets companies making claims about their own products' environmental properties. EcoTicker is a news aggregation and analysis tool — it does not make product-level environmental claims and falls outside the Directive's scope.

**Mitigations in place:**
- Scoring methodology page with full transparency on rubric, weights, and limitations
- "Scores are generated by AI models" disclaimer in Limitations section
- All scores link back to source articles — users can verify the underlying reporting
- Topic-not-entity naming convention prevents defamation exposure

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **The Financial Ticker Metaphor for Environmental News** — EcoTicker borrows the emotional vocabulary of financial markets (severity scores, trend sparklines, "breaking"/"critical" urgency badges, biggest movers) and applies it to environmental impact. This reframes environmental news from "long article you should read" to "number that hits you in the gut." No existing tool does this — climate dashboards (NOAA, Climate TRACE) present scientific data for experts; news aggregators (Google News, Feedly) present headlines without severity quantification.

2. **AI-Scored Severity at Topic Level** — Most AI news tools do sentiment analysis or summarization. EcoTicker scores *impact severity* across three dimensions (ecological, health, economic) using a calibrated rubric. This is closer to how risk analysts assess events than how news aggregators rank stories.

3. **The Score as Viral Unit** — Traditional news products go viral through articles or headlines. EcoTicker's viral artifact is a *number + urgency badge* — "Amazon Deforestation: 88 BREAKING" as an OG social card. The hypothesis: a single severity score creates shareable urgency even for events the sharer has no geographic connection to.

**Core Assumption Being Challenged:** "People don't care about environmental news until it affects them personally." EcoTicker bets that a numerically quantified gut-punch — a red BREAKING badge with a high score — creates urgency for distant events the same way a stock market crash creates urgency even if you don't own stocks.

### Market Context & Competitive Landscape

| Tool | What It Does | Gap EcoTicker Fills |
|------|-------------|---------------------|
| Climate TRACE | Satellite emissions tracking, monthly data | Scientific data for experts, not news severity for general public |
| NOAA Climate Dashboard | Global temperature/CO2/sea level indicators | Long-term trends, not real-time news event scoring |
| Climate Risk Index (CRI) | Annual country-level risk ranking | Retrospective annual reports, not daily event-level severity |
| Google News / Feedly | News aggregation by topic | Headlines without severity quantification |
| Climate Change Tracker | 60+ data sources, climate indicators | Data monitoring, not emotional impact scoring |

No existing tool combines news aggregation + AI severity scoring + stock-ticker UI for environmental events.

### Validation Approach

Geographic disconnect + share action. If users share topics they have no personal geographic connection to (e.g., someone in London sharing "Amazon Deforestation: 88 BREAKING"), the ticker metaphor is creating urgency independent of personal proximity. Measurable via share-click analytics with IP geolocation vs topic region.

### Risk Mitigation

| Risk | Fallback |
|------|----------|
| Scores don't create emotional response | The underlying news content still has value; pivot to headline-first with scores as secondary signal |
| Users don't trust AI-generated scores | Scoring methodology page + article source links provide transparency; weekly audits maintain accuracy |
| Ticker metaphor trivialises serious events | Urgency badge language ("BREAKING", "CRITICAL") is borrowed from journalism, not finance — familiar and appropriate for news severity |

## Web App Specific Requirements

### Project-Type Overview

EcoTicker is a server-rendered Multi-Page Application built on Next.js 16 App Router with selective client-side hydration. Pages are server-rendered for fast initial load and SEO, with client components (`"use client"`) for interactive elements (charts, theme toggle, share button, ticker bar).

### Technical Architecture Considerations

**Rendering Strategy:** Server-side rendering (SSR) via Next.js App Router. Topic detail pages and dashboard are server-rendered with dynamic data from PostgreSQL. Client components handle interactivity (Recharts sparklines, theme persistence, clipboard API).

**Browser Support Matrix:**

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | Last 2 versions | Primary development target |
| Firefox | Last 2 versions | |
| Safari | Last 2 versions | Clipboard API requires HTTPS |
| Edge | Last 2 versions | Chromium-based |
| IE / Legacy | Not supported | |
| Mobile Safari | iOS 15+ | |
| Chrome Android | Last 2 versions | |

**Responsive Design:** Mobile-first responsive layout. Dashboard grid collapses from 3-column → 2-column → 1-column. Topic detail page is single-column on all viewports. Ticker bar scrolls horizontally on all screen sizes.

**Performance & Accessibility:** See Non-Functional Requirements for specific targets and specifications.

**SEO Strategy:** Social sharing is the primary growth channel. SEO is supplementary — not a primary acquisition focus.
- Server-rendered pages provide baseline SEO (crawlable content, meta tags)
- OG meta tags on all topic pages (implemented in Story 3-2)
- Scoring methodology page is indexable for "environmental impact scoring" searches
- No sitemap or JSON-LD structured data at launch (defer to Growth phase if organic search shows promise)
- `robots.txt` allows all crawlers

**Data Refresh:** Daily batch pipeline at 6AM UTC. No real-time/WebSocket updates. Users see latest scores on page load. Sufficient for the product's cadence — environmental severity doesn't change minute-to-minute.

### Implementation Considerations

- Next.js `output: "standalone"` for Docker deployment
- Tailwind CSS 4 with `@custom-variant dark` for class-based dark mode
- PostgreSQL connection pooling via `pg` library (managed by Drizzle ORM)
- No native features or CLI commands required

## Functional Requirements

### Environmental News Aggregation

- FR1: The system can ingest environmental news articles from multiple RSS feed sources on a daily schedule
- FR2: The system can ingest environmental news articles from GNews API (Essential tier) as a supplementary source to RSS feeds, on a daily schedule
- FR3: The system can automatically fall back to alternative sources when the primary source returns no results
- FR4: The system can deduplicate articles by URL to prevent scoring the same article twice
- FR5: The system can filter out non-journalistic content (Q&A, educational, promotional) before scoring
- FR6: The system can block articles from known junk domains
- FR6b: The system can sanitise all externally ingested content (titles, snippets, URLs) before database storage — stripping HTML tags and validating URL format

### Impact Severity Scoring

- FR7: The system can score each topic across three impact dimensions (ecological, health, economic) using AI models
- FR8: The system can produce a weighted composite severity score (0–100) for each topic
- FR9: The system can classify topic urgency into four levels based on score thresholds (informational, moderate, critical, breaking)
- FR10: The system can detect score anomalies when a topic's score changes by more than 25 points between runs
- FR11: The system can flag batch-level drift when more than 30% of scores are clamped in a single run
- FR12: The system can generate plain-language reasoning for each dimension score
- FR13: The system can generate descriptive topic names from clustered articles
- FR14: The system can retain daily score snapshots for each topic to support historical trend analysis
- FR15: The system can track both current and previous scores for each topic to enable change detection

### Dashboard & Topic Discovery

- FR16: Visitors can view all scored topics on a dashboard with current scores and urgency indicators
- FR17: Visitors can see a scrolling ticker bar summarizing active topics and scores
- FR18: Visitors can see which topics have changed the most recently (biggest movers)
- FR19: Visitors can see a dynamic insight headline summarizing the most significant recent change
- FR20: Visitors can see a brief scale reference on the dashboard (tooltip or subtitle) that explains the 0–100 scoring range and four urgency levels, enabling first-time visitors to interpret scores within 10 seconds of landing
- FR21: Visitors can see how many articles contributed to each topic's score
- FR22: Visitors can see the urgency classification (informational, moderate, critical, breaking) on topic cards and detail pages
- FR23: Visitors can customize their appearance preferences (light/dark theme)

### Topic Detail & Transparency

- FR24: Visitors can view a dedicated detail page for each topic with full score breakdown by dimension. Page includes a visible disclaimer: "Scores are generated by AI models and represent an interpretation of news coverage, not objective measurements"
- FR25: Visitors can read the AI-generated reasoning behind each dimension score
- FR26: Visitors can see the historical score trend for a topic over time (sparkline)
- FR27: Visitors can access source articles associated with a topic, with attribution to the original publisher. Note: articles shown are all articles for the topic, not exclusively those from the latest scoring batch. Exact batch-to-article linkage is deferred (requires batch_id column)
- FR28: Visitors can access a methodology page explaining how scores are calculated, including rubric, weights, model identity, limitations, and an explicit disclaimer that scores are AI-generated interpretations of news coverage
- FR29: Visitors can see when a topic's score was last updated — on both the topic detail page and dashboard topic cards (e.g., "Updated 6h ago")
- FR30: Visitors can see the publication date of source articles contributing to a topic's score
- FR30b: Visitors can see the date range of articles contributing to the current score (e.g., "Based on 8 articles from Feb 12–18") to distinguish score freshness from data freshness

### Social Sharing & Distribution

- FR31: Visitors can copy a shareable link to any topic page
- FR32: Shared topic links can render rich social preview cards on social platforms (OG meta). Cards include topic name, score, urgency level, and score date to prevent stale-card misinterpretation

### Content Sourcing Compliance

- FR33: The system can display article attribution (source publisher name) on every article reference
- FR34: The system can limit displayed article content to headline and short snippet with link back to original
- FR35: Operators can remove individual articles and exclude entire feed sources from the pipeline

### Operational Monitoring

- FR36: Operators can view batch pipeline run status including article counts, source breakdown, and anomaly flags — via a dedicated admin API endpoint and optionally an admin page
- FR37: Operators can view an audit log of all write operations with timestamp, action, and outcome — filterable by action type, date range, and success/failure
- FR38: The system can authenticate operators for all write operations via API key

### Growth Capabilities (Phase 2)

- FR39 (Journey 4: Morgan): Visitors can embed a live topic widget on external sites via iframe, showing current score, urgency badge, and sparkline (full article list excluded from embed). Widget is responsive within its container and supports a theme query parameter
- FR40 (Journey 6: Fatima): Shared topic links can render dynamically generated score images (1200x630) for platforms that don't support OG meta
- FR41 (Journey 5: The Skeptic): Visitors can submit feedback on score accuracy per dimension. Rate-limited: 5 submissions per IP per hour
- FR42 (Journey 8: Strategic Operator): Operators can view topic page analytics (view counts, share counts)
- FR43 (Journey 8: Strategic Operator): Operators can manage keyword lists that drive topic coverage
- FR44 (Journey 1: Casey): Visitors can filter topics by category on the dashboard
- FR45 (Journey 4: Morgan): Visitors can download a topic's score history as CSV for use in external reports and slide decks

## Non-Functional Requirements

*NFR specifications reference the current technology stack (documented in Executive Summary) for implementation clarity in this brownfield project.*

### Performance

| Metric | Target | Context |
|---|---|---|
| Page load (LCP) | < 3 seconds on mobile | Casey's 10-second comprehension window starts at page load |
| Time to Interactive | < 4 seconds on mobile | Charts and share button must be usable quickly |
| API response time | < 500ms (p95) | Dashboard and topic pages fetch from API routes |
| Batch pipeline total runtime | < 5 minutes | Daily 6AM UTC run. Not user-facing but affects score freshness. |
| LLM scoring per topic | < 30 seconds per request | OpenRouter timeout. Pipeline must complete within batch window. |

### Security

| Requirement | Specification |
|---|---|
| Authentication | All write operations (POST/PUT/DELETE) require valid API key via `X-API-Key` header. Public read access (GET) requires no authentication. |
| Rate limiting | Read endpoints: 100 requests/minute per IP. Write endpoints: 10 requests/minute per IP. Batch/seed: 2 requests/hour per IP. Public write endpoints without authentication (e.g., feedback): 5 requests/hour per IP. Returns 429 with `Retry-After` header. |
| Data privacy (GDPR) | No raw IP addresses stored — last octet truncated. No cookies, no user accounts, no third-party trackers. Audit logs auto-purged after 90 days. |
| Input validation | All write endpoints validate input against Zod schemas. Reject malformed input with 400 and descriptive error messages. |
| SQL injection protection | All database queries use parameterised placeholders via Drizzle ORM. No string concatenation in SQL. |
| Error sanitisation | Production error responses hide implementation details (stack traces, file paths, query text). Development mode shows full errors. |
| Content Security Policy | CSP headers enabled on all pages. Script sources restricted to self and Next.js hydration requirements. |
| Ingestion sanitisation | All externally ingested content (article titles, snippets, URLs) must be sanitised before storage. HTML tags stripped, URLs validated against allowlist of known publishers. |
| LLM prompt injection resistance | Article content passed to LLM scoring prompts must be treated as untrusted input. Content is enclosed in delimiters and the prompt instructs the model to treat it as data, not instructions. |
| HTTPS enforcement | All traffic must be served over HTTPS. HTTP requests redirect to HTTPS. No mixed content allowed. |
| Secret hygiene | API keys and secrets must never appear in application logs, error messages, or client-facing responses. |
| Dependency scanning | Dependency vulnerability scanning (npm audit) runs on every CI build. Known critical/high vulnerabilities block deployment. |

### Reliability

*NFRs marked ✅ are implemented in the current codebase. Remaining NFRs (🔧) should be validated during relevant epic implementation.*

| Requirement | Specification | Status |
|---|---|---|
| Batch pipeline availability | Must run successfully every day without manual intervention. Target: <1% failure rate (≤3 failed runs per year). | ✅ |
| Source fallback | If primary news source returns 0 results, system automatically falls back to alternative sources. No manual intervention required. | 🔧 Epic 4 |
| Total source failure | If all news sources return 0 articles in a batch run, the system logs a critical warning and retains all previous topic scores unchanged. No scores are zeroed or deleted due to source unavailability. | 🔧 Epic 4 |
| Score data continuity | Score history must accumulate without gaps. Target: 90+ consecutive days of daily snapshots within first 3 months. | ✅ |
| Anomaly detection | Every batch run checks for >25-point score changes (per topic) and >30% clamped scores (batch-level). All anomalies logged. No anomaly goes unrecorded. | ✅ |
| Batch atomicity | Batch score writes are atomic per topic — a failed write for one topic does not corrupt or prevent writes for other topics. Partial batch completion is acceptable; partial topic writes are not. | ✅ |
| Partial batch visibility | If a batch completes with fewer topics scored than expected, the batch health log records which topics were skipped and why. | 🔧 Epic 4 |
| Graceful degradation — empty state | Dashboard renders a meaningful empty state when no topics are scored (fresh deployment or batch failure). No blank page, no error screen. | ✅ |
| Graceful degradation — low data | Topics scored from fewer than 3 articles display a reduced-confidence indicator. Score is still shown but trust signal is lower. | 🔧 Growth |
| Graceful degradation — LLM error | If LLM fails to score a dimension, the topic retains its previous score. Failed dimension is logged. No partial/corrupt scores written to database. | ✅ |
| Web application uptime | Target 99% monthly uptime. Shared topic URLs must return a valid page within 15 minutes of any unplanned outage being detected. Recovery speed is prioritised over prevention perfection. Deployment failures recoverable via container restart or rollback within 15 minutes. | ✅ |

### Scalability

| Requirement | Specification |
|---|---|
| Launch capacity | System supports up to 1,000 daily visitors and 50 concurrent users without performance degradation. Sufficient for 10x the 3-month target. |
| Database capacity | PostgreSQL handles up to 10,000 articles and 100 topics with indexed queries. No architectural changes needed below this threshold. Launch expectation: 10–15 topics from default keywords; Growth target: 30+ topics within 3 months via keyword management (FR43). |
| Growth ceiling | Beyond 10,000 daily visitors or 200+ topics: evaluate connection pooling limits, CDN for static assets, and read replicas. No pre-optimisation required before this threshold. |

### Accessibility

| Requirement | Specification |
|---|---|
| Semantic HTML | All pages use semantic elements (`<nav>`, `<main>`, `<article>`, `<table>`) for screen reader compatibility. |
| Colour independence | Urgency levels are communicated via text labels alongside colours. Colour is never the sole indicator. |
| Keyboard navigation | All interactive elements (links, buttons, theme toggle, share button) are keyboard-focusable and operable. |
| Contrast | Dark mode and light mode both maintain sufficient contrast ratios for body text and urgency badges. |
| Formal compliance | No WCAG compliance target at launch. Best-effort approach with semantic foundations that can be audited later. |
