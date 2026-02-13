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
    { score: 75, healthScore: 60, ecoScore: 70, econScore: 65, impactSummary: null, date: "2026-02-01T00:00:00Z", healthLevel: null, ecoLevel: null, econLevel: null, healthReasoning: null, ecoReasoning: null, econReasoning: null, overallSummary: null, anomalyDetected: false },
    { score: 85, healthScore: 70, ecoScore: 80, econScore: 75, impactSummary: null, date: "2026-02-07T00:00:00Z", healthLevel: null, ecoLevel: null, econLevel: null, healthReasoning: null, ecoReasoning: null, econReasoning: null, overallSummary: null, anomalyDetected: false },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockData),
  }) as jest.Mock;
});

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

  test("renders impact summary", async () => {
    render(<TopicDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId("impact-summary")).toBeInTheDocument();
    });
    expect(screen.getByText("Sea ice at record lows")).toBeInTheDocument();
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
