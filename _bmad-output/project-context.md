---
project_name: 'ecoticker-main'
user_name: 'Sidhartharora'
date: '2026-02-17'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 85
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Next.js 16.1.6** — App Router, `output: "standalone"` for Docker builds
- **React 19.2.3** — Server/client components, no legacy patterns
- **TypeScript ^5** — Strict mode, `bundler` resolution, `@/*` → `./src/*` path alias
- **PostgreSQL 17** — Primary DB via `pg ^8.18.0`, Drizzle connection pool
- **Drizzle ORM ^0.45.1** — Type-safe query builder (NOT raw SQL), schema in `src/db/schema.ts`
- **Tailwind CSS 4** — `@custom-variant dark` (class-based), NOT v3 `darkMode: 'class'`
- **Recharts ^3.7.0** — Sparklines and full charts (mock as divs in jsdom tests)
- **Zod ^4.3.6** — All write endpoint validation
- **Jest ^30.2.0** — Two projects: `node` (.test.ts) and `react` (.test.tsx/jsdom)
- **No migrations** — Use `drizzle-kit push` for schema changes (fresh launch)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- **Always use `@/*` path alias** for imports from `src/` — never relative paths like `../../lib/utils`
- **`@/` = `src/`** — Test files in `tests/` use `@/` to import source; source never imports from `tests/`
- **Named exports for API routes** — `export async function GET(request: NextRequest)` — always `NextRequest`, not `Request`
- **`sql<Type>` template tag** — Always type the return; use **PostgreSQL column names** (snake_case) inside sql`` tags, not Drizzle camelCase field names
- **Timestamps → ISO strings** — Convert DB `Date` objects with `.toISOString()` before JSON response
- **DB schema camelCase ↔ snake_case** — Drizzle auto-maps (e.g., `currentScore` → `current_score`), but raw SQL must use snake_case
- **Auth guard first** — `requireAdminKey(request)` check BEFORE try/catch in every write handler
- **Zod via helper** — Use `validateRequest(schema, body)` from `@/lib/validation`, never `schema.parse()` directly
- **Error handling** — Use `createErrorResponse(error, "context")` from `@/lib/errors` in catch blocks
- **Audit logging** — Every write endpoint must call `logSuccess()`/`logFailure()` from `@/lib/audit-log`
- **Type inference from Drizzle** — Use `typeof topics.$inferSelect` for row types, not manual interfaces
- **Mock `@/db` in tests** — `jest.mock('@/db', () => ({ db: mockDb }))` at module level; never import real db in tests

### Framework-Specific Rules (Next.js 16 + React 19 + Drizzle)

- **App Router only** — No `pages/` directory; routes are `src/app/api/*/route.ts` or `src/app/*/page.tsx`
- **`"use client"` required** for any component using hooks, event handlers, or browser APIs — server components are the default
- **Static pages** export `metadata` object for SEO (e.g., `scoring/page.tsx`, `data-policy/page.tsx`)
- **Layout.tsx is server** — Global providers (ThemeProvider), TickerBar, Footer, FOUC script all live here
- **Components: PascalCase files** in `src/components/` — one component per file, matching filename
- **Dark mode contract** — Every component MUST include `dark:` Tailwind variants; light theme: `bg-[#faf7f2]` (page), `bg-[#f5f0e8]` (cards), `text-stone-*`
- **Recharts in jsdom** — Must be mocked as `<div data-testid="...">` in tests (jsdom has no SVG layout)
- **useTheme() for chart colors** — Recharts doesn't support Tailwind classes; use `useTheme()` hook to pass hex values
- **No state library** — Local `useState`/`useEffect` + `fetch` + React Context only; no Redux/Zustand
- **Drizzle builder pattern** — `db.select().from(table).where(eq(...))` — never construct raw SQL strings
- **Prefer relational queries** — Use `db.query.topics.findFirst({ with: { articles: true } })` for nested data over manual joins
- **PostgreSQL only** — Use `STRING_AGG`, `BOOLEAN`, `JSONB` — never SQLite syntax (`GROUP_CONCAT`, etc.)
- **Topic upsert** — `.onConflictDoUpdate()` must rotate `previous_score = current_score` before setting new score
- **Article dedup** — `.onConflictDoNothing()` on `articles.url` unique constraint
- **FK cascade manual** — No ON DELETE CASCADE; delete children first: keywords → score_history → articles → topics
- **GET param validation** — Validate against hardcoded allowlist arrays + return 400; Zod is only for write request bodies
- **Dynamic WHERE** — Collect conditions in array, spread into `and(...conditions)`, pass `undefined` if empty
- **Cache headers** — Public GET endpoints set `Cache-Control: public, max-age=300, stale-while-revalidate=600`
- **Urgency/color helpers** — Never hardcode; use `urgencyColor()`, `changeColor()`, `scoreToUrgency()` from `@/lib/utils`
- **Scoring functions** — Use `computeOverallScore()`, `deriveUrgency()` from `@/lib/scoring` — never hardcode weights or thresholds
- **GDPR: localStorage** — ONLY for theme preference (`theme` key). No user tracking, no cookies, no analytics
- **GDPR: IP truncation** — Any new endpoint storing IPs must truncate last octet (→ `.0`) per `audit-log.ts` pattern

