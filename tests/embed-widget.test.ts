/**
 * Tests for the embed widget route handler (src/app/embed/[slug]/route.ts)
 *
 * TDD — tests written first for new embed widget feature.
 *
 * Coverage:
 *   - Returns HTML with topic data (name, score, urgency, gauge)
 *   - Returns 404 for missing topics
 *   - Supports theme=dark query param
 *   - Shows "Powered by EcoTicker" link
 *   - Sets iframe-friendly headers (X-Frame-Options, CSP frame-ancestors)
 */

import { mockDb, mockDbInstance } from "./helpers/mock-db";

jest.mock("@/db", () => {
  const { mockDbInstance } = jest.requireActual("./helpers/mock-db");
  return {
    db: mockDbInstance,
    pool: { end: jest.fn() },
  };
});

import { GET } from "@/app/embed/[slug]/route";

const mockTopic = {
  name: "Arctic Ice Decline",
  slug: "arctic-ice-decline",
  currentScore: 85,
  urgency: "breaking",
};

function makeRequest(slug: string, searchParams: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000/embed/${slug}`);
  Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  const request = new Request(url.toString());
  return GET(request, { params: Promise.resolve({ slug }) });
}

describe("Embed Widget Route", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("returns 404 when topic does not exist", async () => {
    mockDb.mockSelect([]);

    const response = await makeRequest("nonexistent");
    expect(response.status).toBe(404);
  });

  it("returns HTML content type", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline");
    expect(response.headers.get("Content-Type")).toContain("text/html");
  });

  it("renders topic name and score in HTML", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline");
    const html = await response.text();

    expect(html).toContain("Arctic Ice Decline");
    expect(html).toContain("85");
  });

  it("renders urgency badge", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline");
    const html = await response.text();

    expect(html).toContain("BREAKING");
  });

  it("renders severity gauge bar", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline");
    const html = await response.text();

    expect(html).toContain('width: 85%');
  });

  it("renders Powered by EcoTicker link", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline");
    const html = await response.text();

    expect(html).toContain("Powered by EcoTicker");
    expect(html).toContain("https://ecoticker.sidsinsights.com");
  });

  it("sets iframe-friendly headers", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline");

    expect(response.headers.get("X-Frame-Options")).toBe("ALLOWALL");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors *");
  });

  it("applies dark theme styles when theme=dark", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline", { theme: "dark" });
    const html = await response.text();

    expect(html).toContain("background: #1a1a2e");
    expect(html).toContain("color: #e0e0e0");
  });

  it("applies light theme styles by default", async () => {
    mockDb.mockSelect([mockTopic]);

    const response = await makeRequest("arctic-ice-decline");
    const html = await response.text();

    expect(html).toContain("background: #faf7f2");
    expect(html).toContain("color: #1c1917");
  });

  it("escapes HTML in topic name", async () => {
    mockDb.mockSelect([{ ...mockTopic, name: '<script>alert("xss")</script>' }]);

    const response = await makeRequest("arctic-ice-decline");
    const html = await response.text();

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
