# Story 3.2: Share topic page with rich social previews (US-6.1)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **journalist or environmental advocate**,
I want **to share a topic page URL and have social media platforms show a rich preview card with topic name, score, and impact summary**,
so that **my audience can immediately understand the environmental severity before clicking through**.

## Acceptance Criteria

1. `src/app/topic/[slug]/layout.tsx` exists as a server component with `generateMetadata()` that queries the database for topic metadata
2. OG title format: `"[Topic Name] — Score: [N] ([URGENCY]) | EcoTicker"` (e.g., "Amazon Deforestation — Score: 72 (critical) | EcoTicker")
3. OG description: `impactSummary` or `scoreReasoning` from topics table, truncated to 200 characters
4. OG image: static fallback `/og-default.png` (1200×630 PNG with EcoTicker branding)
5. Twitter Card meta tags present: `twitter:card` = "summary_large_image", `twitter:title`, `twitter:description`, `twitter:images`
6. `<title>` tag includes topic name and score (same as OG title)
7. Share button on topic detail page copies current URL to clipboard via `navigator.clipboard.writeText()`
8. "Link copied!" confirmation text appears for 2 seconds, then reverts to "Share"
9. When topic is not found, metadata returns fallback: `{ title: "Topic Not Found — EcoTicker" }`
10. All existing tests continue to pass; new tests cover layout metadata and share button

## Tasks / Subtasks

