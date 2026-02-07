import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Sparkline from "@/components/Sparkline";

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: (props: Record<string, unknown>) => <div data-testid="line" data-stroke={props.stroke} />,
}));

describe("Sparkline", () => {
  test("renders with valid data", () => {
    render(<Sparkline data={[10, 20, 30]} />);
    expect(screen.getByTestId("sparkline")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  test("returns null with fewer than 2 data points", () => {
    const { container } = render(<Sparkline data={[10]} />);
    expect(container.innerHTML).toBe("");
  });

  test("returns null with empty data", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.innerHTML).toBe("");
  });

  test("uses provided color", () => {
    render(<Sparkline data={[10, 20, 30]} color="#ef4444" />);
    const line = screen.getByTestId("line");
    expect(line.getAttribute("data-stroke")).toBe("#ef4444");
  });

  test("uses default gray color", () => {
    render(<Sparkline data={[10, 20, 30]} />);
    const line = screen.getByTestId("line");
    expect(line.getAttribute("data-stroke")).toBe("#6b7280");
  });
});
