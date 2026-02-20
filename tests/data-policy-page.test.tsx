import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DataPolicyPage, { metadata } from "@/app/data-policy/page";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe("Data Policy Page", () => {
  test("renders all 7 section headings", () => {
    render(<DataPolicyPage />);
    expect(screen.getByText("What We Collect")).toBeInTheDocument();
    expect(screen.getByText("What We Don't Collect")).toBeInTheDocument();
    expect(screen.getByText("Legal Basis")).toBeInTheDocument();
    expect(screen.getByText("Your Rights")).toBeInTheDocument();
    expect(screen.getByText("Data Retention")).toBeInTheDocument();
    expect(screen.getByText("Data Controller")).toBeInTheDocument();
    expect(screen.getByText("Changes to This Policy")).toBeInTheDocument();
  });

  test("renders data collection table with expected rows", () => {
    render(<DataPolicyPage />);
    expect(screen.getByText("Truncated IP addresses")).toBeInTheDocument();
    expect(screen.getByText("Page view counts")).toBeInTheDocument();
    expect(screen.getByText("Feedback text")).toBeInTheDocument();
    expect(screen.getAllByText("Theme preference").length).toBeGreaterThanOrEqual(1);
  });

  test("lists what is not collected", () => {
    render(<DataPolicyPage />);
    expect(screen.getByText("No cookies")).toBeInTheDocument();
    expect(screen.getByText("No user accounts or email addresses")).toBeInTheDocument();
  });

  test("renders last updated date", () => {
    render(<DataPolicyPage />);
    expect(screen.getByTestId("last-updated")).toHaveTextContent("February 13, 2026");
  });

  test("renders back to dashboard link", () => {
    render(<DataPolicyPage />);
    const link = screen.getByText("← Back to Dashboard");
    expect(link.getAttribute("href")).toBe("/");
  });

  test("exports correct metadata", () => {
    expect(metadata.title).toBe("Data Policy — EcoTicker");
    expect(metadata.description).toContain("GDPR");
  });
});
