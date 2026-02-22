/**
 * Tests for StaleDataWarning component
 *
 * Story 7.3 — TDD phase (red): these tests are written before implementation.
 * The component at src/components/StaleDataWarning.tsx does not yet exist.
 *
 * AC coverage:
 *   AC1 — Product descriptor visible on dashboard (via page.tsx render test)
 *   AC2 — Amber warning banner shown when isStale: true
 *   AC3 — Nothing rendered when isStale: false (fresh data)
 *   AC4 — Empty state message shown when lastBatchAt: null
 *   Edge — Fail-silent: renders nothing when /api/health fetch fails
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StaleDataWarning from "@/components/StaleDataWarning";

// Mock the dashboard page for the product descriptor test
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

// Mock HeroSection and other heavy components used in page.tsx
jest.mock("@/components/HeroSection", () => {
  return function MockHeroSection() {
    return <div data-testid="hero-section" />;
  };
});

jest.mock("@/components/BiggestMovers", () => {
  return function MockBiggestMovers() {
    return <div data-testid="biggest-movers" />;
  };
});

jest.mock("@/components/TopicGrid", () => {
  return function MockTopicGrid() {
    return <div data-testid="topic-grid" />;
  };
});

// /api/health mock shape: { lastBatchAt: string | null, isStale: boolean }
function mockHealthResponse(payload: {
  lastBatchAt: string | null;
  isStale: boolean;
}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  }) as jest.Mock;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("StaleDataWarning — stale state (AC2)", () => {
  test("renders amber warning banner when isStale is true", async () => {
    mockHealthResponse({ lastBatchAt: "2026-02-21", isStale: true });

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(screen.getByTestId("stale-data-warning")).toBeInTheDocument();
    });
  });

  test("warning banner contains expected text content", async () => {
    mockHealthResponse({ lastBatchAt: "2026-02-21", isStale: true });

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(screen.getByTestId("stale-data-warning")).toBeInTheDocument();
    });

    const banner = screen.getByTestId("stale-data-warning");
    expect(banner.textContent).toMatch(/data may be outdated/i);
    expect(banner.textContent).toMatch(/next batch at 6 am utc/i);
  });

  test("warning banner includes exact relative time string", async () => {
    mockHealthResponse({ lastBatchAt: "2026-02-21", isStale: true });

    // Fix time so formatRelativeDate is deterministic: today = 2026-02-22
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-22T12:00:00Z"));

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(screen.getByTestId("stale-data-warning")).toBeInTheDocument();
    });

    jest.useRealTimers();

    // "2026-02-21" is 1 day before "2026-02-22" — should render "yesterday"
    const banner = screen.getByTestId("stale-data-warning");
    expect(banner.textContent).toMatch(/last updated yesterday/i);
  });

  test("warning banner shows 'X days ago' for older dates", async () => {
    mockHealthResponse({ lastBatchAt: "2026-02-17", isStale: true });

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-22T12:00:00Z"));

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(screen.getByTestId("stale-data-warning")).toBeInTheDocument();
    });

    jest.useRealTimers();

    // "2026-02-17" is 5 days before "2026-02-22"
    const banner = screen.getByTestId("stale-data-warning");
    expect(banner.textContent).toMatch(/last updated 5 days ago/i);
  });

  test("warning banner is not dismissible (no close button)", async () => {
    mockHealthResponse({ lastBatchAt: "2026-02-21", isStale: true });

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(screen.getByTestId("stale-data-warning")).toBeInTheDocument();
    });

    // No dismiss/close button should be present
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("StaleDataWarning — fresh state (AC3)", () => {
  test("renders nothing when isStale is false", async () => {
    mockHealthResponse({ lastBatchAt: "2026-02-22", isStale: false });

    const { container } = render(<StaleDataWarning />);

    await waitFor(() => {
      // Wait for the fetch to complete (loading state resolves)
      expect(global.fetch).toHaveBeenCalledWith("/api/health");
    });

    // Give state update time to render
    await waitFor(() => {
      expect(
        container.querySelector("[data-testid='stale-data-warning']")
      ).not.toBeInTheDocument();
      expect(
        container.querySelector("[data-testid='empty-db-state']")
      ).not.toBeInTheDocument();
    });
  });
});

describe("StaleDataWarning — empty DB state (AC4)", () => {
  test("renders empty state message when lastBatchAt is null", async () => {
    mockHealthResponse({ lastBatchAt: null, isStale: true });

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-db-state")).toBeInTheDocument();
    });
  });

  test("empty state message has calm, timeline-based tone", async () => {
    mockHealthResponse({ lastBatchAt: null, isStale: true });

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-db-state")).toBeInTheDocument();
    });

    const msg = screen.getByTestId("empty-db-state");
    expect(msg.textContent).toMatch(/we're monitoring the environment/i);
    expect(msg.textContent).toMatch(/6 am utc/i);
    // Should NOT say "error" or "failed"
    expect(msg.textContent).not.toMatch(/error/i);
    expect(msg.textContent).not.toMatch(/fail/i);
  });
});

describe("StaleDataWarning — error/fail-silent (AC edge case)", () => {
  test("renders nothing when /api/health fetch throws (fail-silent)", async () => {
    global.fetch = jest.fn().mockRejectedValue(
      new Error("Network error")
    ) as jest.Mock;

    const { container } = render(<StaleDataWarning />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/health");
    });

    // Wait for error state to settle
    await waitFor(() => {
      expect(
        container.querySelector("[data-testid='stale-data-warning']")
      ).not.toBeInTheDocument();
      expect(
        container.querySelector("[data-testid='empty-db-state']")
      ).not.toBeInTheDocument();
    });
  });

  test("renders nothing when /api/health returns non-ok response (fail-silent)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal Server Error" }),
    }) as jest.Mock;

    const { container } = render(<StaleDataWarning />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/health");
    });

    await waitFor(() => {
      expect(
        container.querySelector("[data-testid='stale-data-warning']")
      ).not.toBeInTheDocument();
    });
  });
});

describe("StaleDataWarning — loading state", () => {
  test("renders nothing during initial load (no flash of stale banner)", () => {
    // Fetch never resolves — simulates in-flight request
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as jest.Mock;

    const { container } = render(<StaleDataWarning />);

    // Immediately after render, before fetch resolves, nothing should show
    expect(
      container.querySelector("[data-testid='stale-data-warning']")
    ).not.toBeInTheDocument();
    expect(
      container.querySelector("[data-testid='empty-db-state']")
    ).not.toBeInTheDocument();
  });
});

describe("StaleDataWarning — fetch endpoint", () => {
  test("fetches /api/health on mount", async () => {
    mockHealthResponse({ lastBatchAt: "2026-02-22", isStale: false });

    render(<StaleDataWarning />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/health");
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
