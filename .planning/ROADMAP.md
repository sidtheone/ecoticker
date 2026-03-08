# Roadmap: EcoTicker Stabilization & Growth

## Overview

The production batch pipeline is broken. Phase 1 fixes it and knocks out quick security wins in the same pass. Phase 2 hardens the pipeline with consolidated orchestration, retry logic, and batch inserts. Phase 3 ships growth features on a stable foundation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (e.g., 1.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Fix & Secure** - Fix cron auth, verify pipelines on Railway, patch vulns, timing-safe auth
- [ ] **Phase 2: Harden** - Extract shared batch function, add LLM retries, batch inserts
- [ ] **Phase 3: Growth** - Embed widget, dynamic social cards, dynamic categories

## Phase Details

### Phase 1: Fix & Secure
**Goal**: Production batch pipeline runs on Railway and all quick security fixes are shipped
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. Cron endpoint on Railway triggers the batch pipeline and receives a 200 response (not 401)
  2. Batch run fetches articles from at least one RSS source and inserts them into the database
  3. Batch run fetches articles from GNews API and inserts them into the database
  4. Dashboard displays freshly scored topics after a batch run completes
  5. `npm audit` reports zero high or critical vulnerabilities
  6. API key comparison uses `crypto.timingSafeEqual` (verified by code inspection)

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Harden
**Goal**: Pipeline orchestration is consolidated, transient LLM failures are retried, and database writes are batched
**Depends on**: Phase 1
**Requirements**: PIPE-04, PIPE-05, SEC-03
**Success Criteria** (what must be TRUE):
  1. A single shared batch function is called by both the API route and the cron script (no duplicated orchestration)
  2. When an LLM scoring call fails transiently, the system retries (3 attempts, exponential backoff starting at 1s) before falling back to default scores
  3. Article and keyword inserts execute as batch operations (single INSERT with multiple rows)

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Growth
**Goal**: Visitors can share and embed EcoTicker data beyond the dashboard, with database-driven categories
**Depends on**: Phase 1
**Requirements**: GROW-01, GROW-02, DATA-01
**Success Criteria** (what must be TRUE):
  1. An external site can embed an iframe that displays a live topic widget with score, urgency badge, and sparkline
  2. Sharing a topic URL on a platform renders a dynamically generated 1200x630 image showing the topic score
  3. Topic categories are stored in the database and new categories can be added without code changes
  4. Dashboard category filter reflects database-driven categories

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3
Note: Phase 3 depends only on Phase 1, so it can execute in parallel with Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fix & Secure | 0/? | Not started | - |
| 2. Harden | 0/? | Not started | - |
| 3. Growth | 0/? | Not started | - |
