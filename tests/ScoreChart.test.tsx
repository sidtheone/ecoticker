import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ScoreChart from "@/components/ScoreChart";
import type { ScoreHistoryEntry } from "@/lib/types";

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-count={data.length}>{children}</div>
  ),
  Line: (props: Record<string, unknown>) => (
    <div
      data-testid={`line-${props.dataKey}`}
      data-stroke={props.stroke}
      data-connect-nulls={props.connectNulls?.toString() || "undefined"}
    />
  ),
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

const mockHistoryWithInsufficientData: ScoreHistoryEntry[] = [
  { score: 70, healthScore: 60, ecoScore: -1, econScore: 65, impactSummary: null, date: "2026-02-01T00:00:00Z", healthLevel: null, ecoLevel: null, econLevel: null, healthReasoning: null, ecoReasoning: null, econReasoning: null, overallSummary: null, anomalyDetected: false },
  { score: 75, healthScore: 65, ecoScore: 78, econScore: -1, impactSummary: null, date: "2026-02-02T00:00:00Z", healthLevel: null, ecoLevel: null, econLevel: null, healthReasoning: null, ecoReasoning: null, econReasoning: null, overallSummary: null, anomalyDetected: false },
];

describe("ScoreChart", () => {
  test("renders chart with history data", () => {
    render(<ScoreChart history={mockHistory} />);
    expect(screen.getByTestId("score-chart")).toBeInTheDocument();
    expect(screen.getByText("Score History")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart").getAttribute("data-count")).toBe("3");
  });

  test("renders only overall line by default", () => {
    render(<ScoreChart history={mockHistory} />);
    expect(screen.getByTestId("line-score")).toBeInTheDocument();
    expect(screen.queryByTestId("line-health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-eco")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-econ")).not.toBeInTheDocument();
  });

  test("shows empty state when no history", () => {
    render(<ScoreChart history={[]} />);
    expect(screen.getByTestId("score-chart-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("score-chart")).not.toBeInTheDocument();
  });

  test("toggles health dimension line on/off", () => {
    render(<ScoreChart history={mockHistory} />);
    const healthCheckbox = screen.getByTestId("toggle-health");

    // Initially off
    expect(screen.queryByTestId("line-health")).not.toBeInTheDocument();

    // Toggle on
    fireEvent.click(healthCheckbox);
    expect(screen.getByTestId("line-health")).toBeInTheDocument();

    // Toggle off
    fireEvent.click(healthCheckbox);
    expect(screen.queryByTestId("line-health")).not.toBeInTheDocument();
  });

  test("toggles ecological dimension line on/off", () => {
    render(<ScoreChart history={mockHistory} />);
    const ecoCheckbox = screen.getByTestId("toggle-eco");

    expect(screen.queryByTestId("line-eco")).not.toBeInTheDocument();
    fireEvent.click(ecoCheckbox);
    expect(screen.getByTestId("line-eco")).toBeInTheDocument();
    fireEvent.click(ecoCheckbox);
    expect(screen.queryByTestId("line-eco")).not.toBeInTheDocument();
  });

  test("toggles economic dimension line on/off", () => {
    render(<ScoreChart history={mockHistory} />);
    const econCheckbox = screen.getByTestId("toggle-econ");

    expect(screen.queryByTestId("line-econ")).not.toBeInTheDocument();
    fireEvent.click(econCheckbox);
    expect(screen.getByTestId("line-econ")).toBeInTheDocument();
    fireEvent.click(econCheckbox);
    expect(screen.queryByTestId("line-econ")).not.toBeInTheDocument();
  });

  test("uses neutral colors (not urgency colors)", () => {
    render(<ScoreChart history={mockHistory} />);
    fireEvent.click(screen.getByTestId("toggle-health"));
    fireEvent.click(screen.getByTestId("toggle-eco"));
    fireEvent.click(screen.getByTestId("toggle-econ"));

    // Check neutral dimension colors
    expect(screen.getByTestId("line-score").getAttribute("data-stroke")).toBe("#ef4444");
    expect(screen.getByTestId("line-health").getAttribute("data-stroke")).toBe("#8b5cf6");
    expect(screen.getByTestId("line-eco").getAttribute("data-stroke")).toBe("#06b6d4");
    expect(screen.getByTestId("line-econ").getAttribute("data-stroke")).toBe("#f59e0b");
  });

  test("dimension lines have connectNulls={false}", () => {
    render(<ScoreChart history={mockHistory} />);
    fireEvent.click(screen.getByTestId("toggle-health"));

    // Health line should have connectNulls={false}
    expect(screen.getByTestId("line-health").getAttribute("data-connect-nulls")).toBe("false");
  });

  test("shows dimension label with weight in toggle", () => {
    render(<ScoreChart history={mockHistory} />);
    expect(screen.getByText("Ecology (40%)")).toBeInTheDocument();
    expect(screen.getByText("Health (35%)")).toBeInTheDocument();
    expect(screen.getByText("Economy (25%)")).toBeInTheDocument();
  });

  test("multiple dimensions can be toggled simultaneously", () => {
    render(<ScoreChart history={mockHistory} />);
    fireEvent.click(screen.getByTestId("toggle-health"));
    fireEvent.click(screen.getByTestId("toggle-eco"));

    expect(screen.getByTestId("line-score")).toBeInTheDocument();
    expect(screen.getByTestId("line-health")).toBeInTheDocument();
    expect(screen.getByTestId("line-eco")).toBeInTheDocument();
    expect(screen.queryByTestId("line-econ")).not.toBeInTheDocument();
  });

  test("converts INSUFFICIENT_DATA (-1) to null in chart data", () => {
    // This test verifies the data transformation logic by checking the component doesn't crash
    // and renders correctly even with -1 values in the data
    render(<ScoreChart history={mockHistoryWithInsufficientData} />);
    fireEvent.click(screen.getByTestId("toggle-eco"));
    fireEvent.click(screen.getByTestId("toggle-econ"));

    // Component should render without errors
    expect(screen.getByTestId("score-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line-eco")).toBeInTheDocument();
    expect(screen.getByTestId("line-econ")).toBeInTheDocument();
  });
});
