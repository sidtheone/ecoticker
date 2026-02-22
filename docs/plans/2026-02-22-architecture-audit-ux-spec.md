# Architecture Audit: UX Spec vs. Current Codebase

**Date:** 2026-02-22
**Status:** Complete
**Alignment:** 67% — core engine solid, visual layer has gaps

---

## What's Already Built (no work needed)

| Requirement | Status |
|---|---|
| `/scoring` methodology page | Exists at `src/app/scoring/page.tsx` |
| Article attribution + source articles | `ArticleList` component + articles table with `sourceType` |
| Ticker bar (ambient credibility) | `TickerBar` component |
| Biggest Movers section | `BiggestMovers` component |
| Theme toggle (dark mode) | Class-based, localStorage persistence, OS fallback |
| InsightHeadline component | Exists (needs evolution into hero) |
| `previousScore` in topics table | Exists (enables hero calculation) |
| `anomalyDetected` in scoreHistory | Exists |
| `sourceType` on articles | Exists ("gnews" / "rss") |
| UrgencyBadge | Exists |
| Sparkline + ScoreChart | Exists (Recharts) |
| TopicCard + TopicGrid | Exists with urgency/category filters |
| Rate limiting + audit logging | Exists |
| Zod validation + CSP headers | Exists |

---

## Gaps Found (7 items, 3 phases)

### Phase 1 — Blocks Core UX (6–8 hours)

| # | Gap | Severity | Effort | Details |
|---|---|---|---|---|
| 1 | **`SeverityGauge` component** | CRITICAL | Size S | Pure CSS gradient bar (`green → yellow → orange → red`) + absolute-positioned marker at `left: ${score}%`. SSR-compatible. Gradient inflection points at 30/60/80. Min width 120px (solid color fallback below). Reusable across hero, cards, detail page, dimension sub-scores. |
| 2 | **Hero section with weighted score** | CRITICAL | Size S | `heroScore = currentScore × 0.6 + abs(currentScore - previousScore) × 0.4`. Tie-breaker: most recent `updatedAt`, then highest `currentScore`. Evolve InsightHeadline → merge with badge + gauge + insight sentence + action bar (`Updated Xh ago · [Share]`). Two layout modes: dramatic (severity ≥ 30) and calm (severity < 30). |
| 3 | **Product descriptor** | LOW | 15 min | One line in dashboard layout: "Environmental News Impact Tracker — AI-Scored Severity". Pure HTML, zero logic. |

### Phase 2 — Trust Infrastructure (4–5 hours)

| # | Gap | Severity | Effort | Details |
|---|---|---|---|---|
| 4 | **`severityColor(score)` unified utility** | HIGH | Size XS | Replaces split across `scoreToHex()`, `urgencyColor()`, `changeColor()`. Single function returns all color variants: badge bg, gauge gradient sample, left border, sparkline, change delta. One source of truth, 5+ consumers, zero divergence. |
| 5 | **Stale data warning UI** | HIGH | Size S | `StaleDataWarning` component. Query: "when did the last successful batch run?" Compare to now. Display banner when >18h stale. Empty-state: "Scores update daily at 6 AM UTC." Requires `batch_runs` table (Phase 3) or lightweight `last_batch_at` tracking. |

### Phase 3 — Operational / Story 4.4 Scope (12–18 hours)

| # | Gap | Severity | Effort | Details |
|---|---|---|---|---|
| 6 | **`batch_runs` table** | MEDIUM | Size S | Schema: `id, started_at, ended_at, successful, topics_processed, articles_added, scores_recorded, clamping_percentage, feed_health (JSONB), error_message`. Enables stale-data query, admin dashboard, feed health history. No migration — `drizzle-kit push`. |
| 7 | **Admin batch health dashboard** | MEDIUM | Size M | Three components: `BatchStatusCard` (status + article count), `AnomalyList` (delta >30 auto-flagged), `SourceHealthGrid` (per-feed article counts). Mobile-first layout, all above-the-fold for "all clear" path. Admin-only route with `X-API-Key` auth. |

---

## Schema Change Required

```typescript
// Add to src/db/schema.ts
export const batchRuns = pgTable("batch_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  successful: boolean("successful").default(false),
  topicsProcessed: integer("topics_processed").default(0),
  articlesAdded: integer("articles_added").default(0),
  scoresRecorded: integer("scores_recorded").default(0),
  clampingPercentage: numeric("clamping_percentage"),
  feedHealth: jsonb("feed_health"),
  errorMessage: text("error_message"),
});
```

---

## WCAG Color Corrections (from UX spec review)

Badge colors updated for WCAG AA compliance (≥4.5:1 white text contrast):

| Level | Old | New | Contrast |
|---|---|---|---|
| BREAKING | `#dc2626` | `#dc2626` (unchanged) | 4.83:1 ✓ |
| CRITICAL | `#ea580c` | `#c2410c` | 5.18:1 ✓ |
| MODERATE | `#ca8a04` | `#a16207` | 4.92:1 ✓ |
| INFORMATIONAL | `#16a34a` | `#15803d` | 5.02:1 ✓ |

---

## Critical Path

```
severityColor() utility → SeverityGauge component → Hero section → Stale data warning
                                                   ↗
                         Product descriptor (parallel, quick win)
```

**Phases 1–2 before public launch. Phase 3 ships with Story 4.4 (already in epic backlog).**

---

## Recommendations for Story Creation

- SeverityGauge and severityColor() can be one story (tightly coupled)
- Hero section is a separate story (depends on SeverityGauge)
- Product descriptor can be bundled with any frontend story as a quick add
- Stale data warning depends on batch_runs table — either create a lightweight `last_batch_at` column on an existing table, or ship batch_runs table first
- Admin batch health dashboard is 2 stories: infrastructure (table + API) and UI (components + page)