### Testing Rules

- **Test location** — All tests in `tests/` at project root; `.test.ts` for node, `.test.tsx` for React/jsdom
- **Two Jest projects** — `node` (testEnvironment: node) and `react` (testEnvironment: jsdom); file extension determines project
- **Mock `@/db`** — Every API/DB test: `jest.mock('@/db', () => ({ db: mockDb }))` — never connect to real PostgreSQL in CI
- **Drizzle mock chain** — Mock the FULL chain: `db.select()` → `.from()` → `.where()` → `.orderBy()` etc. Use `mockReturnValue` on intermediate methods, `mockResolvedValue` on the terminal method only
- **Mock `@/lib/audit-log`** — Every write endpoint test needs `logSuccess`/`logFailure` as `jest.fn()`
- **Mock `@/lib/auth`** — Write endpoint tests mock `requireAdminKey` returning `true` (or `false` to test 401)
- **Mock `next/link`** — Component tests: `jest.mock('next/link', ...)` returning `<a>` tag
- **Mock `recharts`** — Component tests: mock all chart components as `<div data-testid="mock-{type}">` — jsdom can't render SVG
- **Mock `global.fetch`** — Mock both `ok: true` and `json: async () => (...)` — components check `response.ok` before parsing
- **Self-contained fixtures** — Each test file defines its own mock data (e.g., `mockTopic`); no shared test utils across files
- **Test naming** — Descriptive `describe`/`it` blocks; file name matches source (e.g., `TopicCard.test.tsx` → `TopicCard.tsx`)
- **No real DB in CI** — GitHub Actions runs entirely with mocked Drizzle; local integration tests are separate
- **Tests with every PR** — Every new function/endpoint gets tests in the same commit; 243 baseline is a floor
- **Test-first for changes** — When modifying existing behavior, update tests to match new expectations first, then implement

### Code Quality & Style Rules

- **ESLint 9 + eslint-config-next** — No custom overrides; Next.js defaults enforce React hooks rules, import order, accessibility
- **No Prettier** — Follow existing style: 2-space indent, double quotes in TSX, template literals for SQL
- **File organization** — Pages in `src/app/`, components in `src/components/`, utilities in `src/lib/`, DB in `src/db/`, scripts in `scripts/`
- **One export per component file** — `TopicCard.tsx` exports `TopicCard`; no barrel files (`index.ts` re-exports)
- **Import ordering** — (1) Next.js/React, (2) `@/db` + schema, (3) `@/lib/*`, (4) Drizzle operators; destructure operators individually
- **Naming conventions:**
  - Components: PascalCase (`TopicCard.tsx`, `ScoreChart.tsx`)
  - Utilities/libs: camelCase (`utils.ts`, `audit-log.ts`)
  - API routes: kebab-case directories (`audit-logs/route.ts`)
  - DB schema: camelCase fields → snake_case columns
  - Types: PascalCase interfaces (`Topic`, `Article`, `ScoreHistoryEntry`)
  - Constants: UPPER_SNAKE_CASE (`CATEGORY_LABELS`)
- **Route-level doc comments only** — Lightweight `/** Topics API... */` block on API route files; NO JSDoc on utility functions or components
- **No comments unless non-obvious** — Code should be self-documenting; comments for "why", not "what"
- **GDPR comments** — Exception: always comment GDPR-relevant fields (e.g., `// GDPR: stored truncated`)
- **Flat handler pattern** — API routes are linear: auth → validate → query → respond; no sub-handlers or middleware wrappers inside route files
- **Error response keys** — `{ error: string }` for 400/401/404; `createErrorResponse()` for 500s; never `{ message }` or `{ msg }`
- **API response shape** — Wrap arrays in named keys (`{ topics: [...] }`), never return bare arrays
- **Display constants** — Use `CATEGORY_LABELS` from `@/lib/utils` for category names; never format slugs manually

### Development Workflow Rules

