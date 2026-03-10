/**
 * TDD tests for TopicList component
 *
 * TopicList is a server component (no "use client") that receives
 * `{ topics: Topic[] }` and renders rows. Each row shows: score (monospace,
 * severity-colored via inline style), topic name (linked to `/topic/{slug}`),
 * change indicator (via formatChange()), urgency label, and a compact
 * SeverityGauge.
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Topic } from "@/lib/types";

// Mock next/link as <a>
jest.mock("next/link", () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock SeverityGauge as a data-testid stub
jest.mock("@/components/SeverityGauge", () => {
  return function MockSeverityGauge() {
    return <div data-testid="severity-gauge" />;
  };
});

// Mock UrgencyBadge as a data-testid stub
jest.mock("@/components/UrgencyBadge", () => {
  return function MockUrgencyBadge() {
    return <span data-testid="urgency-badge" />;
  };
});

// Import after mocks
import TopicList from "@/components/TopicList";
import { severityColor, formatChange } from "@/lib/utils";

const makeTopic = (overrides: Partial<Topic> = {}): Topic => ({
  id: 1,
  name: "Arctic Ice",
  slug: "arctic-ice",
  category: "climate",
  region: null,
  currentScore: 50,
  previousScore: 50,
  change: 0,
  urgency: "moderate",
  impactSummary: null,
  imageUrl: null,
  articleCount: 3,
  healthScore: 50,
  ecoScore: 50,
  econScore: 50,
  scoreReasoning: null,
  hidden: false,
  sparkline: [],
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("TopicList component", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders data-testid='topic-list' wrapper", () => {
    render(<TopicList topics={[makeTopic()]} />);
    expect(screen.getByTestId("topic-list")).toBeInTheDocument();
  });

  test("renders one data-testid='topic-list-row' per topic", () => {
    const topics = [
      makeTopic({ id: 1, slug: "arctic-ice" }),
      makeTopic({ id: 2, slug: "amazon-fires", name: "Amazon Fires" }),
      makeTopic({ id: 3, slug: "ocean-acidification", name: "Ocean Acidification" }),
    ];
    render(<TopicList topics={topics} />);
    const rows = screen.getAllByTestId("topic-list-row");
    expect(rows).toHaveLength(3);
  });

  test("each row shows the topic score", () => {
    const topics = [
      makeTopic({ id: 1, currentScore: 85 }),
      makeTopic({ id: 2, currentScore: 42, slug: "ganges", name: "Ganges" }),
    ];
    render(<TopicList topics={topics} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("each row has score colored by severity (inline style matches severityColor().badge)", () => {
    const topics = [
      makeTopic({ id: 1, currentScore: 85 }), // breaking — red
      makeTopic({ id: 2, currentScore: 20, slug: "clean-energy", name: "Clean Energy" }), // informational — green
    ];
    render(<TopicList topics={topics} />);

    const score85 = screen.getByText("85");
    const score20 = screen.getByText("20");

    expect(score85).toHaveStyle({ color: severityColor(85).badge });
    expect(score20).toHaveStyle({ color: severityColor(20).badge });
  });

  test("each row shows topic name as a link to /topic/{slug}", () => {
    const topics = [
      makeTopic({ id: 1, name: "Arctic Ice", slug: "arctic-ice" }),
      makeTopic({ id: 2, name: "Amazon Fires", slug: "amazon-fires" }),
    ];
    render(<TopicList topics={topics} />);

    const arcticLink = screen.getByText("Arctic Ice").closest("a");
    expect(arcticLink).toHaveAttribute("href", "/topic/arctic-ice");

    const amazonLink = screen.getByText("Amazon Fires").closest("a");
    expect(amazonLink).toHaveAttribute("href", "/topic/amazon-fires");
  });

  test("each row shows formatted change: '+5 ▲', '-3 ▼', '0 ─'", () => {
    const topics = [
      makeTopic({ id: 1, change: 5, slug: "rising" }),
      makeTopic({ id: 2, change: -3, slug: "falling", name: "Falling" }),
      makeTopic({ id: 3, change: 0, slug: "stable", name: "Stable" }),
    ];
    render(<TopicList topics={topics} />);

    expect(screen.getByText(formatChange(5))).toBeInTheDocument();
    expect(screen.getByText(formatChange(-3))).toBeInTheDocument();
    expect(screen.getByText(formatChange(0))).toBeInTheDocument();
  });

  test("each row renders a SeverityGauge (mocked as data-testid stub)", () => {
    const topics = [
      makeTopic({ id: 1 }),
      makeTopic({ id: 2, slug: "other", name: "Other" }),
    ];
    render(<TopicList topics={topics} />);
    const gauges = screen.getAllByTestId("severity-gauge");
    expect(gauges).toHaveLength(2);
  });

  test("empty topics array renders wrapper with no rows", () => {
    render(<TopicList topics={[]} />);
    expect(screen.getByTestId("topic-list")).toBeInTheDocument();
    expect(screen.queryByTestId("topic-list-row")).not.toBeInTheDocument();
  });

  test("topics rendered in the order passed (caller controls sort)", () => {
    const topics = [
      makeTopic({ id: 1, name: "Zebra Habitat", slug: "zebra-habitat" }),
      makeTopic({ id: 2, name: "Amazon Fires", slug: "amazon-fires" }),
      makeTopic({ id: 3, name: "Marine Pollution", slug: "marine-pollution" }),
    ];
    render(<TopicList topics={topics} />);

    const rows = screen.getAllByTestId("topic-list-row");
    expect(rows[0]).toHaveTextContent("Zebra Habitat");
    expect(rows[1]).toHaveTextContent("Amazon Fires");
    expect(rows[2]).toHaveTextContent("Marine Pollution");
  });
});
