import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Footer from "@/components/Footer";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe("Footer", () => {
  test("renders scoring methodology link", () => {
    render(<Footer />);
    const link = screen.getByText("Scoring Methodology");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/scoring");
  });

  test("renders data policy link", () => {
    render(<Footer />);
    const link = screen.getByText("Data Policy");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/data-policy");
  });

  test("renders copyright with current year", () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`${year} EcoTicker`))).toBeInTheDocument();
  });
});
