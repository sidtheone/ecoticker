# Codebase Concerns

**Analysis Date:** 2026-03-08

## Tech Debt

**Duplicated Batch Pipeline Orchestration:**
- Issue: `src/app/api/batch/route.ts` (366 lines) and `scripts/batch.ts` (312 lines) contain near-identical orchestration logic (fetch, classify, score, upsert). The shared `src/lib/batch-pipeline.ts` extracts helper functions, but the glue code (Steps 1-4) is duplicated with intentional divergences documented inline.
- Files: `src/app/api/batch/route.ts`, `scripts/batch.ts`
- Impact: Changes to the batch flow require updating two files. Divergences (batching in route.ts vs single-call in batch.ts, fallback behavior on classification failure) make it easy to introduce inconsistencies.
- Fix approach: Extract a single `runBatchPipeline(options: { batchSize?: number; fallbackOnFailure?: boolean; db: DrizzleDB })` function into `src/lib/batch-pipeline.ts` that accepts strategy options. Both consumers call this with their preferred settings.

**Cron Endpoint Bypasses Admin Auth:**
- Issue: `src/app/api/cron/batch/route.ts` constructs a new `NextRequest` to call `batchPOST()` internally, but the constructed request has no `X-API-Key` header. The batch route requires admin auth via `requireAdminKey()`. The cron route works around this by... not setting the header, which means `requireAdminKey()` returns false and the batch would fail with 401.
- Files: `src/app/api/cron/batch/route.ts` (lines 49-52, 117-120)
- Impact: The cron endpoint likely returns 401 when calling batchPOST internally. If this is working in production, it means ADMIN_API_KEY is unset (which causes `requireAdminKey` to return false, not bypass). Either way, this is fragile and confusing.
- Fix approach: Either inject the admin key header into the constructed request, or extract the batch logic into a shared function that the cron endpoint calls directly without going through the HTTP handler.

**In-Memory Rate Limiting:**
- Issue: Rate limiter uses a module-level in-memory object (`const store: RateLimitStore = {}`). This works for single-instance deployments but does not scale to multiple instances and leaks memory over time (no cleanup of expired entries).
- Files: `src/lib/rate-limit.ts`
- Impact: Memory grows unboundedly as new IPs hit the API. In multi-instance deployments (Railway auto-scaling), each instance has independent rate limits, effectively multiplying the allowed requests.
- Fix approach: Add periodic cleanup of expired entries (e.g., sweep on every Nth check). For multi-instance, migrate to Redis-backed rate limiting. Acceptable for current single-instance Railway deployment.

**No Database Migrations System:**
- Issue: Schema changes are applied via `npx drizzle-kit push` which directly modifies the database. No migration files are tracked in version control.
- Files: `drizzle.config.ts`, `src/db/schema.ts`
- Impact: No rollback capability. Production schema changes are not auditable. Multiple developers could push conflicting schema changes.
- Fix approach: Switch to `drizzle-kit generate` + `drizzle-kit migrate` to produce versioned SQL migration files committed to `db/migrations/`.

**Sequential Article/Keyword Inserts in Batch:**
- Issue: Articles and keywords are inserted one-by-one in loops using individual `INSERT` statements within the batch pipeline.
- Files: `src/app/api/batch/route.ts` (lines 263-278, 301-309), `scripts/batch.ts` (lines 227-241, 263-271)
- Impact: For a batch with 10 topics and 50 articles, this produces ~60+ individual database round-trips. Slow on high-latency database connections.
- Fix approach: Use Drizzle's batch insert (`db.insert(articles).values([...array])`) to insert all articles for a topic in a single statement.

## Security Considerations

**Timing-Unsafe API Key Comparison:**
- Risk: `src/lib/auth.ts` compares API keys with `===` (line 19: `return apiKey === adminKey`). This is vulnerable to timing attacks where an attacker can determine the key character-by-character based on comparison timing.
- Files: `src/lib/auth.ts`
- Current mitigation: None. The rate limiter (10 writes/min) slows brute force but does not prevent timing analysis.
- Recommendations: Use `crypto.timingSafeEqual()` with `Buffer.from()` for constant-time comparison. Convert both strings to buffers of equal length before comparing.

**CSP Uses unsafe-inline:**
- Risk: Content-Security-Policy allows `'unsafe-inline'` for both `script-src` and `style-src`. This weakens XSS protection.
- Files: `src/middleware.ts` (lines 47-49)
- Current mitigation: This is a known Next.js limitation — hydration requires inline scripts. Tailwind requires inline styles.
- Recommendations: Investigate Next.js nonce-based CSP support to eliminate `'unsafe-inline'` for scripts. Style `'unsafe-inline'` is harder to avoid with Tailwind.

