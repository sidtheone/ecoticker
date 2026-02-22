# UX Design Session Context

**Last updated:** 2026-02-21
**Status:** IN PROGRESS — Step 6 next
**Workflow:** create-ux-design
**Output file:** `_bmad-output/planning-artifacts/ux-design-specification.md`

---

## Workflow State

- **Steps completed:** 1 (init), 2 (discovery), 3 (core experience), 4 (emotional response), 5 (inspiration)
- **Next step:** Step 6 — Design System Choice
- **Step file path:** `_bmad/bmm/workflows/2-plan-workflows/create-ux-design/steps/step-06-design-system.md`

---

## Key Decisions Made (Steps 2–5)

### Step 2: Project Understanding
- 50/50 mobile/desktop split
- No push notifications — return visits driven by content change only
- Target aesthetic: **Weather Radar meets Bloomberg** (color-first, data-second)
- Two hero experiences: dashboard hero (return visitors) vs topic detail hero (share arrivals)
- Emotional funnel: 0–3s legibility → 3–8s context → 8–15s exploration → 15s+ action
- Ticker bar = ambient credibility + return-visit hook (not primary change detection)
- FR20 (score scale indicator) elevated to critical UX infrastructure

### Step 3: Core Experience
- Core interaction: **severity glance** (badge → gauge → number)
- Information hierarchy: Badge (primary) → Gauge (confirmation) → Number (precision)
- Design is a **codec**, not an amplifier — encodes severity, doesn't manufacture it
- Hero section: evolution of InsightHeadline, server-side topic selection via `heroScore = currentScore × 0.6 + abs(change) × 0.4`
- Severity gauge: pure CSS component, SSR-compatible, reusable everywhere
- Product descriptor: one-line subtitle "Environmental News Impact Tracker — AI-Scored Severity"
- Share button co-located with score (peak intent at 3–8s), clean URL copy
- Topic search: client-side filter-as-you-type, hidden behind search icon
- Timestamp on dashboard cards: "Updated Xh ago"
- Above-the-fold rules defined per page/viewport
- 6 experience principles: Severity in a Glance, Badge Before Gauge Before Number, Severity First Change Second, Confidence to Amplify, One Tap to Amplify, No Explanation Required

### Step 4: Emotional Response
- Primary emotion: **Informed Urgency** (gravity + comprehension → compelled sharing)
- NOT alarm — users share from knowing something their followers don't, not from panic
- Graduated emotional weight: INFORMATIONAL (calm) → MODERATE (watchful) → CRITICAL (serious) → BREAKING (grave)
- **Two-reds rule:** gauge gradient uses muted dark warm red, BREAKING badge uses bright saturated red
- Color scarcity applies to foreground signals only; background reference elements use full spectrum
- "Stable is Good News" — improving/stable states have positive emotional design
- 6 emotional design principles: Informed Urgency, Trust Earned in Pixels, Design with Intent Measure with Humility, Color Scarcity Creates Impact, Progressive Emotional Disclosure, Stable is Good News

### Step 5: Inspiration Analysis
- 7 reference products: Bloomberg, Dark Sky, USGS Earthquake, Hacker News, Windy, The Guardian, Substack
- **Page-specific references:** Dashboard = Bloomberg + Dark Sky + HN. Topic Detail = Guardian + USGS. Ticker = Bloomberg crawl.
- **Topic Detail as Editorial Landing Page** — reads like a news brief: score hero → insight lede → dimension body → source citations → sparkline history
- Dimension sub-scores use same `SeverityGauge` component at smaller size
- Ticker density weighting: BREAKING topics appear more frequently in rotation (constant speed preserved)
- Empty state = timeline ("scores at 6 AM UTC"), not error
- Anti-patterns: no continuous animation, no onboarding modals, no share sheets, no color everywhere, no blank empty states

### Elicitation Methods Used
- **Step 3:** First Principles Analysis + Party Mode (Sally/John/Mary) + User Persona Focus Group (Casey/Alex/Jordan) + Cross-Functional War Room (PM/Dev/Designer/Architect)
- **Step 4:** Challenge from Critical Perspective + Party Mode (Sally/John/Mary)
- **Step 5:** Party Mode (Sally/Amelia/Mary)

---

## Design System Context for Step 6

The project already has a design system in place (brownfield):
- **Tailwind CSS 4** with `@custom-variant dark` for class-based dark mode
- Warm cream/beige light theme: `bg-[#faf7f2]` (page), `bg-[#f5f0e8]` (cards), `text-stone-*`
- Dark slate dark mode
- No component library (MUI, Chakra, etc.) — all custom Tailwind components
- Recharts for charts (client-side only)
- Solo developer, intermediate skill level

Step 6 should recognize this existing system and build on it rather than proposing a wholesale change.

---

## Resume Instructions

To resume this workflow:
1. Run `/bmad-bmm-create-ux-design`
2. The workflow will detect the existing `ux-design-specification.md` and load `step-01b-continue.md`
3. Step-01b will read frontmatter, see steps 1–5 complete, and load step-06
4. Share this session context for faster ramp-up
