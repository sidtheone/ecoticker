# Coding Conventions

**Analysis Date:** 2026-03-08

## Naming Patterns

**Files:**
- Components: PascalCase `.tsx` (e.g., `src/components/TopicCard.tsx`, `src/components/UrgencyBadge.tsx`)
- Library modules: camelCase `.ts` (e.g., `src/lib/utils.ts`, `src/lib/rate-limit.ts`, `src/lib/audit-log.ts`)
- API routes: `route.ts` inside kebab-case directory (e.g., `src/app/api/audit-logs/route.ts`)
- Test files: match source name with `.test.ts` or `.test.tsx` suffix (e.g., `tests/TopicCard.test.tsx`, `tests/api-topics.test.ts`)
- Scripts: camelCase `.ts` (e.g., `scripts/seed.ts`, `scripts/batch.ts`)
- DB files: camelCase `.ts` (e.g., `src/db/schema.ts`, `src/db/index.ts`)

**Functions:**
- Use camelCase for all functions: `severityColor()`, `computeHeadline()`, `scoreToUrgency()`
- Component functions: PascalCase default exports: `export default function TopicCard()`
- Helper/utility functions: camelCase named exports: `export function truncateToWord()`
- Auth helpers: camelCase verb-noun pattern: `requireAdminKey()`, `getUnauthorizedResponse()`
- Audit logging: camelCase verb pattern: `logSuccess()`, `logFailure()`, `logAuditEvent()`

**Variables:**
- camelCase throughout: `heroTopic`, `mockTopicsData`, `deletedCount`
- Constants: UPPER_SNAKE_CASE for lookup objects: `CATEGORY_LABELS`
- Pre-configured instances: camelCase: `readLimiter`, `writeLimiter`, `batchLimiter`
- Environment variables: UPPER_SNAKE_CASE: `ADMIN_API_KEY`, `DATABASE_URL`, `GNEWS_API_KEY`

**Types:**
- PascalCase for interfaces and type aliases: `Topic`, `Article`, `Urgency`, `SeverityColors`
- Union types for constrained strings: `type Urgency = "breaking" | "critical" | "moderate" | "informational"`
- Drizzle schema infers row types: `typeof topics.$inferSelect` (preferred over manual row type definitions)
- DB schema column names: snake_case strings mapped to camelCase properties: `currentScore: integer("current_score")`

## Code Style

**Formatting:**
- No Prettier config detected; relies on editor defaults and ESLint
- Double quotes for strings in source files (consistent throughout)
- Semicolons: used consistently
- Trailing commas: used in multi-line arrays and objects
- Indentation: 2 spaces