**IP Address Extraction is Spoofable:**
- Risk: Rate limiting and audit logging extract IP from `x-forwarded-for` and `x-real-ip` headers, which are trivially spoofable without a trusted reverse proxy.
- Files: `src/middleware.ts` (line 11), `src/lib/audit-log.ts` (lines 67-69)
- Current mitigation: Nginx reverse proxy in Docker sets these headers. Railway also sets them. Direct access (dev mode) has no protection.
- Recommendations: Document that rate limiting depends on trusted proxy. Consider validating header format. In production, ensure only the proxy can reach the app.

**Npm Audit Vulnerabilities:**
- Risk: 2 known vulnerabilities: `minimatch` (high severity, ReDoS) and `ajv` (moderate, ReDoS). Both are in dev dependencies.
- Files: `package.json`, `package-lock.json`
- Current mitigation: Dev dependencies only, not shipped to production.
- Recommendations: Run `npm audit fix` to resolve. CI pipeline (`security.yml`) runs `npm audit --omit=dev` which would not catch these.

## Performance Bottlenecks

**Sequential LLM Scoring:**
- Problem: Topics are scored one at a time in a sequential loop. Each `scoreTopic()` call makes an HTTP request to OpenRouter with a 30-second timeout.
- Files: `src/app/api/batch/route.ts` (line 207), `scripts/batch.ts` (line 165)
- Cause: No parallelism in the scoring loop. With 10 topics, worst case is 5 minutes of sequential LLM calls.
- Improvement path: Use `Promise.allSettled()` with a concurrency limiter (e.g., process 3 topics in parallel). Add a circuit breaker for repeated LLM failures.

**No Caching for Read APIs:**
- Problem: GET endpoints (`/api/topics`, `/api/ticker`, `/api/movers`) hit the database on every request with no caching layer.
- Files: `src/app/api/topics/route.ts`, `src/app/api/ticker/route.ts`, `src/app/api/movers/route.ts`
- Cause: No HTTP cache headers set. No in-memory cache. Data changes at most once per day (batch runs daily at 6 AM UTC).
- Improvement path: Add `Cache-Control: public, max-age=300` headers to GET responses. Data changes infrequently, so even 5-minute caching would eliminate most redundant queries.

**Batch Pipeline Timeout Risk:**
- Problem: The `/api/batch` route handler can run for several minutes (fetching feeds + multiple LLM calls). Web request timeouts may kill the request mid-processing.
- Files: `src/app/api/batch/route.ts`
- Cause: The route processes everything synchronously in a single HTTP request. Railway has a 5-minute request timeout.
- Improvement path: The article classification is already batched (groups of 10), but scoring is sequential. Consider using Next.js background functions or a queue-based approach for long-running batch jobs.

## Fragile Areas

**LLM Response Parsing:**
- Files: `src/lib/batch-pipeline.ts` (lines 240-248, 698-739, 748-782)
- Why fragile: The entire scoring pipeline depends on the LLM returning valid JSON with specific field names. `extractJSON()` uses a regex to find JSON in free text. If the LLM changes response format, wraps JSON in markdown code blocks differently, or returns partial JSON, parsing silently fails and defaults to score 50 across all dimensions.
- Safe modification: Always test with real LLM responses after model changes. The fallback defaults (line 759-778) mask LLM failures — monitor the "scoring LLM failed" console warning.
- Test coverage: Unit tests mock LLM responses. No integration tests verify actual LLM output format stability.

**Cleanup Endpoint Heuristic:**
- Files: `src/app/api/cleanup/route.ts` (lines 29-33)
- Why fragile: Demo data is identified by topics with `articleCount === 4` and articles from `example.com`. If real topics happen to have exactly 4 articles, they will be deleted. If seed script changes its article count, cleanup stops working.
- Safe modification: Add a `is_seed_data` boolean column to topics, or use a consistent URL prefix for seed data (e.g., `seed://`). Do not rely on article count heuristics.
- Test coverage: Tests exist but test the heuristic as-is, not edge cases where real data matches the pattern.

