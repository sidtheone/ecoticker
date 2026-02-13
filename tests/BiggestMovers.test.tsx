import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import BiggestMovers from "@/components/BiggestMovers";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

const mockMovers = [
  { name: "Arctic Ice Decline", slug: "arctic-ice-decline", currentScore: 85, change: 12, healthScore: 85, ecoScore: 85, econScore: 85, hidden: false },
  { name: "Delhi Air Quality", slug: "delhi-air-quality", currentScore: 91, change: -10, healthScore: 91, ecoScore: 91, econScore: 91, hidden: false },
  { name: "Ganges Cleanup", slug: "ganges-cleanup", currentScore: 45, change: 8, healthScore: 45, ecoScore: 45, econScore: 45, hidden: false },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ movers: mockMovers }),
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("BiggestMovers", () => {
  test("shows loading state initially", () => {
    render(<BiggestMovers />);
    expect(screen.getByTestId("movers-loading")).toBeInTheDocument();
  });

  test("renders heading and mover cards after fetch", async () => {
    render(<BiggestMovers />);
    await waitFor(() => {
      expect(screen.getByTestId("biggest-movers")).toBeInTheDocument();
    });
    expect(screen.getByText("Biggest Movers")).toBeInTheDocument();
    const cards = screen.getAllByTestId("mover-card");
    expect(cards).toHaveLength(3);
  });

  test("renders mover names", async () => {
    render(<BiggestMovers />);
    await waitFor(() => {
      expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    });
    expect(screen.getByText("Delhi Air Quality")).toBeInTheDocument();
    expect(screen.getByText("Ganges Cleanup")).toBeInTheDocument();
  });

  test("renders scores", async () => {
    render(<BiggestMovers />);
    await waitFor(() => {
      expect(screen.getByText("85")).toBeInTheDocument();
    });
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  test("renders change with correct formatting", async () => {
    render(<BiggestMovers />);
    await waitFor(() => {
      expect(screen.getByText("+12 ▲")).toBeInTheDocument();
    });
    expect(screen.getByText("-10 ▼")).toBeInTheDocument();
  });

  test("links to topic detail pages", async () => {
    render(<BiggestMovers />);
    await waitFor(() => {
      expect(screen.getByTestId("biggest-movers")).toBeInTheDocument();
    });
    const cards = screen.getAllByTestId("mover-card");
    expect(cards[0].getAttribute("href")).toBe("/topic/arctic-ice-decline");
  });

  test("renders nothing when no movers returned", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ movers: [] }),
    });
    const { container } = render(<BiggestMovers />);
    await waitFor(() => {
      expect(screen.queryByTestId("movers-loading")).not.toBeInTheDocument();
    });
    expect(container.querySelector("[data-testid='biggest-movers']")).toBeNull();
  });
});
