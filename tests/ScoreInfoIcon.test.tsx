import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ScoreInfoIcon from "@/components/ScoreInfoIcon";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("ScoreInfoIcon", () => {
  test("renders the ? button", () => {
    render(<ScoreInfoIcon />);
    const button = screen.getByTestId("score-info-icon");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe("?");
  });

  test("has correct aria-label for accessibility", () => {
    render(<ScoreInfoIcon />);
    const button = screen.getByLabelText("Scoring methodology");
    expect(button).toBeInTheDocument();
  });

  test("tooltip contains urgency scale with correct thresholds matching scoreToUrgency()", () => {
    render(<ScoreInfoIcon />);
    expect(screen.getByText("Urgency Scale")).toBeInTheDocument();
    expect(screen.getByText("80–100")).toBeInTheDocument();
    expect(screen.getByText("60–79")).toBeInTheDocument();
    expect(screen.getByText("30–59")).toBeInTheDocument();
    expect(screen.getByText("0–29")).toBeInTheDocument();
    expect(screen.getByText(/Breaking/)).toBeInTheDocument();
    expect(screen.getByText(/Critical/)).toBeInTheDocument();
    expect(screen.getByText(/Moderate/)).toBeInTheDocument();
    expect(screen.getByText(/Informational/)).toBeInTheDocument();
  });

  test("tooltip contains learn more button", () => {
    render(<ScoreInfoIcon />);
    const link = screen.getByTestId("score-info-link");
    expect(link).toBeInTheDocument();
    expect(link.textContent).toContain("Learn more about our scoring");
  });
});
