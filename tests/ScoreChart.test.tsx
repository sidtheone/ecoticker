import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ScoreChart from "@/components/ScoreChart";
import type { ScoreHistoryEntry } from "@/lib/types";

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-count={data.length}>{children}</div>
  ),
  Line: (props: Record<string, unknown>) => <div data-testid={`line-${props.dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="grid" />,
}));

const mockHistory: ScoreHistoryEntry[] = [
  { score: 70, healthScore: 60, ecoScore: 75, econScore: 65, impactSummary: null, date: "2026-02-01T00:00:00Z", healthLevel: null, ecoLevel: null, econLevel: null, healthReasoning: null, ecoReasoning: null, econReasoning: null, overallSummary: null, anomalyDetected: false },
  { score: 75, healthScore: 65, ecoScore: 78, econScore: 70, impactSummary: null, date: "2026-02-02T00:00:00Z", healthLevel: null, ecoLevel: null, econLevel: null, healthReasoning: null, ecoReasoning: null, econReasoning: null, overallSummary: null, anomalyDetected: false },
  { score: 85, healthScore: 70, ecoScore: 82, econScore: 80, impactSummary: null, date: "2026-02-03T00:00:00Z", healthLevel: null, ecoLevel: null, econLevel: null, healthReasoning: null, ecoReasoning: null, econReasoning: null, overallSummary: null, anomalyDetected: false },
];

describe("ScoreChart", () => {
  test("renders chart with history data", () => {
    render(<ScoreChart history={mockHistory} />);
    expect(screen.getByTestId("score-chart")).toBeInTheDocument();
    expect(screen.getByText("Score History")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart").getAttribute("data-count")).toBe("3");
  });

  test("renders all four score lines", () => {
    render(<ScoreChart history={mockHistory} />);
    expect(screen.getByTestId("line-score")).toBeInTheDocument();
    expect(screen.getByTestId("line-health")).toBeInTheDocument();
    expect(screen.getByTestId("line-eco")).toBeInTheDocument();
    expect(screen.getByTestId("line-econ")).toBeInTheDocument();
  });

  test("shows empty state when no history", () => {
    render(<ScoreChart history={[]} />);
    expect(screen.getByTestId("score-chart-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("score-chart")).not.toBeInTheDocument();
  });
});