**Linting:**
- ESLint v9 flat config at `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- No custom rules beyond Next.js defaults
- Run via `npm run lint`

**TypeScript:**
- Strict mode enabled in `tsconfig.json`
- Path alias `@/*` maps to `./src/*`
- Target: ES2017, Module: esnext, Module Resolution: bundler
- `noEmit: true` (Next.js handles compilation)

## Import Organization

**Order:**
1. Framework/library imports (`next/server`, `react`, `drizzle-orm`)
2. Internal absolute imports using `@/` alias (`@/db`, `@/lib/types`, `@/components/Sparkline`)
3. Relative imports (rare, used only in `src/db/schema.ts` for self-references)

**Path Aliases:**
- `@/*` -> `./src/*` (configured in both `tsconfig.json` and `jest.config.ts`)

**Import style:**
- Named imports for utilities: `import { severityColor, truncateToWord } from "@/lib/utils"`
- Type imports use `import type`: `import type { Topic } from "@/lib/types"`
- Default imports for components: `import Sparkline from "./Sparkline"`
- Wildcard import for DB schema: `import * as schema from "./schema"` (in `src/db/index.ts`)

## API Route Patterns

**Response format:**
- Always return `NextResponse.json()` with camelCase keys
- Wrap collections in named object: `{ topics: [...] }`, `{ items: [...] }`, `{ movers: [...] }`
- Success responses include descriptive fields: `{ success: true, deleted: N, message: "..." }`
- Error responses use `{ error: "message" }` with appropriate HTTP status
- Use `createErrorResponse()` from `src/lib/errors.ts` for 500 errors (sanitizes in production)

**Caching:**
- GET endpoints set `Cache-Control: public, max-age=300, stale-while-revalidate=600`

**Authentication pattern:**
```typescript
// At start of every write handler (POST/PUT/DELETE):
if (!requireAdminKey(request)) {
  return getUnauthorizedResponse();
}
```

**Validation pattern:**
```typescript
const validation = validateRequest(topicDeleteSchema, body);
if (!validation.success) {
  return NextResponse.json(
    { error: "Validation failed", details: validation.error },
    { status: 400 }
  );
}
```

**Audit logging pattern:**
```typescript
// On success:
await logSuccess(request, "action_name", { key: value });

// On failure (in catch block):
await logFailure(request, "action_name", error instanceof Error ? error.message : "Unknown error");
```

**Query parameter validation:**
- Validate against allowed enum arrays inline
- Return 400 with `{ error: "Invalid X value" }` for invalid params

## Database Patterns

**Schema definitions** (`src/db/schema.ts`):
- Use `pgTable()` with snake_case column strings, camelCase property names
- Define indexes in table callback: `(table) => [index("idx_name").on(table.column)]`
- Define relations separately with `relations()`
- Comments indicate GDPR compliance, user stories (US-X.X)

**Query patterns:**
- Use Drizzle query builder: `db.select().from(table).where(condition).orderBy(column)`
- Computed columns via `sql` template: `sql<number>\`${topics.currentScore} - ${topics.previousScore}\``
- Conflict handling: `.onConflictDoUpdate()` for upserts, `.onConflictDoNothing()` for dedup
- FK-ordered deletion: delete child records before parent (keywords -> scores -> articles -> topics)

**DB to API mapping:**
- DB rows use snake_case columns, API responses use camelCase
- Timestamps: `row.updatedAt?.toISOString()` for API response
- Nullable fields: use nullish coalescing `??` for defaults: `r.currentScore ?? 0`

## Error Handling

**API routes:**
```typescript
try {
  // ... business logic
} catch (error) {
  // Option A: Simple console.error + JSON response (simpler routes)
  console.error("Error fetching X:", error);
  return NextResponse.json({ error: "Failed to fetch X" }, { status: 500 });

  // Option B: createErrorResponse (routes with audit logging)
  await logFailure(request, "action", error instanceof Error ? error.message : "Unknown error");
  return createErrorResponse(error, "Failed to do X");
}
```

**Error sanitization** (`src/lib/errors.ts`):
- Production: returns generic message + requestId + timestamp
- Development: includes `error.message` in `details` field
- Always logs full error server-side via `console.error()`

**Client-side:**
- Silent failures for non-critical features: `catch { /* ticker is non-critical */ }`
- Graceful fallback: render default UI when data unavailable (e.g., null heroTopic)

**Audit logging errors:**
- Audit log writes are wrapped in try/catch internally
- Audit failures never break the main operation (logged to console only)

## Logging

**Framework:** `console` (console.error, console.log)

**Patterns:**
- Server errors: `console.error("Context message:", error)` with descriptive prefix
- Audit system: `console.error("Failed to write audit log:", error)`
- No structured logging library; console output only

## Comments

**When to Comment:**
- JSDoc blocks on all exported functions in library modules (`src/lib/auth.ts`, `src/lib/errors.ts`, `src/lib/rate-limit.ts`)
- User story references: `// US-1.1: sub-scores` (inline in schema and types)
- Section dividers in schema: `// --- Topics ---` style comment blocks
- GDPR compliance notes on PII-containing fields
- Boundary/edge case explanations in utility functions

**JSDoc style:**
```typescript
/**
 * Brief description of purpose
 *
 * @param name - Description
 * @returns Description
 */
```

**Inline comments:**
- Explain "why" not "what": `// Don't let audit logging failures break the main operation`
- Note MVPs/limitations: `// NOTE: No months/years formatting -- MVP-acceptable`
- Flag future work: `// Flag for rename in follow-up cleanup story`

## Component Design

**Server Components** (default in App Router):
- Async function components: `export default async function Home()`
- Direct DB queries inside the component
- Use `export const dynamic = "force-dynamic"` for pages that query DB

**Client Components:**
- Mark with `"use client"` directive at top of file
- Use `useState` + `useEffect` for data fetching from API routes
- Event cleanup in useEffect return function
- Props typed inline: `{ topic }: { topic: Topic }`

**Component props:**
- Destructured in function signature: `function TopicCard({ topic }: { topic: Topic })`
- Use `data-testid` attributes on key elements for testing
- Use ARIA attributes for accessibility: `role="region"`, `aria-label="..."`, `aria-hidden`

**Styling:**
- Tailwind CSS 4 utility classes inline
- Dynamic styles via `style={{ }}` for severity-based colors (cannot use Tailwind for dynamic hex values)
- Dark mode: class-based with `dark:` prefix variants
- Color theme: warm cream/beige light (`bg-[#f5f0e8]`), dark purple-gray (`dark:bg-[#24243a]`)
- Custom CSS class for animations: `ticker-scroll` (defined in global CSS)

## Module Design

**Exports:**
- Components: single default export per file
- Library modules: named exports for functions and constants
- DB: named exports for `db` and `pool` from `src/db/index.ts`
- Schema: named exports for all tables and relations from `src/db/schema.ts`

**Barrel Files:**
- Not used. Import directly from specific module files.

**Module boundaries:**
- `src/lib/` modules are pure utilities (no DB imports except `audit-log.ts`)
- `src/db/` contains only connection setup and schema
- `src/app/api/` routes import from both `@/db` and `@/lib`
- Components import from `@/lib` and other `@/components` (never from `@/db` directly)

---

*Convention analysis: 2026-03-08*
