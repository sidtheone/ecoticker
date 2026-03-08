# Phase 1: Fix & Secure - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the broken production batch pipeline on Railway and ship quick security wins. The cron endpoint must successfully trigger batch processing, both RSS and GNews sources must fetch articles, npm audit vulnerabilities must be addressed, and API key comparison must use constant-time comparison. No new features — stabilization only.

</domain>

<decisions>
## Implementation Decisions

### Cron auth fix approach
- Minimal fix: inject `X-API-Key` header into the constructed NextRequest in `src/app/api/cron/batch/route.ts`
- Do NOT extract shared batch function yet — that's Phase 2 scope (PIPE-04)
- Keep the existing "cron calls HTTP handler internally" pattern for now

### Production verification
- Deploy to Railway, trigger cron manually from Railway dashboard, check logs
- Both RSS feeds AND GNews API must fetch articles successfully — GNews is not optional
- Final confirmation: dashboard displays freshly scored topics with recent timestamps
- No new health check endpoints or smoke test infrastructure needed

### Vulnerability resolution
- Run `npm audit fix` to resolve minimatch and ajv vulnerabilities
- Best effort only — if transitive deps can't be auto-fixed, accept remaining warnings (dev deps only, not shipped to production)
- No package.json overrides unless npm audit fix handles it naturally

### Claude's Discretion
- Timing-safe auth implementation details (`crypto.timingSafeEqual` in `src/lib/auth.ts`)
- Exact error handling for cron endpoint edge cases
- Test strategy for the auth fix (unit test for cron-to-batch flow)
- Whether to update CI to audit all deps (currently `--omit=dev`)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/auth.ts`: `requireAdminKey()` — needs timing-safe fix, used by all write endpoints
- `src/lib/batch-pipeline.ts`: Shared helpers (fetchNews, fetchRssFeeds, classifyArticles, scoreTopic) — orchestration is duplicated but helpers are shared
- `src/app/api/cron/batch/route.ts`: Cron endpoint — root cause of 401 (lines 49-52, missing X-API-Key header)

### Established Patterns
- API key auth: `X-API-Key` header checked by `requireAdminKey()` at start of write handlers
- Cron auth: `Authorization: Bearer <CRON_SECRET>` header, separate from admin key
- Batch pipeline: 2-pass LLM (classify articles -> score topics), 15s/30s request timeouts
- Tests: Mock `@/db` module for API tests, mock `global.fetch` for component tests

### Integration Points
- Cron endpoint (`/api/cron/batch`) calls `batchPOST()` from batch route
- `ADMIN_API_KEY` env var used by auth.ts, must also be available to cron endpoint
- `CRON_SECRET` env var for Railway/Docker cron authentication
- Railway dashboard for manual cron triggering and log inspection

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard fix and security hardening approach.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-fix-secure*
*Context gathered: 2026-03-08*