- [x] Task 1: Create static OG fallback image (AC: #4)
  - [x] 1.1 Create `public/og-default.png` (1200×630) with EcoTicker branding — dark green/teal background, "EcoTicker" text, "Environmental Impact Tracker" subtitle
- [x] Task 2: Create topic layout with `generateMetadata()` (AC: #1, #2, #3, #5, #6, #9)
  - [x] 2.1 Create `src/app/topic/[slug]/layout.tsx` as server component
  - [x] 2.2 Import `db` from `@/db` and `topics` + `eq` from `@/db/schema` / `drizzle-orm`
  - [x] 2.3 Query topics table by slug, select: `name`, `currentScore`, `urgency`, `impactSummary`, `scoreReasoning`
  - [x] 2.4 Build metadata object with openGraph and twitter properties
  - [x] 2.5 Handle not-found case with fallback title
  - [x] 2.6 Layout component returns `<>{children}</>` (passthrough)
- [x] Task 3: Add share button to topic detail page (AC: #7, #8)
  - [x] 3.1 Add `copied` state + `handleShare` async handler in `page.tsx`
  - [x] 3.2 Add share button in header area (after urgency badge / category)
  - [x] 3.3 Button shows "Link copied!" for 2s then reverts via `setTimeout`
- [x] Task 4: Add `NEXT_PUBLIC_BASE_URL` to `.env.example`
- [x] Task 5: Write tests (AC: #10)
  - [x] 5.1 Test `generateMetadata` returns correct OG tags for existing topic (node env, mock `@/db`)
  - [x] 5.2 Test `generateMetadata` returns fallback for missing topic
  - [x] 5.3 Test share button renders on topic detail page
  - [x] 5.4 Test clipboard copy on share button click
  - [x] 5.5 Test "Link copied!" confirmation appears after click
- [x] Task 6: Verify build + all tests pass

## Dev Notes

### Architecture & Patterns

- **Server vs Client split:** `page.tsx` is `"use client"` — cannot export `generateMetadata()` from it. The solution is a sibling `layout.tsx` (server component) that handles metadata. This is a supported Next.js App Router pattern.
- **DB access in layout:** Direct Drizzle query in `generateMetadata()` — single-row SELECT on indexed `slug` column. Negligible overhead per request.
- **No extra API route needed:** Layout queries DB directly via `@/db`, same pattern used elsewhere in server components.

### Critical Implementation Details

- **Next.js 16 params API:** In Next.js 15+, `params` in `generateMetadata` is a **Promise** — must `await params` before accessing `slug`. Type: `params: Promise<{ slug: string }>`.
- **OG image URL:** Use relative path `/og-default.png` — Next.js resolves it against the deployment URL. For `og:url`, use `NEXT_PUBLIC_BASE_URL` env var with fallback.
- **Description truncation:** Use `.substring(0, 200)` — no need for word-boundary truncation for OG descriptions.
- **Clipboard API:** `navigator.clipboard.writeText()` is available in all modern browsers. No polyfill needed.
- **Share button placement:** Add after the urgency badge / category span in the header flex container (around line 118-122 in current `page.tsx`).

### Testing Standards

- **Layout test:** Node environment (not jsdom). Mock `@/db` module. Import `generateMetadata` directly and call with mock params.
- **Share button tests:** jsdom environment. Mock `navigator.clipboard.writeText`. Use `fireEvent.click` + `waitFor` for async clipboard call.
- **Existing pattern:** Tests mock `global.fetch`, `next/link` as `<a>`, `recharts` as divs. Follow same patterns.

### Project Structure Notes

- `src/app/topic/[slug]/layout.tsx` — NEW file, sibling to existing `page.tsx`
- `src/app/topic/[slug]/page.tsx` — MODIFY (add share button ~20 lines)
- `public/og-default.png` — NEW file (static image asset)
- `.env.example` — MODIFY (add `NEXT_PUBLIC_BASE_URL`)
- `tests/TopicDetail.test.tsx` — MODIFY (add share button tests)
- `tests/topic-layout.test.ts` — NEW file (node env, generateMetadata tests)
- No schema changes, no API changes, no new dependencies

### Key Schema Fields (from `src/db/schema.ts`)

- `topics.name` — topic display name
- `topics.slug` — URL-friendly identifier (indexed, unique)
- `topics.currentScore` — integer 0-100
- `topics.urgency` — string: "breaking" | "critical" | "moderate" | "informational"
- `topics.impactSummary` — text, nullable (primary description source)
- `topics.scoreReasoning` — text, nullable (fallback description source)

### Git Intelligence

- Recent commit `9cb7962` completed Epic 2 & Epic 3 partial (stories 3-1, 3-3 already done)
- Established patterns: `feat(ui):` prefix for UI features, Tailwind dark mode classes, `data-testid` attributes on all interactive elements
- All 258 tests passing, TypeScript clean, build passing

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story 3.2]
- [Source: docs/plans/2026-02-13-us6.1-workflow.md] — Full implementation workflow with code examples
- [Source: src/app/topic/[slug]/page.tsx] — Current topic detail page (252 lines, "use client")
- [Source: src/db/schema.ts] — Topics table schema with impactSummary, scoreReasoning fields
- [Source: CLAUDE.md#Testing] — Mock patterns for @/db, next/link, recharts

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References

### Completion Notes List
- ✅ Created `public/og-default.png` — 1200×630 dark teal gradient PNG (programmatically generated)
- ✅ Created `src/app/topic/[slug]/layout.tsx` — server component with `generateMetadata()` querying topics table via Drizzle. Returns OG + Twitter Card meta. Handles not-found fallback.
- ✅ Added share button to `page.tsx` — copies URL to clipboard via `navigator.clipboard.writeText()`, shows "Link copied!" for 2s
- ✅ Added `NEXT_PUBLIC_BASE_URL` to `.env.example`
- ✅ 8 new tests (5 layout metadata + 3 share button). All 266/266 tests passing.
- ✅ TypeScript clean, build passing, no regressions
- Implementation date: 2026-02-17

### Change Log
- 2026-02-17: Implemented all 6 tasks — OG meta, Twitter Card, share button, tests
- 2026-02-17: Code review fixes — clipboard error handling, setTimeout cleanup, Proxy-based test mock, removed unused LayoutProps interface, fixed dynamic imports in tests, updated File List with og-light/og-dark

### File List
- `src/app/topic/[slug]/layout.tsx` — NEW (server component, generateMetadata)
- `src/app/topic/[slug]/page.tsx` — MODIFIED (added share button + copied state)
- `public/og-default.png` — NEW (1200×630 OG fallback image, dark variant)
- `public/og-light.png` — NEW (1200×630 OG light mode variant)
- `public/og-dark.png` — NEW (1200×630 OG dark mode variant)
- `.env.example` — MODIFIED (added NEXT_PUBLIC_BASE_URL)
- `tests/topic-layout.test.ts` — NEW (5 tests for generateMetadata)
- `tests/TopicDetail.test.tsx` — MODIFIED (3 share button tests added)