**Database Connection Pool at Module Scope:**
- Files: `src/db/index.ts`
- Why fragile: The `Pool` is created at module import time using `process.env.DATABASE_URL`. If the env var is not set when the module is first imported, the pool is created with `undefined` connection string. In Next.js, module-level code runs during build time, which can cause build failures if DATABASE_URL is not available.
- Safe modification: Wrap in a lazy initialization pattern or use Next.js dynamic imports for database access.
- Test coverage: Tests mock the entire `@/db` module, so this issue is invisible in tests.

## Scaling Limits

**In-Memory Rate Limiter:**
- Current capacity: Single-instance only. ~100K entries before memory pressure.
- Limit: No cleanup of expired entries. Memory grows linearly with unique IPs.
- Scaling path: Add TTL-based cleanup. For multi-instance: Redis with sliding window.

**PostgreSQL Connection Pool:**
- Current capacity: 10 connections (`src/db/index.ts` line 6).
- Limit: With concurrent batch processing and API traffic, 10 connections can be exhausted. Each batch run holds connections for the entire pipeline duration.
- Scaling path: Increase pool size for production. Add connection release monitoring. Consider separate pools for read and write operations.

**Score History Table Growth:**
- Current capacity: Unbounded growth. One row per topic per batch run.
- Limit: With 50 topics and daily batches, ~18K rows/year. Manageable but will slow down queries over years without partitioning or archival.
- Scaling path: Add retention policy (e.g., keep daily for 90 days, weekly for 1 year, monthly beyond). Index on `recorded_at` already exists.

## Dependencies at Risk

**rss-parser (v3.13.0):**
- Risk: Last published 2 years ago. No active maintenance. Relies on `xml2js` which has had vulnerability reports.
- Impact: RSS feed parsing could break with unusual feed formats. No security patches for discovered vulnerabilities.
- Migration plan: Consider `fast-xml-parser` + custom RSS parsing, or `feedparser` alternatives.

**Recharts (v3.7.0):**
- Risk: Large bundle size (~500KB). Heavy dependency for sparklines that could be rendered with simpler SVG.
- Impact: Performance impact on initial page load. Requires complex mocking in tests (jsdom cannot render SVG canvas).
- Migration plan: For sparklines only, consider lightweight alternatives like `react-sparklines` or custom SVG components.

## Missing Critical Features

**No Data Retention/Archival Policy:**
- Problem: Articles, score history, and audit logs grow indefinitely. Only audit logs have a 90-day purge in `scripts/batch.ts`, but not in `src/app/api/batch/route.ts`.
- Blocks: Long-term production viability. Database size will grow without bound.

**No Health Check for External Dependencies:**
- Problem: `/api/health` checks only database connectivity. No checks for GNews API availability, OpenRouter API health, or RSS feed reachability.
- Blocks: Cannot distinguish between "app is healthy" and "app is up but batch processing will fail."

**No Retry Logic for LLM Calls:**
- Problem: `callLLM()` in `src/lib/batch-pipeline.ts` makes a single attempt with a 30-second timeout. On transient failures (rate limits, network blips), the entire scoring for that topic fails and falls back to defaults.
- Blocks: Reliable scoring in production. OpenRouter rate limits and transient errors are common.

## Test Coverage Gaps

**No Integration Tests for Batch Pipeline with Real Database:**
- What's not tested: The full batch flow (fetch -> classify -> score -> upsert) against a real PostgreSQL instance. All batch tests mock the database.
- Files: `tests/api-batch-route.test.ts`, `tests/batch.test.ts`
- Risk: Schema mismatches, constraint violations, and upsert edge cases (e.g., slug collisions from similar topic names) would not be caught.
- Priority: Medium

**Cron Endpoint Auth Bypass Not Tested:**
- What's not tested: Whether the cron endpoint successfully calls the batch endpoint with proper authentication.
- Files: `tests/api-cron-batch.test.ts`
- Risk: The constructed NextRequest in cron likely fails auth (see Security section). If tests mock both auth and batch, the real interaction is untested.
- Priority: High

**Rate Limiter Memory Leak Not Tested:**
- What's not tested: Long-running behavior of the in-memory rate limiter. No tests verify that expired entries are cleaned up (they are not).
- Files: `src/lib/rate-limit.ts`
- Risk: Memory grows without bound in production. Would only manifest after days/weeks of continuous operation.
- Priority: Low (acceptable for current scale)

**No Load/Stress Tests:**
- What's not tested: Behavior under concurrent requests. Connection pool exhaustion. Rate limiter behavior at scale.
- Files: N/A
- Risk: Production failures under traffic spikes would be undetected until they occur.
- Priority: Low (personal project, low traffic)

---

*Concerns audit: 2026-03-08*
