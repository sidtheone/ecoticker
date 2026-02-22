/**
 * Story 7-5: Topic detail page editorial layout — TDD tests
 *
 * These tests assert the NEW editorial layout and will fail (red phase) until
 * the implementation in src/app/topic/[slug]/page.tsx is restructured.
 *
 * AC coverage:
 *   AC1 — Editorial rhythm layout order
 *   AC2 — Mobile above-the-fold (topic name line-clamp-2)
 *   AC3 — Social share arrival severity glance (hero hero hero)
 *   AC4 — Dimension sub-scores use mini SeverityGauge (compact)
 *   AC5 — Source citations with prominent publication dates
 *   AC6 — Graceful empty/null states
 *   AC7 — Accessibility landmarks (semantic headings)
 */

import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import TopicDetailPage from "@/app/topic/[slug]/page";

// ──────────────────────────────────────────────────────────────────────────────
// Module mocks — mirror patterns from TopicDetail.test.tsx
// ──────────────────────────────────────────────────────────────────────────────

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

jest.mock("next/navigation", () => ({
  useParams: () => ({ slug: "arctic-ice-decline" }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}));

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const mockScoreEntry = (overrides = {}) => ({
  score: 85,
  healthScore: 70,
  ecoScore: 80,
  econScore: 75,
  impactSummary: null,
  date: "2026-02-07T00:00:00Z",
  healthLevel: "SIGNIFICANT",
  ecoLevel: "SEVERE",
  econLevel: "SIGNIFICANT",
  healthReasoning: "Air quality degradation affecting Arctic communities.",
  ecoReasoning: "Unprecedented ice loss disrupting polar ecosystems.",
  econReasoning: "Shipping route changes and fishing industry impacts.",
  overallSummary:
    "Arctic ice decline accelerating with cascading effects across all dimensions.",
  anomalyDetected: false,
  ...overrides,
});

const mockData = {
  topic: {
    id: 1,
    name: "Arctic Ice Decline",
    slug: "arctic-ice-decline",
    category: "climate",
    region: "Arctic",
    currentScore: 85,
    previousScore: 79,
    change: 6,
    urgency: "breaking",
    impactSummary: "Sea ice at record lows" as string | null,
    imageUrl: null,
    articleCount: 2,
    updatedAt: "2026-02-07T08:00:00Z",
    healthScore: 85,
    ecoScore: 85,
    econScore: 85,
    scoreReasoning: null,
    hidden: false,
  },
  articles: [
    {
      id: 1,
      topicId: 1,
      title: "Ice caps shrinking",
      url: "https://example.com/1",
      source: "Reuters",
      summary: "Fast decline",
      imageUrl: null,
      publishedAt: "2026-02-05T10:00:00Z",
      sourceType: "news",
    },
    {
      id: 2,
      topicId: 1,
      title: "Polar expeditions cancelled",
      url: "https://example.com/2",
      source: "BBC",
      summary: "Ice too thin",
      imageUrl: null,
      publishedAt: null, // null date — AC5 edge case
      sourceType: "gnews",
    },
  ],
  scoreHistory: [
    mockScoreEntry({
      score: 75,
      date: "2026-02-01T00:00:00Z",
      overallSummary: null,
    }),
    mockScoreEntry(),
  ],
};

function setupFetch(data = mockData) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  }) as jest.Mock;
}

beforeEach(() => setupFetch());
afterEach(() => jest.restoreAllMocks());

// ──────────────────────────────────────────────────────────────────────────────
// AC1: Editorial rhythm — score hero is the first landmark after back link
// ──────────────────────────────────────────────────────────────────────────────

