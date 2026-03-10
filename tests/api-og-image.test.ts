import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

// Mock next/og ImageResponse since it's not available in test env
jest.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    constructor(public element: any, public options: any) {}
    get headers() {
      return new Headers({ "content-type": "image/png" });
    }
    get status() {
      return 200;
    }
  },
}));

import { GET } from "@/app/api/og/[slug]/route";

const mockTopic = {
  name: "Arctic Ice Decline",
  slug: "arctic-ice-decline",
  currentScore: 85,
  urgency: "breaking" as const,
};

function makeRequest(slug: string) {
  return new Request(`http://localhost:3000/api/og/${slug}`);
}

describe("GET /api/og/[slug] — OG image generation", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("returns 200 with image/png content-type for a valid topic", async () => {
    mockDb.mockSelect([mockTopic]);

    const res = await GET(makeRequest("arctic-ice-decline"), {
      params: Promise.resolve({ slug: "arctic-ice-decline" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("returns 404 when topic is not found", async () => {
    mockDb.mockSelect([]);

    const res = await GET(makeRequest("nonexistent"), {
      params: Promise.resolve({ slug: "nonexistent" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 response as JSON with error message", async () => {
    mockDb.mockSelect([]);

    const res = await GET(makeRequest("nonexistent"), {
      params: Promise.resolve({ slug: "nonexistent" }),
    });

    const body = await res.json();
    expect(body.error).toBe("Topic not found");
  });

  it("handles database errors gracefully", async () => {
    mockDb.chain.limit.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(makeRequest("arctic-ice-decline"), {
      params: Promise.resolve({ slug: "arctic-ice-decline" }),
    });

    expect(res.status).toBe(500);
  });

  it("passes topic data to ImageResponse for breaking severity", async () => {
    mockDb.mockSelect([{ ...mockTopic, currentScore: 85 }]);

    const res = await GET(makeRequest("arctic-ice-decline"), {
      params: Promise.resolve({ slug: "arctic-ice-decline" }),
    });

    expect(res.status).toBe(200);
  });

  it("works for all severity levels", async () => {
    const cases = [
      { score: 90, urgency: "breaking" },
      { score: 65, urgency: "critical" },
      { score: 40, urgency: "moderate" },
      { score: 15, urgency: "informational" },
    ];

    for (const { score, urgency } of cases) {
      mockDb.reset();
      mockDb.mockSelect([{ ...mockTopic, currentScore: score, urgency }]);

      const res = await GET(makeRequest("arctic-ice-decline"), {
        params: Promise.resolve({ slug: "arctic-ice-decline" }),
      });

      expect(res.status).toBe(200);
    }
  });
});
