/**
 * @jest-environment node
 */

import { mockDb } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

describe("opengraph-image routes", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe("GET /opengraph-image (homepage)", () => {
    test("returns a PNG image response", async () => {
      const mod = await import("@/app/opengraph-image");
      const response = mod.default();

      expect(response).toBeDefined();
      expect(mod.contentType).toBe("image/png");
      expect(mod.size).toEqual({ width: 1200, height: 630 });
    });
  });

  describe("GET /topic/[slug]/opengraph-image", () => {
    test("returns a PNG image response for existing topic", async () => {
      mockDb.mockSelect([{
        name: "Oil Spill",
        currentScore: 85,
        urgency: "breaking",
        healthScore: 70,
        ecoScore: 90,
        econScore: 80,
        impactSummary: "Major oil spill affecting coastal ecosystems.",
      }]);

      const mod = await import("@/app/topic/[slug]/opengraph-image");
      const response = await mod.default({
        params: Promise.resolve({ slug: "oil-spill" }),
      });

      expect(response).toBeDefined();
      expect(mod.contentType).toBe("image/png");
      expect(mod.size).toEqual({ width: 1200, height: 630 });
    });

    test("returns fallback card when topic not found", async () => {
      mockDb.mockSelect([]);

      const mod = await import("@/app/topic/[slug]/opengraph-image");
      const response = await mod.default({
        params: Promise.resolve({ slug: "nonexistent" }),
      });

      expect(response).toBeDefined();
    });
  });
});
