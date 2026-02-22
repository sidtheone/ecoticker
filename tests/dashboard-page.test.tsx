/**
 * Tests for the dashboard page (src/app/page.tsx)
 *
 * Story 7.3 — TDD phase (red): the product descriptor has not been added yet.
 *
 * IMPORTANT — Unit test scope:
 * These are unit tests, NOT RSC (React Server Component) integration tests.
 * The page component is imported and rendered directly in jsdom via
 * `render(await HomePage())`. This bypasses Next.js RSC streaming, Suspense
 * boundaries, and server context. Tests assert DOM structure only — they do
 * not validate RSC-specific behavior, streaming, or edge runtime.
 *
 * AC coverage:
 *   AC1 — Product descriptor visible on dashboard: "Environmental News Impact
 *          Tracker — AI-Scored Severity" in 14px muted caption style
 *
 * NOTE — "Above the fold" AC (AC1):
 * The test below verifies DOM order (descriptor before HeroSection), which is
 * a proxy for visual placement. True "above the fold" visibility (viewport
 * position, scroll depth) cannot be automated in jsdom and REQUIRES manual
 * verification: load the dashboard on a 1080p screen and confirm the
 * descriptor is visible without scrolling.
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock DB before importing the server component
jest.mock("@/db", () => {
  return {
    db: {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
    },
    pool: { end: jest.fn() },
  };
});

// Mock heavy child components so the server component can be rendered in jsdom
jest.mock("@/components/HeroSection", () => {
  return function MockHeroSection() {
    return <div data-testid="hero-section" />;
  };
});

jest.mock("@/components/TopicGrid", () => {
  return function MockTopicGrid() {
    return <div data-testid="topic-grid" />;
  };
});

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
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// selectHeroTopic is a pure utility — use real implementation
jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
}));

describe("Dashboard page — product descriptor (AC1)", () => {
  test("renders product descriptor text", async () => {
    const HomePage = (await import("@/app/page")).default;
    render(await HomePage());

    expect(
      screen.getByText("Environmental News Impact Tracker — AI-Scored Severity")
    ).toBeInTheDocument();
  });

  test("product descriptor is a <p> element with muted caption styling", async () => {
    const HomePage = (await import("@/app/page")).default;
    render(await HomePage());

    const descriptor = screen.getByText(
      "Environmental News Impact Tracker — AI-Scored Severity"
    );

    expect(descriptor.tagName).toBe("P");
    // Should have Tailwind muted text classes
    expect(descriptor.className).toMatch(/text-stone-500|text-gray-400|text-sm/);
  });

  test("product descriptor is rendered above HeroSection (above the fold)", async () => {
    const HomePage = (await import("@/app/page")).default;
    const { container } = render(await HomePage());

    const descriptor = container.querySelector("p");
    const heroSection = container.querySelector("[data-testid='hero-section']");

    expect(descriptor).not.toBeNull();
    expect(heroSection).not.toBeNull();

    // Descriptor must appear before HeroSection in DOM order
    const allElements = Array.from(container.querySelectorAll("*"));
    const descriptorIdx = allElements.indexOf(descriptor as Element);
    const heroIdx = allElements.indexOf(heroSection as Element);

    expect(descriptorIdx).toBeLessThan(heroIdx);
  });
});
