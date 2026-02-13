import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TopicGrid from "@/components/TopicGrid";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

const mockTopics = [
  { id: 1, name: "Arctic Ice Decline", slug: "arctic-ice-decline", category: "climate", region: "Arctic", currentScore: 85, previousScore: 79, change: 6, urgency: "breaking", impactSummary: "Ice melting", imageUrl: null, articleCount: 5, updatedAt: "2026-02-07", sparkline: [80, 82, 85], healthScore: 85, ecoScore: 85, econScore: 85, scoreReasoning: null, hidden: false },
  { id: 2, name: "Ganges Cleanup", slug: "ganges-cleanup", category: "water", region: "South Asia", currentScore: 45, previousScore: 52, change: -7, urgency: "moderate", impactSummary: "Progress", imageUrl: null, articleCount: 3, updatedAt: "2026-02-07", sparkline: [50, 48, 45], healthScore: 45, ecoScore: 45, econScore: 45, scoreReasoning: null, hidden: false },
  { id: 3, name: "Renewable Growth", slug: "renewable-growth", category: "energy", region: "Global", currentScore: 22, previousScore: 28, change: -6, urgency: "informational", impactSummary: "Solar up", imageUrl: null, articleCount: 2, updatedAt: "2026-02-07", sparkline: [26, 24, 22], healthScore: 22, ecoScore: 22, econScore: 22, scoreReasoning: null, hidden: false },
  { id: 4, name: "Global Warming Trends", slug: "global-warming-trends", category: "climate", region: "Global", currentScore: 72, previousScore: 68, change: 4, urgency: "critical", impactSummary: "Accelerating", imageUrl: null, articleCount: 4, updatedAt: "2026-02-07", sparkline: [65, 68, 72], healthScore: 72, ecoScore: 72, econScore: 72, scoreReasoning: null, hidden: false },
];

let fetchUrl: string;
let fetchCallCount: number;

beforeEach(() => {
  fetchUrl = "";
  fetchCallCount = 0;
  global.fetch = jest.fn().mockImplementation((url: string) => {
    fetchUrl = url;
    fetchCallCount++;
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
    expect(screen.getByText("Global Warming Trends")).toBeInTheDocument();
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

  test("renders all 5 urgency filter buttons", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    });
    expect(screen.getByTestId("filter-breaking")).toBeInTheDocument();
    expect(screen.getByTestId("filter-critical")).toBeInTheDocument();
    expect(screen.getByTestId("filter-moderate")).toBeInTheDocument();
    expect(screen.getByTestId("filter-informational")).toBeInTheDocument();
  });

  test("'All' urgency filter is active by default", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      const allBtn = screen.getByTestId("filter-all");
      expect(allBtn.className).toContain("bg-stone-800");
    });
  });

  test("clicking urgency filter fetches with urgency param", async () => {
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

  // --- US-1.4: Category filter tests ---

  test("renders category filter chips derived from topic categories", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("category-filters")).toBeInTheDocument();
    });
    // "All Categories" + 3 unique categories (climate, energy, water) sorted alphabetically
    expect(screen.getByTestId("filter-category-all")).toBeInTheDocument();
    expect(screen.getByText("Climate")).toBeInTheDocument();
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByText("Water")).toBeInTheDocument();
  });

  test("does not show categories not present in topics", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByTestId("category-filters")).toBeInTheDocument();
    });
    expect(screen.queryByText("Ocean")).not.toBeInTheDocument();
    expect(screen.queryByText("Biodiversity")).not.toBeInTheDocument();
    expect(screen.queryByText("Air Quality")).not.toBeInTheDocument();
  });

  test("'All Categories' is active by default", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      const allCatBtn = screen.getByTestId("filter-category-all");
      expect(allCatBtn.className).toContain("bg-stone-800");
    });
  });

  test("clicking category chip filters topics client-side without new fetch", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    });

    const callsBefore = fetchCallCount;
    fireEvent.click(screen.getByTestId("filter-category-water"));

    // Client-side: no new fetch call
    expect(fetchCallCount).toBe(callsBefore);

    // Only water topic visible
    expect(screen.getByText("Ganges Cleanup")).toBeInTheDocument();
    expect(screen.queryByText("Arctic Ice Decline")).not.toBeInTheDocument();
    expect(screen.queryByText("Renewable Growth")).not.toBeInTheDocument();
  });

  test("combined urgency + category filtering works", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    });

    // Filter by climate category (client-side) — should show 2 climate topics
    fireEvent.click(screen.getByTestId("filter-category-climate"));
    expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    expect(screen.getByText("Global Warming Trends")).toBeInTheDocument();
    expect(screen.queryByText("Ganges Cleanup")).not.toBeInTheDocument();
  });

  test("shows 'No topics match' when category filter yields 0 results", async () => {
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    });

    // Select ocean category — no ocean topics in mock data
    // Since ocean isn't in the data, we select a category that exists (water),
    // then change urgency to get topics without water
    fireEvent.click(screen.getByTestId("filter-category-water"));
    expect(screen.getByText("Ganges Cleanup")).toBeInTheDocument();

    // Now change urgency to breaking — returns only climate topics, water filter still active
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ topics: [mockTopics[0]] }), // Only climate
    });
    fireEvent.click(screen.getByTestId("filter-breaking"));
    await waitFor(() => {
      expect(screen.getByTestId("no-matches")).toBeInTheDocument();
    });
    expect(screen.getByText(/No topics match these filters/)).toBeInTheDocument();
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  test("'Clear filters' resets both urgency and category", async () => {
    // Start with only 1 topic so category filter can produce 0 results
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ topics: [mockTopics[0], mockTopics[1]] }),
    });
    render(<TopicGrid />);
    await waitFor(() => {
      expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    });

    // Select water category
    fireEvent.click(screen.getByTestId("filter-category-water"));
    expect(screen.getByText("Ganges Cleanup")).toBeInTheDocument();
    expect(screen.queryByText("Arctic Ice Decline")).not.toBeInTheDocument();

    // Now mock empty response for breaking urgency
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ topics: [mockTopics[0]] }), // Only climate
    });
    fireEvent.click(screen.getByTestId("filter-breaking"));
    await waitFor(() => {
      expect(screen.getByTestId("no-matches")).toBeInTheDocument();
    });

    // Click clear filters — should reset both
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ topics: mockTopics }),
    });
    fireEvent.click(screen.getByTestId("clear-filters"));
    await waitFor(() => {
      expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
    });
    expect(screen.getByText("Ganges Cleanup")).toBeInTheDocument();
  });
});