describe("AC1: Editorial rhythm layout order", () => {
  test("score-hero section is present in the DOM", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("score-hero")).toBeInTheDocument();
    });
  });

  test("insight-lede section is present below score hero", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("insight-lede")).toBeInTheDocument();
    });
  });

  test("sources-section is present in the DOM", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sources-section")).toBeInTheDocument();
    });
  });

  test("score-history section is present in the DOM", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("score-history-section")).toBeInTheDocument();
    });
  });

  test("score hero appears before dimension body in DOM order", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("score-hero")).toBeInTheDocument();
    });

    const hero = screen.getByTestId("score-hero");
    const dims = screen.getByTestId("sub-score-breakdown");

    // hero should precede dims in document order
    // Node.DOCUMENT_POSITION_FOLLOWING = 4 means `dims` comes after `hero`
    expect(
      hero.compareDocumentPosition(dims) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test("dimension body appears before sources section in DOM order", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    const dims = screen.getByTestId("sub-score-breakdown");
    const sources = screen.getByTestId("sources-section");

    expect(
      dims.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test("sources section appears before score history in DOM order", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sources-section")).toBeInTheDocument();
    });

    const sources = screen.getByTestId("sources-section");
    const history = screen.getByTestId("score-history-section");

    expect(
      sources.compareDocumentPosition(history) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test("insight lede appears before dimension body in DOM order", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("insight-lede")).toBeInTheDocument();
    });

    const lede = screen.getByTestId("insight-lede");
    const dims = screen.getByTestId("sub-score-breakdown");

    expect(
      lede.compareDocumentPosition(dims) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test("score hero contains topic name, score, UrgencyBadge, and share button", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("score-hero")).toBeInTheDocument();
    });

    const hero = screen.getByTestId("score-hero");
    expect(hero).toContainElement(screen.getByTestId("topic-name"));
    expect(hero).toContainElement(screen.getByTestId("detail-score"));
    expect(hero).toContainElement(screen.getByTestId("urgency-badge"));
    expect(hero).toContainElement(screen.getByTestId("share-button"));
  });

  test("score hero contains SeverityGauge (gauge-bar)", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("score-hero")).toBeInTheDocument();
    });

    const hero = screen.getByTestId("score-hero");
    // The hero-level gauge-bar (non-compact full gauge) is inside the hero
    const gauges = hero.querySelectorAll('[data-testid="gauge-bar"]');
    expect(gauges.length).toBeGreaterThanOrEqual(1);
  });

  test("insight lede displays summaryText", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("insight-lede")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Arctic ice decline accelerating with cascading effects across all dimensions."
      )
    ).toBeInTheDocument();
  });

  test("action bar displays relative timestamp with 'Updated' label", async () => {
    // Pin Date.now to a fixed point so relativeTime gives deterministic output
    const FIXED_NOW = new Date("2026-02-07T10:00:00Z").getTime();
    jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW);

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("action-bar")).toBeInTheDocument();
    });

    // updatedAt "2026-02-07T08:00:00Z" → 2h ago
    expect(screen.getByTestId("action-bar")).toHaveTextContent("Updated");
    expect(screen.getByTestId("action-bar")).toHaveTextContent("2h ago");
  });

  test("back link is present in the DOM (keyboard-accessible)", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("back-link")).toBeInTheDocument();
    });
    expect(screen.getByTestId("back-link").getAttribute("href")).toBe("/");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC2: Mobile above-the-fold — topic name uses line-clamp-2
// ──────────────────────────────────────────────────────────────────────────────

describe("AC2: Mobile above-the-fold", () => {
  test("topic name element has line-clamp-2 class", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("topic-name")).toBeInTheDocument();
    });

    expect(screen.getByTestId("topic-name")).toHaveClass("line-clamp-2");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC3: Social share arrival severity glance — score is large (font-mono text-4xl)
// ──────────────────────────────────────────────────────────────────────────────

describe("AC3: Social share arrival severity glance", () => {
  test("detail score has font-mono class for monospace readability", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-score")).toBeInTheDocument();
    });

    expect(screen.getByTestId("detail-score")).toHaveClass("font-mono");
  });

  test("detail score has text-4xl class for 40px size", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-score")).toBeInTheDocument();
    });

    expect(screen.getByTestId("detail-score")).toHaveClass("text-4xl");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC4: Dimension sub-scores use mini SeverityGauge (compact mode)
// ──────────────────────────────────────────────────────────────────────────────

describe("AC4: Dimension sub-scores use mini SeverityGauge", () => {
  test("each dimension card contains a gauge-bar (SeverityGauge compact)", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    // Each of the 3 dimension cards must contain a [data-testid="gauge-bar"]
    const dimensionKeys = ["eco", "health", "econ"];
    for (const key of dimensionKeys) {
      const card = screen.getByTestId(`dimension-card-${key}`);
      const gauge = card.querySelector('[data-testid="gauge-bar"]');
      expect(gauge).not.toBeNull();
    }
  });

  test("dimension gauge-bars are role=meter (a11y ARIA)", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    const breakdown = screen.getByTestId("sub-score-breakdown");
    const meters = breakdown.querySelectorAll('[role="meter"]');
    // One per dimension (3 cards)
    expect(meters.length).toBeGreaterThanOrEqual(3);
  });

  test("dimension gauge vocabulary is consistent — same component as hero gauge", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    // Compact SeverityGauge renders a single div[role="meter"] with data-testid="gauge-bar"
    // Non-compact renders that + a gauge-marker child. The dimension ones must be compact.
    const ecoCard = screen.getByTestId("dimension-card-eco");
    const gaugeBar = ecoCard.querySelector('[data-testid="gauge-bar"]');
    expect(gaugeBar).not.toBeNull();
    // Compact mode does NOT render gauge-marker
    const marker = ecoCard.querySelector('[data-testid="gauge-marker"]');
    expect(marker).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC5: Source citations with prominent publication dates
// ──────────────────────────────────────────────────────────────────────────────

describe("AC5: Source citations with prominent publication dates", () => {
  test("sources section has a heading (Sources or Source Articles)", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sources-section")).toBeInTheDocument();
    });

    const sourcesSection = screen.getByTestId("sources-section");
    // heading must be h2 or h3
    const heading = sourcesSection.querySelector("h2, h3");
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toMatch(/source/i);
  });

  test("article publication dates are prominently visible", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sources-section")).toBeInTheDocument();
    });

    // Article 1 has publishedAt "2026-02-05T10:00:00Z" → "Feb 5, 2026"
    expect(screen.getByText(/Feb 5, 2026/i)).toBeInTheDocument();
  });

  test("publisher names are clearly attributed in article list", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sources-section")).toBeInTheDocument();
    });

    expect(screen.getByText("Reuters")).toBeInTheDocument();
    expect(screen.getByText("BBC")).toBeInTheDocument();
  });

  test("article with null publishedAt displays 'Date unknown'", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sources-section")).toBeInTheDocument();
    });

    // Article 2 has publishedAt: null → must display "Date unknown"
    expect(screen.getByText("Date unknown")).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC6: Graceful empty/null states
