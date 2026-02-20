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

  test("tooltip contains all 4 severity levels", () => {
    render(<ScoreInfoIcon />);
    expect(screen.getByText("Severity Scale")).toBeInTheDocument();
    expect(screen.getByText("SEVERE")).toBeInTheDocument();
    expect(screen.getByText("SIGNIFICANT")).toBeInTheDocument();
    expect(screen.getByText("MODERATE")).toBeInTheDocument();
    expect(screen.getByText("MINIMAL")).toBeInTheDocument();
  });

  test("tooltip contains learn more button", () => {
    render(<ScoreInfoIcon />);
    const link = screen.getByTestId("score-info-link");
    expect(link).toBeInTheDocument();
    expect(link.textContent).toContain("Learn more about our scoring");
  });
});
