# 7. Patterns & Conventions

## Data Conventions

| Pattern | Details |
|---|---|
| **snake→camelCase** | DB columns use snake_case, API responses use camelCase. Translation happens in route handlers. |
| **Score thresholds** | breaking ≥80, critical ≥60, moderate ≥30, informational <30 |
| **Color semantics** | Red = breaking/worsening, orange = critical, yellow = moderate, green = informational/improving |
| **Severity levels** | MINIMAL (0-25), MODERATE (26-50), SIGNIFICANT (51-75), SEVERE (76-100), INSUFFICIENT_DATA (-1) |
| **Dimension weights** | Ecological 40%, Health 35%, Economic 25% |

## Database Patterns

| Pattern | Details |
|---|---|
| **Topic upsert** | `ON CONFLICT (slug) DO UPDATE` with `previousScore = currentScore` rotation |
| **Article dedup** | `ON CONFLICT (url) DO NOTHING` — UNIQUE constraint on `articles.url` |
| **Score history** | One row per topic per day — UNIQUE on `(topic_id, recorded_at)` |
| **Ghost scoring prevention** | Pre-check all URLs before scoring — skip topic entirely if 100% duplicates |
| **Denormalized counter** | `topics.article_count` maintained on insert/delete |
| **GDPR** | IP truncation (last octet zeroed), 90-day audit log purge |

## API Patterns

| Pattern | Details |
|---|---|
| **Auth** | Public reads (GET), authenticated writes (POST/PUT/DELETE) via X-API-Key |
| **Timing-safe comparison** | `crypto.timingSafeEqual` for API key validation |
| **Rate limiting** | Fixed-window, in-memory: 100/min read, 10/min write, 2/hr batch |
| **Error sanitization** | Production: requestId only. Development: full error.message |
| **Audit logging** | All write operations logged. Failures swallowed silently. |
| **Cache-Control** | `public, max-age=300, stale-while-revalidate=600` on read endpoints |
| **Input validation** | Zod schemas on write endpoints only. Enum validation on GET query params. |

## LLM Integration Patterns

| Pattern | Details |
|---|---|
| **2-pass pipeline** | Pass 1: classify articles → topics. Pass 2: score each topic. |
| **Temperature 0** | Greedy decoding for reproducibility |
| **JSON mode** | Scoring uses `response_format: json_object`. Classification uses plain text + regex extraction. |
| **Score validation** | Level-range clamping. >30% clamp rate = model drift warning. |
| **Anomaly detection** | |delta| > 25 points per dimension = flagged |
| **Few-shot calibration** | 4 examples in scoring prompt (one per severity level) |
| **Fallback** | Bad JSON → all-MODERATE/50 scores. Bad classification → "Environmental News" group. |

## UI Patterns

| Pattern | Details |
|---|---|
| **Server vs client split** | Homepage = RSC (direct DB queries). Detail page = client (API fetch). |
| **Event bus refresh** | `window.CustomEvent` broadcast from RefreshButton, subscribed by all client data-fetching components. |
| **Anti-FOUC** | Synchronous inline script reads localStorage + sets `.dark` class before React hydration. ThemeProvider `useEffect` syncs React state. |
| **Class-based dark mode** | `@custom-variant dark (&:where(.dark, .dark *))` — no media query |
| **Severity colors** | Computed by `severityColor()` in utils.ts, applied as inline styles. No Tailwind color tokens for severity. |
| **Opacity patterns** | Badge backgrounds: hex + `1a` (10%). Badge borders: hex + `33` (20%). |
| **Gauge variants** | Hero: 10px gradient + marker needle. Compact: 4px solid fill. |
| **Scroll loop** | Items doubled, CSS animation `translateX(0→-50%)`, hover pauses |

## Testing Patterns

| Pattern | Details |
|---|---|
| **Mock next/link** | `<a href={href}>` stub |
| **Mock recharts** | `<div>` stubs with data-testid + data-attributes |
| **Mock @/db** | Chainable Proxy-based mock with thenable pattern |
| **Mock global.fetch** | `jest.fn().mockResolvedValue()` per test |
| **Two Jest projects** | .test.ts → node, .test.tsx → jsdom |
| **Source code audit tests** | `fs.readFileSync` to verify no regressions (e.g., no "newsapi") |
| **Factory functions** | `makeTopic()` defined per test file (not shared) |

## Code Organization

| Pattern | Details |
|---|---|
| **Batch pipeline isolation** | No `@/db` import, no module-level env vars, DB injected as parameter |
| **Pure functions in utils/scoring** | No side effects, fully testable without mocks |
| **Drizzle relations** | Defined in schema.ts alongside tables for relational queries |
| **Script isolation** | `scripts/batch.ts` and `scripts/seed.ts` create own Pool/drizzle instances |
| **Config-free pipeline** | Env vars read via getter functions for test overridability |

## Security Patterns

| Pattern | Details |
|---|---|
| **SQL injection protection** | Parameterized queries via Drizzle. No string concatenation. |
| **CSP** | Content-Security-Policy with unsafe-inline for hydration |
| **CORS** | Not explicitly configured (Next.js defaults) |
| **Non-root Docker** | `USER nextjs` (uid 1001) with su-exec entrypoint |
| **CI security scanning** | Hardcoded secrets, eval(), SQL injection patterns, committed .env files |
| **Dependency audit** | `npm audit --omit=dev` in CI |
