---
phase: 01-fix-secure
plan: 01
subsystem: api
tags: [auth, security, cron, timing-safe]

# Dependency graph
requires: []
provides:
  - Working cron-to-batch auth flow with X-API-Key header injection
  - Timing-safe API key comparison via crypto.timingSafeEqual
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "crypto.timingSafeEqual for constant-time key comparison"

key-files:
  created:
    - tests/auth.test.ts
  modified:
    - src/app/api/cron/batch/route.ts
    - src/lib/auth.ts
    - tests/api-cron-batch.test.ts

key-decisions:
  - "Minimal fix: inject X-API-Key header into constructed NextRequest (Phase 2 handles shared batch extraction)"
  - "Buffer length check before timingSafeEqual to avoid throwing on mismatched lengths"
  - "TDD: wrote 8 failing tests first, then implemented"

patterns-established:
  - "Timing-safe comparison for all secret comparisons"

requirements-completed: [PIPE-01, SEC-02]

# Metrics
duration: 4min
completed: 2026-03-08
---

# Phase 1 Plan 1: Fix Cron Auth Bypass + Timing-Safe Key Comparison

**Fixed cron endpoint 401 by injecting X-API-Key header into all 4 internal NextRequest constructions, and hardened auth.ts with crypto.timingSafeEqual**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T16:06:00Z
- **Completed:** 2026-03-08T16:10:00Z
- **Tasks:** 1 (TDD)
- **Files modified:** 4

## Accomplishments
- Injected X-API-Key header into all 4 NextRequest constructions in cron/batch/route.ts (GET batch, GET seed, POST batch, POST seed)
- Replaced `===` with `crypto.timingSafeEqual` in auth.ts with Buffer length guard
- Created tests/auth.test.ts with 8 test cases for timing-safe comparison
- Updated tests/api-cron-batch.test.ts to verify X-API-Key header injection
- All 611 tests pass, 0 regressions

## Task Commits

1. **test(01-01):** add failing tests for cron auth bypass and timing-safe comparison
2. **feat(01-01):** fix cron auth bypass and add timing-safe key comparison

## Self-Check: PASSED
- [x] crypto.timingSafeEqual in auth.ts
- [x] x-api-key in all 4 cron request constructions
- [x] All tests pass (611/611)
