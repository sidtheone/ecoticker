import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TopicDetailPage from "@/app/topic/[slug]/page";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock("next/navigation", () => ({
  useParams: () => ({ slug: "arctic-ice-decline" }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}));

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
  overallSummary: "Arctic ice decline accelerating with cascading effects across all dimensions.",
  anomalyDetected: false,
  ...overrides,
});

const mockData = {
  topic: {
    id: 1, name: "Arctic Ice Decline", slug: "arctic-ice-decline", category: "climate",
    region: "Arctic", currentScore: 85, previousScore: 79, change: 6, urgency: "breaking",
    impactSummary: "Sea ice at record lows", imageUrl: null, articleCount: 2, updatedAt: "2026-02-07",
    healthScore: 85, ecoScore: 85, econScore: 85, scoreReasoning: null, hidden: false,
  },
  articles: [
    { id: 1, topicId: 1, title: "Ice caps shrinking", url: "https://example.com/1", source: "Reuters", summary: "Fast decline", imageUrl: null, publishedAt: "2026-02-05T10:00:00Z", sourceType: "news" },
  ],
  scoreHistory: [
    mockScoreEntry({ score: 75, healthScore: 60, ecoScore: 70, econScore: 65, date: "2026-02-01T00:00:00Z", healthLevel: "SIGNIFICANT", ecoLevel: "SIGNIFICANT", econLevel: "SIGNIFICANT", healthReasoning: "Earlier health data.", ecoReasoning: "Earlier eco data.", econReasoning: "Earlier econ data.", overallSummary: null }),
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

describe("TopicDetailPage", () => {
  test("shows loading state initially", () => {
    render(<TopicDetailPage />);
    expect(screen.getByTestId("detail-loading")).toBeInTheDocument();
  });

  test("renders topic name after fetch", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("topic-name")).toHaveTextContent("Arctic Ice Decline");
    });
  });

  test("renders score and change", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-score")).toHaveTextContent("85");
    });
    expect(screen.getByTestId("detail-change")).toHaveTextContent("+6 ▲");
  });

  test("renders impact summary with overallSummary from latest score history", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("impact-summary")).toBeInTheDocument();
    });
    expect(screen.getByText("Arctic ice decline accelerating with cascading effects across all dimensions.")).toBeInTheDocument();
  });

  test("renders back link to dashboard", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("back-link")).toBeInTheDocument();
    });
    expect(screen.getByTestId("back-link").getAttribute("href")).toBe("/");
  });

  test("renders score chart", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("score-chart")).toBeInTheDocument();
    });
  });

  test("renders article list", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("article-list")).toBeInTheDocument();
    });
    expect(screen.getByText("Ice caps shrinking")).toBeInTheDocument();
  });

  test("renders urgency badge", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("urgency-badge")).toBeInTheDocument();
    });
  });

  test("shows error state for missing topic", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Topic not found")).toBeInTheDocument();
  });
});

