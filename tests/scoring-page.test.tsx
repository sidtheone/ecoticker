import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ScoringPage, { metadata } from "@/app/scoring/page";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe("Scoring Page", () => {
  test("renders all 7 section headings", () => {
    render(<ScoringPage />);
    expect(screen.getByText("The 4-Level Severity Scale")).toBeInTheDocument();
    expect(screen.getByText("Three Dimensions")).toBeInTheDocument();
    expect(screen.getByText("Why These Weights")).toBeInTheDocument();
    expect(screen.getByText("How the Overall Score Works")).toBeInTheDocument();
    expect(screen.getByText("Urgency Levels")).toBeInTheDocument();
    expect(screen.getByText("Data Sources")).toBeInTheDocument();
    expect(screen.getByText("Limitations")).toBeInTheDocument();
  });

  test("renders the weighted formula", () => {
    render(<ScoringPage />);
    expect(screen.getByText(/Score = \(Eco × 0\.40\)/)).toBeInTheDocument();
  });

  test("renders back to dashboard link", () => {
    render(<ScoringPage />);
    const link = screen.getByText("← Back to Dashboard");
    expect(link.getAttribute("href")).toBe("/");
  });

  test("exports correct metadata", () => {
    expect(metadata.title).toBe("Scoring Methodology — EcoTicker");
    expect(metadata.description).toContain("4-level rubric");
  });
});