// ──────────────────────────────────────────────────────────────────────────────

describe("AC6: Graceful empty/null states", () => {
  test("insight lede section is omitted when summaryText is null and impactSummary is null", async () => {
    setupFetch({
      ...mockData,
      topic: { ...mockData.topic, impactSummary: null },
      scoreHistory: [mockScoreEntry({ overallSummary: null })],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("topic-detail")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("insight-lede")).not.toBeInTheDocument();
  });

  test("insight lede section is omitted when summaryText is empty string", async () => {
    setupFetch({
      ...mockData,
      topic: { ...mockData.topic, impactSummary: "" },
      scoreHistory: [mockScoreEntry({ overallSummary: "" })],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("topic-detail")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("insight-lede")).not.toBeInTheDocument();
  });

  test("sources section is hidden entirely when articles array is empty", async () => {
    setupFetch({
      ...mockData,
      articles: [],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("topic-detail")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("sources-section")).not.toBeInTheDocument();
    // No "Sources" heading should appear
    expect(screen.queryByText(/sources/i)).not.toBeInTheDocument();
  });

  test("dimension gauge renders when score is 0 (empty bar, not hidden)", async () => {
    setupFetch({
      ...mockData,
      scoreHistory: [
        mockScoreEntry({ ecoScore: 0, ecoLevel: "MINIMAL" }),
      ],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("dimension-card-eco")).toBeInTheDocument();
    });

    const ecoCard = screen.getByTestId("dimension-card-eco");
    const gauge = ecoCard.querySelector('[data-testid="gauge-bar"]');
    // Gauge must exist even for score=0
    expect(gauge).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AC7: Accessibility landmarks — semantic headings for each editorial section
// ──────────────────────────────────────────────────────────────────────────────

describe("AC7: Accessibility landmarks", () => {
  test("dimension breakdown section has an h2 or h3 heading", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    const breakdown = screen.getByTestId("sub-score-breakdown");
    const heading = breakdown.querySelector("h2, h3");
    expect(heading).not.toBeNull();
  });

  test("sources section has an h2 or h3 heading", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sources-section")).toBeInTheDocument();
    });

    const sourcesSection = screen.getByTestId("sources-section");
    const heading = sourcesSection.querySelector("h2, h3");
    expect(heading).not.toBeNull();
  });

  test("score history section has an h2 or h3 heading", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("score-history-section")).toBeInTheDocument();
    });

    const historySection = screen.getByTestId("score-history-section");
    const heading = historySection.querySelector("h2, h3");
    expect(heading).not.toBeNull();
  });

  test("back link is keyboard-accessible (in DOM, has href)", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("back-link")).toBeInTheDocument();
    });

    const backLink = screen.getByTestId("back-link");
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/");
    // Must NOT be aria-hidden
    expect(backLink).not.toHaveAttribute("aria-hidden", "true");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Network error handling
// ──────────────────────────────────────────────────────────────────────────────

describe("Network error handling", () => {
  test("shows connection error message when fetch rejects (network error)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error")) as jest.Mock;

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-error")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Failed to load topic. Please check your connection.")
    ).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Share button behavior — preserved from original tests (smoke-check)
// ──────────────────────────────────────────────────────────────────────────────

describe("Share button behavior", () => {
  test("share button in hero copies URL to clipboard and shows confirmation", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("share-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("share-button"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(window.location.href);
      expect(screen.getByTestId("share-button")).toHaveTextContent(
        "Link copied!"
      );
    });
  });

  test("share button reverts to 'Share' after 2 seconds", async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("share-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("share-button"));

    await waitFor(() => {
      expect(screen.getByTestId("share-button")).toHaveTextContent(
        "Link copied!"
      );
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("share-button")).toHaveTextContent("Share");
    jest.useRealTimers();
  });
});