- **Branch strategy** — Active development on `v2` branch; `main` is the stable branch for PRs
- **Commit format** — `type: short description` (e.g., `feat:`, `fix:`, `docs:`, `test:`, `refactor:`)
- **Pre-commit hooks** — Auto-installed via `postinstall`; run TypeScript check + build + lint; bypass with `--no-verify` (emergency only)
- **Before every commit** — TypeScript must compile, build must succeed, no lint errors
- **Read the workflow doc first** — Before implementing any US-*, read its `docs/plans/2026-02-13-us*-workflow.md` for AC, phases, file lists, and cross-story notes
- **Schema changes** — Use `drizzle-kit push` (no migration files); schema lives in `src/db/schema.ts`
- **New DB columns** — Add to Drizzle schema, push, then update TypeScript types in `src/lib/types.ts` if the column appears in API responses
- **Update indexes after changes** — Adding new API routes, components, or DB tables? Update `PROJECT_INDEX.md` AND `CLAUDE.md`
- **Implementation order** — Phase 3 (US-2.1, US-3.1) → Phase 4 (US-5.1, US-5.2) → Phase 5 (US-4.x, US-8.x) → Phase 6 (US-6.x, US-10.x)
- **Scripts convention** — `scripts/*.ts` run via `npx tsx`; they import from `src/` using `@/` alias; not isolated from the app
- **Score history: one per day** — `score_history.recorded_at` is `date` type; batch upserts, doesn't duplicate on same-day reruns
- **Docker** — Multi-stage Dockerfile; cron container shares Dockerfile but runs crond; `docker compose up -d` for full stack
- **Railway production** — Standalone output deployed to Railway; env vars in Railway dashboard, never hardcoded URLs or localhost assumptions
- **CI** — GitHub Actions on push/PR to main: dependency audit, security lint, Dockerfile check, full test suite
- **No secrets in code** — `.env.example` for templates; real secrets in environment only; CI scans for leaked secrets

### Critical Don't-Miss Rules

**Anti-Patterns:**
- **NEVER use raw SQL strings** — Always Drizzle builder or `sql` template tag; no string concatenation for queries
- **NEVER return bare arrays** — API responses wrap data in named keys: `{ topics: [...] }`, not `[...]`
- **NEVER skip audit logging** — Every write endpoint (POST/PUT/DELETE) must log success AND failure
- **NEVER store raw IPs** — Truncate last octet before any DB write (GDPR requirement)
- **NEVER use SQLite syntax** — No `GROUP_CONCAT`, `INTEGER PRIMARY KEY` — use PostgreSQL equivalents
- **NEVER add middleware files** — Single `src/middleware.ts` only; Next.js supports one middleware; add route-level checks instead
- **NEVER set LLM temperature > 0 for scoring** — Scoring prompts use `temperature: 0` for deterministic results

**Batch Pipeline:**
- **2-pass LLM pattern** — TASK 1 filters (reject non-environmental) → TASK 2 classifies + scores; never collapse into one call
- **Request timeouts** — 15s for NewsAPI, 30s for OpenRouter; new external APIs must use `AbortController` with explicit timeout
- **Rejection logging** — Batch logs relevance rate, rejected article titles and reasons for quality monitoring

**Edge Cases:**
- **Null scores** — `previousScore` can be 0 (not null) for new topics; `change` = `currentScore - previousScore`
- **Empty sparklines** — If no score history, sparkline is `[]` — components must handle empty arrays
- **Slug uniqueness** — Topic slugs are unique; use `slugify` library consistently for generation
- **Timestamp vs Date** — `score_history.recorded_at` is `date` (daily); `audit_logs.timestamp` is `timestamp` (precise)
- **`hidden` field** — Exists in schema but NOT filtered in queries yet (US-4.2 pending); don't proactively filter it
- **Urgency vs change colors** — `urgencyColor(urgency)` = severity level color; `changeColor(change)` = direction color; these are DIFFERENT — a topic can be green urgency but red change
- **Async component rendering** — Components using `useEffect` + `fetch` need `await waitFor()` or `findByText()` in tests, never synchronous `getByText`
- **Event bus is client-only** — `src/lib/events.ts` is in-browser pub/sub only; not for SSE, WebSockets, or server-side events

**Security:**
- **Rate limits reset on restart** — In-memory rate limiter; don't rely on persistence across deployments
- **CSP `unsafe-inline`** — Required for Next.js hydration; don't try to remove it
- **Cloudflare IP header** — Use `CF-Connecting-IP` for real client IP behind Cloudflare, fallback to `x-forwarded-for`

**Performance:**
- **Sparkline subquery** — Use `STRING_AGG` in a subquery with `LIMIT 7`, not a separate query per topic
- **Connection pooling** — Drizzle manages the pg pool; never create additional `Pool` instances
- **5-minute cache** — GET endpoints cache 300s with stale-while-revalidate 600s; don't override without reason

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-17