describe("Sub-Score Breakdown", () => {
  test("renders three dimension cards with correct labels and order", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    expect(screen.getByTestId("dimension-card-eco")).toBeInTheDocument();
    expect(screen.getByTestId("dimension-card-health")).toBeInTheDocument();
    expect(screen.getByTestId("dimension-card-econ")).toBeInTheDocument();

    // Verify labels present
    expect(screen.getByText("Ecological Impact")).toBeInTheDocument();
    expect(screen.getByText("Health Impact")).toBeInTheDocument();
    expect(screen.getByText("Economic Impact")).toBeInTheDocument();

    // Verify weights present
    expect(screen.getByText("(40% weight)")).toBeInTheDocument();
    expect(screen.getByText("(35% weight)")).toBeInTheDocument();
    expect(screen.getByText("(25% weight)")).toBeInTheDocument();
  });

  test("renders correct scores and severity levels", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    // Latest entry: eco=80 SEVERE, health=70 SIGNIFICANT, econ=75 SIGNIFICANT
    expect(screen.getByTestId("dimension-score-eco")).toHaveTextContent("80");
    expect(screen.getByTestId("dimension-level-eco")).toHaveTextContent("SEVERE");

    expect(screen.getByTestId("dimension-score-health")).toHaveTextContent("70");
    expect(screen.getByTestId("dimension-level-health")).toHaveTextContent("SIGNIFICANT");

    expect(screen.getByTestId("dimension-score-econ")).toHaveTextContent("75");
    expect(screen.getByTestId("dimension-level-econ")).toHaveTextContent("SIGNIFICANT");
  });

  test("renders reasoning text for each dimension", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    // Desktop reasoning elements (hidden sm:block — jsdom doesn't respect CSS, so they're in DOM)
    expect(screen.getByText("Unprecedented ice loss disrupting polar ecosystems.")).toBeInTheDocument();
    expect(screen.getByText("Air quality degradation affecting Arctic communities.")).toBeInTheDocument();
    expect(screen.getByText("Shipping route changes and fishing industry impacts.")).toBeInTheDocument();
  });

  test("handles INSUFFICIENT_DATA for a single dimension", async () => {
    setupFetch({
      ...mockData,
      scoreHistory: [
        mockScoreEntry({ econScore: -1, econLevel: "INSUFFICIENT_DATA", econReasoning: null }),
      ],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-breakdown")).toBeInTheDocument();
    });

    // Econ should show N/A
    expect(screen.getByTestId("dimension-score-econ")).toHaveTextContent("N/A");
    expect(screen.getByTestId("dimension-level-econ")).toHaveTextContent("No Data");
    expect(screen.getByTestId("dimension-reasoning-econ")).toHaveTextContent("Insufficient article data to assess this dimension");

    // Other dimensions render normally
    expect(screen.getByTestId("dimension-score-eco")).toHaveTextContent("80");
    expect(screen.getByTestId("dimension-score-health")).toHaveTextContent("70");
  });

  test("hides breakdown when all dimensions are INSUFFICIENT_DATA", async () => {
    setupFetch({
      ...mockData,
      scoreHistory: [
        mockScoreEntry({ ecoScore: -1, healthScore: -1, econScore: -1, ecoLevel: "INSUFFICIENT_DATA", healthLevel: "INSUFFICIENT_DATA", econLevel: "INSUFFICIENT_DATA" }),
      ],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sub-score-unavailable")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("sub-score-breakdown")).not.toBeInTheDocument();
    expect(screen.getByText(/Sub-score breakdown unavailable/)).toBeInTheDocument();
  });

  test("hides breakdown when scoreHistory is empty", async () => {
    setupFetch({
      ...mockData,
      scoreHistory: [],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("topic-detail")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("sub-score-breakdown")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sub-score-unavailable")).not.toBeInTheDocument();
  });

  test("uses overallSummary instead of impactSummary when available", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("impact-summary")).toBeInTheDocument();
    });

    // overallSummary from latest scoreHistory takes precedence
    expect(screen.getByText("Arctic ice decline accelerating with cascading effects across all dimensions.")).toBeInTheDocument();
    // topic.impactSummary should NOT be shown
    expect(screen.queryByText("Sea ice at record lows")).not.toBeInTheDocument();
  });

  test("renders article count line with plural articles", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("article-count-line")).toHaveTextContent("Latest score based on 2 articles");
    });
  });

  test("renders article count line with singular article", async () => {
    setupFetch({
      ...mockData,
      topic: { ...mockData.topic, articleCount: 1 },
    });
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("article-count-line")).toHaveTextContent("Latest score based on 1 article");
    });
  });

  test("renders zero-article message when articleCount is 0", async () => {
    setupFetch({
      ...mockData,
      topic: { ...mockData.topic, articleCount: 0 },
    });
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("article-count-line")).toHaveTextContent("No articles available for this topic");
    });
  });

  test("falls back to impactSummary when overallSummary is null", async () => {
    setupFetch({
      ...mockData,
      scoreHistory: [
        mockScoreEntry({ overallSummary: null }),
      ],
    });

    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("impact-summary")).toBeInTheDocument();
    });

    expect(screen.getByText("Sea ice at record lows")).toBeInTheDocument();
  });
});
