# Testing Patterns

**Analysis Date:** 2026-03-08

## Test Framework

**Runner:**
- Jest 30.2.0
- Config: `jest.config.ts`
- Two projects: `node` (ts-jest, node environment) and `react` (ts-jest, jsdom environment)

**Assertion Library:**
- Jest built-in (`expect`)
- `@testing-library/jest-dom` v6.9.1 for DOM matchers (`toBeInTheDocument`, `toHaveStyle`)
- `@testing-library/react` v16.3.2 for component rendering

**Run Commands:**
```bash
npx jest                  # Run all 604 tests (37 suites)
npx jest --coverage       # With coverage (98.6% stmts)
npx jest tests/utils.test.ts  # Run single test file
```

## Test File Organization

**Location:**
- All tests in `tests/` directory at project root (NOT co-located with source)

**Naming:**
- Component tests: `{ComponentName}.test.tsx` (e.g., `tests/TopicCard.test.tsx`)
- API route tests: `api-{route-name}.test.ts` (e.g., `tests/api-topics.test.ts`)
- Utility tests: `{module}.test.ts` (e.g., `tests/utils.test.ts`)
- Script tests: `{script}.test.ts` (e.g., `tests/batch.test.ts`, `tests/seed.test.ts`)

**Structure:**
```
tests/
├── helpers/
│   └── mock-db.ts          # Shared Drizzle DB mock
├── ArticleList.test.tsx     # Component tests (.tsx)
├── TopicCard.test.tsx
├── TickerBar.test.tsx
├── ScoreChart.test.tsx
├── Sparkline.test.tsx
├── ...
├── api-topics.test.ts       # API route tests (.ts)
├── api-ticker.test.ts
├── api-movers.test.ts
├── api-batch-route.test.ts
├── ...
├── utils.test.ts            # Utility tests (.ts)
├── scoring.test.ts
├── heroScore.test.ts
└── db.test.ts
```

**Project routing (automatic):**
- `.test.ts` files run in `node` environment (Jest project: "node")
- `.test.tsx` files run in `jsdom` environment (Jest project: "react")

## Test Structure

**Suite Organization:**
```typescript
describe("ComponentName or FunctionName", () => {
  // Optional nested describe for logical grouping
  describe("sub-area", () => {
    test("specific behavior description", () => {
      // Arrange, Act, Assert (implicit, no comments needed)
    });
  });
});
```

**Patterns:**
- Use `test()` (not `it()`) for individual test cases
- Descriptive test names that read as sentences: `"renders topic name"`, `"returns empty array for no matches"`
- Group related tests with nested `describe()` blocks: `describe("Breaking (80-100)", () => { ... })`
- Boundary value testing: test exact threshold scores (29/30, 59/60, 79/80)

**Setup/Teardown:**
```typescript
// Component tests
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ items: mockData }),
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// API/DB tests
beforeEach(() => {
  mockDb.reset();
});
```

## Mocking

### Database Mocking (`tests/helpers/mock-db.ts`)

**The shared mock DB** is the central testing utility. It provides a chainable mock that mimics Drizzle's query builder.

**Setup pattern (in every API test file):**
```typescript
import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});
```

**Usage in tests:**
```typescript
// SELECT queries
mockDb.mockSelect([{ id: 1, name: "Test" }]);

// INSERT queries
mockDb.mockInsert({ id: 1 });

// UPDATE queries
mockDb.mockUpdate([{ id: 1, name: "Updated" }]);

// DELETE queries
mockDb.mockDelete([{ id: 1 }]);

// Relational queries (db.query.*)
mockDb.mockFindFirst("topics", { id: 1, name: "Test" });
mockDb.mockFindMany("topics", [{ id: 1 }, { id: 2 }]);

// Always reset in beforeEach:
mockDb.reset();
```

### next/link Mock (required in ALL component tests)

```typescript
jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return <a href={href} {...props}>{children}</a>;
  };
});
```

### Recharts Mock (required for chart component tests)

```typescript
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-count={data.length}>{children}</div>
  ),
  Line: (props: Record<string, unknown>) => (
    <div data-testid={`line-${props.dataKey}`} data-stroke={props.stroke} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="grid" />,
}));
```

### global.fetch Mock (for client components that fetch)

