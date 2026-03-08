# Requirements: EcoTicker

**Defined:** 2026-03-08
**Core Value:** The daily batch pipeline must run reliably in production — fetching news, scoring topics, updating the dashboard — without manual intervention.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Pipeline Stabilization

- [ ] **PIPE-01**: Cron endpoint successfully triggers batch pipeline with proper authentication on Railway
- [ ] **PIPE-02**: RSS feeds fetch and parse articles successfully in production environment
- [ ] **PIPE-03**: GNews API fetches and returns articles successfully in production environment
- [ ] **PIPE-04**: Batch pipeline orchestration extracted into single shared function with configurable strategies
- [ ] **PIPE-05**: LLM scoring calls retry on transient failures (rate limits, network errors) with exponential backoff

### Security

- [ ] **SEC-01**: All npm audit vulnerabilities resolved (minimatch, ajv)
- [ ] **SEC-02**: API key comparison uses constant-time `crypto.timingSafeEqual` instead of `===`
- [ ] **SEC-03**: Article and keyword inserts use batch operations instead of individual INSERT per row

### Growth

- [ ] **GROW-01**: Visitors can embed a live topic widget on external sites via iframe showing score, urgency badge, and sparkline
- [ ] **GROW-02**: Shared topic links render dynamically generated 1200x630 score images for platforms that don't support OG meta

### Data Model

- [ ] **DATA-01**: Topic categories are database-driven instead of hardcoded, allowing dynamic category management

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Admin & Measurement (Epic 5)

- **ADMIN-01**: Operators can add and manage search keywords that drive topic coverage
- **ADMIN-02**: Operators can deactivate topics (hide from dashboard without deleting)
- **ADMIN-03**: Operators can view keyword status (active, zero-result, stale)
- **ADMIN-04**: System tracks page views per topic
- **ADMIN-05**: Operators can view analytics dashboard (view counts, share counts)
- **ADMIN-06**: Operators can view batch health dashboard (run status, article counts, anomalies)

### Feedback (Epic 6 partial)

- **FEED-01**: Visitors can submit feedback on score accuracy per dimension
- **FEED-02**: Operators can view aggregated feedback submissions

## Out of Scope

| Feature | Reason |
|---------|--------|
| API access / documentation | Phase 3 Vision — no committed user demand yet |
| White-label offering | Phase 3 Vision — requires user accounts first |
| User accounts / saved topics | Phase 3 Vision — no auth system, premature complexity |
| Batch failure alerting (email/webhook) | Phase 3 Vision — console logging sufficient for solo operator |
| Database migration system | `drizzle-kit push` sufficient for solo dev |
| Redis-backed rate limiting | Single Railway instance, acceptable for current scale |
| Load/stress testing | Personal project, low traffic |
| Multi-instance scaling | Single Railway instance for foreseeable future |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase ? | Pending |
| PIPE-02 | Phase ? | Pending |
| PIPE-03 | Phase ? | Pending |
| PIPE-04 | Phase ? | Pending |
| PIPE-05 | Phase ? | Pending |
| SEC-01 | Phase ? | Pending |
| SEC-02 | Phase ? | Pending |
| SEC-03 | Phase ? | Pending |
| GROW-01 | Phase ? | Pending |
| GROW-02 | Phase ? | Pending |
| DATA-01 | Phase ? | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
