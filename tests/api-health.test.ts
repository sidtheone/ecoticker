/**
 * Tests for GET /api/health
 *
 * Story 7.3 — TDD phase (red): these tests are written before implementation.
 * The route at src/app/api/health/route.ts does not yet exist.
 *
 * AC coverage:
 *   AC2 — isStale: true when lastBatchAt is null or before today UTC
 *   AC3 — isStale: false when lastBatchAt equals today UTC
 *   AC4 — lastBatchAt: null when scoreHistory is empty
 *   Edge — UTC date comparison, not local timezone
 */

import { mockDb } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

// NextRequest is imported only to satisfy the type signature inherited from
// the original TDD stub. The actual GET handler takes no params but the test
// was written before the final signature was known. Passing a request is
// harmless — the handler ignores it.
import { NextRequest } from "next/server";

describe("GET /api/health", () => {
  // GET signature is () => Promise<NextResponse> — req param is unused but
  // passing it is safe; the handler simply ignores it.
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    // Dynamically import AFTER jest.mock is hoisted so the mock is in place
    const mod = await import("@/app/api/health/route");
    GET = mod.GET;
  });

  beforeEach(() => {
    mockDb.reset();
    // Fix the current UTC date for deterministic staleness tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-22T14:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // AC4: Empty database — no score history records
  test("returns lastBatchAt: null and isStale: true when scoreHistory is empty", async () => {
    mockDb.mockSelect([]);

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ lastBatchAt: null, isStale: true });
  });

  // AC4: Null result from MAX() aggregation (single row with null)
  test("treats MAX result of null as empty database", async () => {
    mockDb.mockSelect([{ lastBatchAt: null }]);

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lastBatchAt).toBeNull();
    expect(body.isStale).toBe(true);
  });

  // AC2: Data from yesterday is stale
  test("returns isStale: true when lastBatchAt is yesterday (2026-02-21)", async () => {
    mockDb.mockSelect([{ lastBatchAt: "2026-02-21" }]);

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lastBatchAt).toBe("2026-02-21");
    expect(body.isStale).toBe(true);
  });

  // AC2: Data from multiple days ago is stale
  test("returns isStale: true when lastBatchAt is 5 days ago", async () => {
    mockDb.mockSelect([{ lastBatchAt: "2026-02-17" }]);

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(body.isStale).toBe(true);
    expect(body.lastBatchAt).toBe("2026-02-17");
  });

  // AC3: Data from today is fresh
  test("returns isStale: false when lastBatchAt is today (2026-02-22)", async () => {
    mockDb.mockSelect([{ lastBatchAt: "2026-02-22" }]);

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lastBatchAt).toBe("2026-02-22");
    expect(body.isStale).toBe(false);
  });

  // AC2 edge: UTC date comparison — verify the implementation uses UTC
  test("uses UTC date for staleness comparison, not local timezone", async () => {
    // Simulated UTC time: 2026-02-22T00:30:00Z (just past midnight UTC)
    // If using local time in a UTC-5 timezone, this would appear as 2026-02-21 — wrong.
    jest.setSystemTime(new Date("2026-02-22T00:30:00Z"));

    mockDb.mockSelect([{ lastBatchAt: "2026-02-22" }]);

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    // Today in UTC is 2026-02-22 — data matches today — should be fresh
    expect(body.isStale).toBe(false);
  });

  // Response shape contract — component depends on this shape
  test("response includes exactly lastBatchAt and isStale fields", async () => {
    mockDb.mockSelect([{ lastBatchAt: "2026-02-22" }]);

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(["isStale", "lastBatchAt"]);
  });

  // Public endpoint — no auth required
  test("does not require X-API-Key header", async () => {
    mockDb.mockSelect([{ lastBatchAt: "2026-02-22" }]);

    const req = new NextRequest("http://localhost/api/health");
    // No Authorization header — should succeed
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // DB failure: should not crash the server
  test("returns 500 when database query throws", async () => {
    // Use mockRejectedValue so the entire chain rejects cleanly when awaited,
    // rather than a brittle manual `.then` override on the chain object.
    mockDb.chain.select.mockReturnValue(mockDb.chain);
    mockDb.chain.from.mockRejectedValue(new Error("DB connection failed"));

    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