```typescript
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ items: mockItems }),
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

### Audit Log Mock

```typescript
jest.mock("@/lib/audit-log", () => ({
  logSuccess: jest.fn().mockResolvedValue(undefined),
  logFailure: jest.fn().mockResolvedValue(undefined),
}));
```

### External Module Mocks (e.g., rss-parser)

```typescript
// Must be set up BEFORE route.ts is imported (module-level instantiation)
import Parser from "rss-parser";
jest.mock("rss-parser");
const mockParseURL = jest.fn();
(Parser as unknown as jest.Mock).mockImplementation(() => ({
  parseURL: mockParseURL,
}));
```

**What to Mock:**
- `@/db` module (always mock in unit tests, never hit real PostgreSQL)
- `next/link` (renders as `<a>` in jsdom)
- `next/navigation` (useRouter)
- `recharts` (SVG library not compatible with jsdom)
- `global.fetch` (for client components)
- `@/lib/audit-log` (avoid DB writes in tests)
- External SDKs: `rss-parser`

**What NOT to Mock:**
- Utility functions (`@/lib/utils`, `@/lib/validation`) - test directly
- Type definitions (`@/lib/types`) - use real types
- Drizzle schema (`@/db/schema`) - import real schema for column references in mock queries
- Zod schemas - test validation directly

## Fixtures and Factories

**Factory functions for test data:**
```typescript
function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    name: "Arctic Ice Decline",
    slug: "arctic-ice-decline",
    category: "climate",
    region: "Arctic",
    currentScore: 85,
    previousScore: 79,
    change: 6,
    urgency: "breaking",
    impactSummary: "Sea ice at record lows",
    imageUrl: null,
    articleCount: 5,
    updatedAt: "2026-02-07T06:00:00Z",
    sparkline: [70, 72, 75, 78, 80, 82, 85],
    healthScore: 85,
    ecoScore: 85,
    econScore: 85,
    scoreReasoning: null,
    hidden: false,
    ...overrides,
  };
}
```

**Inline mock data arrays:**
```typescript
const mockTopicsData = [
  {
    id: 1,
    name: "Arctic Ice Decline",
    slug: "arctic-ice-decline",
    category: "climate",
    currentScore: 85,
    previousScore: 79,
    urgency: "breaking" as const,
    // ...
  },
  // ...
];
```

**Location:**
- Factory functions defined at top of each test file (not shared)
- Mock data arrays defined at top of each test file
- Shared mock DB helper: `tests/helpers/mock-db.ts`

## Coverage

**Requirements:** 98.6% statement coverage (current state, not enforced threshold)

**View Coverage:**
```bash
npx jest --coverage
```

## Test Types

**Unit Tests (majority):**
- Utility function tests: test pure functions with various inputs including edge cases
- Component rendering tests: verify DOM output, styles, conditional rendering
- API query logic tests: verify DB query construction through mocked Drizzle

**Component Tests (jsdom):**
- Render with `@testing-library/react`
- Assert with `screen.getByText()`, `screen.getByTestId()`, `screen.queryByTestId()`
- Test inline styles: `expect(el).toHaveStyle({ color: "#dc2626" })`
- Test async data loading: `await waitFor(() => { ... })`

**Integration Tests:**
- Batch pipeline integration: `tests/batch-rss-integration.test.ts`
- Uses mocked external services but tests full pipeline flow

**E2E Tests:**
- Not used (no Playwright/Cypress)

## Common Patterns

**Async Component Testing:**
```typescript
test("renders items after fetch", async () => {
  render(<TickerBar />);
  await waitFor(() => {
    expect(screen.getAllByText("ARCT-DEC").length).toBeGreaterThan(0);
  });
});
```

**Testing Server Components (async):**
```typescript
// Server components must be awaited before rendering
test("renders descriptor", async () => {
  render(await HomePage());
  expect(screen.getByText("Environmental News Impact Tracker")).toBeInTheDocument();
});
```

**Empty/Null Rendering:**
```typescript
test("renders nothing when fetch returns empty", async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    json: () => Promise.resolve({ items: [] }),
  });
  const { container } = render(<TickerBar />);
  await waitFor(() => {
    expect(container.innerHTML).toBe("");
  });
});
```

**Style/Color Testing:**
```typescript
test("breaking score has red color", () => {
  render(<TopicCard topic={makeTopic({ currentScore: 85 })} />);
  const score = screen.getByTestId("score");
  // jsdom normalizes hex to rgb
  expect((score as HTMLElement).style.color).toBe("rgb(220, 38, 38)");
});
```

**Boundary Value Testing:**
```typescript
test("score 29 is informational, 30 is moderate", () => {
  expect(severityColor(29).text).toBe("Informational");
  expect(severityColor(30).text).toBe("Moderate");
});
```

**Date/Time Mocking:**
```typescript
const BASE_NOW = new Date("2026-02-22T12:00:00Z").getTime();

beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(BASE_NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

**Environment Variable Setup (before module import):**
```typescript
// MUST be set before importing the module under test
process.env.GNEWS_API_KEY = "test-gnews-key";
process.env.OPENROUTER_API_KEY = "test-openrouter-key";
process.env.ADMIN_API_KEY = "test-admin-key";
```

**Test Documentation:**
- Test files include header comments explaining scope and limitations
- Note when jsdom cannot test certain behaviors (e.g., viewport position, RSC streaming)
- Reference acceptance criteria: `// AC1: Left border colored by severity`

## Adding New Tests

**New component test:**
1. Create `tests/{ComponentName}.test.tsx`
2. Add `jest.mock("next/link", ...)` if component uses `<Link>`
3. Mock `recharts` if component uses charts
4. Create factory function with sensible defaults
5. Use `data-testid` attributes for element selection

**New API route test:**
1. Create `tests/api-{route}.test.ts`
2. Import and setup mock DB:
   ```typescript
   import { mockDb, mockDbInstance } from "./helpers/mock-db";
   jest.mock("@/db", () => { ... });
   ```
3. Mock `@/lib/audit-log` if route uses audit logging
4. Set environment variables before importing the route module
5. Call route handler directly: `const response = await GET(request)`

**New utility test:**
1. Create `tests/{module}.test.ts`
2. Import functions directly (no mocking needed for pure functions)
3. Include boundary values and edge cases
4. Group related tests with nested `describe()` blocks

---

*Testing analysis: 2026-03-08*
