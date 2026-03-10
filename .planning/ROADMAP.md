# Roadmap: EcoTicker Stabilization & Growth

## Overview

The production batch pipeline is broken. Phase 1 fixes it and knocks out quick security wins in the same pass. Phase 2 hardens the pipeline with consolidated orchestration, retry logic, and batch inserts. Phase 3 ships growth features on a stable foundation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (e.g., 1.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Fix & Secure** - Fix cron auth, verify pipelines on Railway, patch vulns, timing-safe auth
- [x] **Phase 2: Harden** - Extract shared batch function, add LLM retries, batch inserts
- [ ] **Phase 3: Growth** - Embed widget, dynamic social cards, dynamic categories

## Phase Details

### Phase 1: Fix & Secure
**Goal**: Production batch pipeline runs on Railway and all quick security fixes are shipped
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, SEC-01, SEC-02
**Plans:** 3 plans
**Success Criteria** (what must be TRUE):
  1. Cron endpoint on Railway triggers the batch pipeline and receives a 200 response (not 401)
  2. Batch run fetches articles from at least one RSS source and inserts them into the database
  3. Batch run fetches articles from GNews API and inserts them into the database
  4. Dashboard displays freshly scored topics after a batch run completes
  5. `npm audit` reports zero high or critical vulnerabilities
  6. API key comparison uses `crypto.timingSafeEqual` (verified by code inspection)

Plans:
- [x] 01-01-PLAN.md — Fix cron auth bypass + timing-safe key comparison
- [x] 01-02-PLAN.md — Resolve npm audit vulnerabilities
- [x] 01-03-PLAN.md — Deploy and verify pipeline on Railway

### Phase 2: Harden
**Goal**: Pipeline orchestration is consolidated, transient LLM failures are retried, and database writes are batched
**Depends on**: Phase 1
**Requirements**: PIPE-04, PIPE-05, SEC-03
**Success Criteria** (what must be TRUE):
  1. A single shared batch function is called by both the API route and the cron script (no duplicated orchestration)
  2. When an LLM scoring call fails transiently, the system retries (3 attempts, exponential backoff starting at 1s) before falling back to default scores
  3. Article and keyword inserts execute as batch operations (single INSERT with multiple rows)

Plans:
- [x] 02-01: LLM retry logic (3 attempts, exponential backoff)
- [x] 02-02: Batch article + keyword inserts

### Phase 3: Growth
**Goal**: Visitors can share and embed EcoTicker data, starting with working social cards
**Depends on**: Phase 1
**Requirements**: GROW-01, GROW-02
**Success Criteria** (what must be TRUE):
  1. Sharing a topic URL on a platform renders a dynamically generated 1200x630 image showing the topic score
  2. An external site can embed an iframe that displays a live topic widget with score, urgency badge, and sparkline

Plans:
- [ ] 03-01: Launch-day fixes (OG env var, font override, visible h1, skeleton cards, filter button touch targets)
- [ ] 03-02: Dynamic OG images (per-topic 1200x630 generated images)
- [ ] 03-03: Embed widget

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3
Note: Phase 3 depends only on Phase 1, so it can execute in parallel with Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fix & Secure | 3/3 | Complete | 2026-03-10 |
| 2. Harden | 2/2 | Complete | 2026-03-10 |
| 3. Growth | 0/? | Not started | - |
