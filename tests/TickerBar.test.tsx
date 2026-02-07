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
  { name: "Arctic Ice Decline", slug: "arctic-ice-decline", score: 85, change: 6 },
  { name: "Delhi Air Quality", slug: "delhi-air-quality", score: 91, change: 3 },
  { name: "Ganges Cleanup", slug: "ganges-cleanup", score: 45, change: -7 },
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
  test("renders ticker items after fetch", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      expect(screen.getAllByText("Arctic Ice Decline").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Delhi Air Quality").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ganges Cleanup").length).toBeGreaterThan(0);
  });

  test("displays scores", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      expect(screen.getAllByText("85").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("91").length).toBeGreaterThan(0);
  });

  test("shows positive change with up arrow in red", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      const changes = screen.getAllByText("+6 ▲");
      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].className).toContain("text-red-400");
    });
  });

  test("shows negative change with down arrow in green", async () => {
    render(<TickerBar />);
    await waitFor(() => {
      const changes = screen.getAllByText("-7 ▼");
      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].className).toContain("text-green-400");
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
      // 3 items doubled = 6 instances of names
      expect(screen.getAllByText("Arctic Ice Decline")).toHaveLength(2);
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
