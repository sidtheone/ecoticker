# What TDD Shaped in EcoTicker

## The Core Insight

685 tests weren't the point. The design decisions they forced were. Without TDD, EcoTicker would work and look the same to a user — but it would be a fragile system held together by manual testing and fear of changing things.

---

## What TDD Forced

### 1. A Testable Batch Pipeline (Instead of Spaghetti)

TDD forced three design rules on the 1,312-line `batch-pipeline.ts`:
- **No `@/db` import** — DB handle injected as parameter
- **No module-level env var captures** — getter functions so tests can override `process.env`
- **RSS parser as injectable singleton**

Without these, the pipeline would directly import the DB, read env vars at module scope, and only be testable by spinning up real Postgres + mocking `fetch` globally. Tests would be fragile, and you'd stop writing them after the third one broke from import side effects.

Ghost scoring prevention (skipping topics where all URLs are duplicates) came from a test asking "what happens when everything is a dupe?" — a scenario that later caused inflated article counts in production and required a data repair script.

### 2. Score Validation and Drift Detection

Level-range clamping (MINIMAL: 0-25, MODERATE: 26-50, etc.) exists because tests asked "what if the LLM says MINIMAL but returns score 90?" before `validateScore()` was written. The >30% clamp rate warning for model drift was a direct consequence.

Without TDD, LLM output would be trusted directly. Model updates or prompt tweaks would silently produce nonsensical results with no guardrails.

### 3. Consistent API Contracts

Tests checking the error response shape revealed that `/api/ticker` and `/api/movers` don't use `createErrorResponse` (they use inline `console.error` instead). The inconsistency is documented because tests defined the contract first.

Without TDD, every route would have its own ad-hoc error shape — some returning `{ error }`, others `{ message }`, some leaking stack traces in production.

### 4. Intentional Server/Client Component Split

Tests for SSR compatibility ("renders without client hooks") forced conscious decisions about which components are server vs client. `SeverityGauge` and `TopicList` became server components because the tests demanded they work without client-side hooks.

Without TDD, everything would likely be `"use client"`. The homepage would fetch `/api/topics` client-side instead of querying the DB directly in the RSC — meaning a loading spinner on every page load instead of instant server-rendered content.

### 5. Security Verification

`auth.test.ts` reads the source code with `fs.readFileSync` to verify `crypto.timingSafeEqual` is used and `===` isn't. Source-type-default tests scan the entire `src/` directory to confirm no file contains `"newsapi"` (a deprecated value).

Without TDD, API key comparison would likely use `===` (timing attack vulnerable), and the sourceType migration would have left stale references.

### 6. 685 Tests Instead of ~50

Without TDD, tests would be written reactively — after things broke in production. Coverage would sit around 40-50%, concentrated on whatever caught fire most recently.

---

## What Would Be The Same Without TDD

- **Schema** — tables are driven by product requirements
- **Tech stack** — Next.js, Drizzle, Recharts, Docker
- **UI design** — colors, gauges, ticker concept
- **Deployment** — Railway, GitHub Actions cron

---

## Bottom Line

TDD didn't make the project write more code. It made the project write **testable** code — and testable code happens to be well-structured code with clear boundaries, injectable dependencies, and explicit contracts. The 685 tests are a side effect. The architecture is the outcome.

Without TDD, the batch pipeline would be the scariest file in the codebase — the one nobody wants to touch. Every OpenRouter model change would be a deploy-and-pray situation. The project would look identical on the surface but be fundamentally more brittle underneath.
