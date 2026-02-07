import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TopicGrid from "@/components/TopicGrid";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

const mockTopics = [
  { id: 1, name: "Arctic Ice Decline", slug: "arctic-ice-decline", category: "climate", region: "Arctic", currentScore: 85, previousScore: 79, change: 6, urgency: "breaking", impactSummary: "Ice melting", imageUrl: null, articleCount: 5, updatedAt: "2026-02-07", sparkline: [80, 82, 85] },
  { id: 2, name: "Ganges Cleanup", slug: "ganges-cleanup", category: "water", region: "South Asia", currentScore: 45, previousScore: 52, change: -7, urgency: "moderate", impactSummary: "Progress", imageUrl: null, articleCount: 3, updatedAt: "2026-02-07", sparkline: [50, 48, 45] },
  { id: 3, name: "Renewable Growth", slug: "renewable-growth", category: "energy", region: "Global", currentScore: 22, previousScore: 28, change: -6, urgency: "informational", impactSummary: "Solar up", imageUrl: null, articleCount: 2, updatedAt: "2026-02-07", sparkline: [26, 24, 22] },
];

let fetchUrl: string;

beforeEach(() => {
  fetchUrl = "";
  global.fetch = jest.fn().mockImplementation((url: string) => {
    fetchUrl = url;
    return Promise.resolve({
      json: () => Promise.resolve({ topics: mockTopics }),
    });
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("TopicGrid", () => {
  test("renders all topic cards after fetch", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    });
    expect(screen.getByText("Ganges Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Renewable Growth")).toBeInTheDocument();
  });

  test("shows loading state initially", () => {
    render(<TopicGrid />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  test("shows empty state when no topics", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ topics: [] }),
    });
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("empty")).toBeInTheDocument();
    });
  });

  test("renders all 5 filter buttons", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    });
    expect(screen.getByTestId("filter-breaking")).toBeInTheDocument();
    expect(screen.getByTestId("filter-critical")).toBeInTheDocument();
    expect(screen.getByTestId("filter-moderate")).toBeInTheDocument();
    expect(screen.getByTestId("filter-informational")).toBeInTheDocument();
  });

  test("'All' filter is active by default", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      const allBtn = screen.getByTestId("filter-all");
      expect(allBtn.className).toContain("bg-white");
    });
  });

  test("clicking a filter fetches with urgency param", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("filter-breaking")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("filter-breaking"));

    await waitFor(() => {
      expect(fetchUrl).toContain("?urgency=breaking");
    });
  });

  test("clicking 'All' fetches without urgency param", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("filter-breaking")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("filter-breaking"));
    await waitFor(() => {
      expect(fetchUrl).toContain("?urgency=breaking");
    });

    fireEvent.click(screen.getByTestId("filter-all"));
    await waitFor(() => {
      expect(fetchUrl).toBe("/api/topics");
    });
  });

  test("renders topic grid container", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("topic-grid")).toBeInTheDocument();
    });
  });
});
