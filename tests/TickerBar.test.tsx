import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TickerBar from "@/components/TickerBar";

// Mock next/link
jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

const mockItems = [
  { name: "Arctic Ice Decline", slug: "arctic-ice-decline", score: 85, change: 6, healthScore: 85, ecoScore: 85, econScore: 85, hidden: false },
  { name: "Delhi Air Quality", slug: "delhi-air-quality", score: 91, change: 3, healthScore: 91, ecoScore: 91, econScore: 91, hidden: false },
  { name: "Ganges Cleanup", slug: "ganges-cleanup", score: 45, change: -7, healthScore: 45, ecoScore: 45, econScore: 45, hidden: false },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ items: mockItems }),
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("TickerBar", () => {
  test("renders abbreviated ticker codes after fetch", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      expect(screen.getAllByText("ARCT-DEC").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("DELH-QUA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("GANG-CLE").length).toBeGreaterThan(0);
  });

  test("displays scores with severity-colored inline styles", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      const scores = screen.getAllByText("85");
      expect(scores.length).toBeGreaterThan(0);
      // Breaking score (85) should have red color inline
      expect(scores[0]).toHaveStyle({ color: "#dc2626" });
    });
    const scores91 = screen.getAllByText("91");
    expect(scores91[0]).toHaveStyle({ color: "#dc2626" });
  });

  test("shows change with severity-colored inline style", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      const changes = screen.getAllByText("+6 ▲");
      expect(changes.length).toBeGreaterThan(0);
      // Breaking score item — change uses badge color
      expect(changes[0]).toHaveStyle({ color: "#dc2626" });
    });
  });

  test("shows negative change with severity-colored inline style", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      const changes = screen.getAllByText("-7 ▼");
      expect(changes.length).toBeGreaterThan(0);
      // Moderate score (45) — change uses moderate badge color
      expect(changes[0]).toHaveStyle({ color: "#a16207" });
    });
  });

  test("links to topic detail pages", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));
      expect(hrefs).toContain("/topic/arctic-ice-decline");
      expect(hrefs).toContain("/topic/delhi-air-quality");
    });
  });

  test("doubles items for seamless scroll loop", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      // 3 items doubled = 6 instances of abbreviated names
      expect(screen.getAllByText("ARCT-DEC")).toHaveLength(2);
    });
  });

  test("renders nothing when fetch returns empty items", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ items: [] }),
    });
    const { container } = render(<TickerBar />);
    // Wait a tick for the effect to run
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });
});
