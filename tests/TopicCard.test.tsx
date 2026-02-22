import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TopicCard from "@/components/TopicCard";
import type { Topic } from "@/lib/types";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    name: "Arctic Ice Decline",
    slug: "arctic-ice-decline",
    category: "climate",
    region: "Arctic",
    currentScore: 85,
    previousScore: 79,
    change: 6,
    urgency: "breaking",
    impactSummary: "Sea ice at record lows",
    imageUrl: null,
    articleCount: 5,
    updatedAt: "2026-02-07T06:00:00Z",
    sparkline: [70, 72, 75, 78, 80, 82, 85],
    healthScore: 85,
    ecoScore: 85,
    econScore: 85,
    scoreReasoning: null,
    hidden: false,
    ...overrides,
  };
}

describe("TopicCard", () => {
  test("renders topic name", () => {
    render(<TopicCard topic={makeTopic()} />);
    expect(screen.getByText("Arctic Ice Decline")).toBeInTheDocument();
  });

  test("renders score with correct color for breaking (>=80)", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 85 })} />);
    const score = screen.getByTestId("score");
    expect(score.textContent).toBe("85");
    expect((score as HTMLElement).style.color).toBe("rgb(220, 38, 38)");
  });

  test("renders score with orange for critical (60-79)", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 65, urgency: "critical" })} />);
    const score = screen.getByTestId("score");
    expect((score as HTMLElement).style.color).toBe("rgb(194, 65, 12)");
  });

  test("renders score with yellow for moderate (30-59)", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 45, urgency: "moderate" })} />);
    const score = screen.getByTestId("score");
    expect((score as HTMLElement).style.color).toBe("rgb(161, 98, 7)");
  });

  test("renders score with green for informational (<30)", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 22, urgency: "informational" })} />);
    const score = screen.getByTestId("score");
    expect((score as HTMLElement).style.color).toBe("rgb(21, 128, 61)");
  });

  test("renders positive change in red with up arrow", () => {
    render(<TopicCard topic={makeTopic({ change: 6 })} />);
    const change = screen.getByTestId("change");
    expect(change.textContent).toBe("▲6");
    // Default score 85 (breaking) — severity color is #dc2626
    expect(change).toHaveStyle({ color: "#dc2626" });
  });

  test("renders negative change with severity-colored inline style", () => {
    render(<TopicCard topic={makeTopic({ change: -7 })} />);
    const change = screen.getByTestId("change");
    expect(change.textContent).toBe("▼7");
    // Default score 85 (breaking) — severity color is #dc2626
    expect(change).toHaveStyle({ color: "#dc2626" });
  });

  test("renders urgency badge", () => {
    render(<TopicCard topic={makeTopic({ urgency: "breaking" })} />);
    const badge = screen.getByTestId("urgency-badge");
    expect(badge.textContent).toBe("breaking");
  });

  test("renders article count", () => {
    render(<TopicCard topic={makeTopic({ articleCount: 5 })} />);
    expect(screen.getByText("5 articles")).toBeInTheDocument();
  });

  test("renders singular 'article' for count of 1", () => {
    render(<TopicCard topic={makeTopic({ articleCount: 1 })} />);
    expect(screen.getByText("1 article")).toBeInTheDocument();
  });

  test("renders region when provided", () => {
    render(<TopicCard topic={makeTopic({ region: "Arctic" })} />);
    expect(screen.getByText("Arctic")).toBeInTheDocument();
  });

  test("does not render region when null", () => {
    render(<TopicCard topic={makeTopic({ region: null })} />);
    expect(screen.queryByText("Arctic")).not.toBeInTheDocument();
  });

  test("renders category chip with human-readable label", () => {
    render(<TopicCard topic={makeTopic({ category: "air_quality" })} />);
    const chip = screen.getByTestId("category-chip");
    expect(chip.textContent).toBe("Air Quality");
  });

  test("renders category chip for default climate category", () => {
    render(<TopicCard topic={makeTopic()} />);
    const chip = screen.getByTestId("category-chip");
    expect(chip.textContent).toBe("Climate");
  });

  test("links to topic detail page", () => {
    render(<TopicCard topic={makeTopic()} />);
    const link = screen.getByTestId("topic-card");
    expect(link.getAttribute("href")).toBe("/topic/arctic-ice-decline");
  });

  // AC1: Left border colored by severity
  // jsdom normalizes hex colors to rgb() in inline styles
  test("breaking topic (score 80+) has red left border", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 85 })} />);
    const card = screen.getByTestId("topic-card");
    expect((card as HTMLElement).style.borderLeft).toContain("rgb(220, 38, 38)");
  });

  test("critical topic (score 60-79) has orange left border", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 65, urgency: "critical" })} />);
    const card = screen.getByTestId("topic-card");
    expect((card as HTMLElement).style.borderLeft).toContain("rgb(194, 65, 12)");
  });

  test("moderate topic (score 30-59) has yellow left border", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 45, urgency: "moderate" })} />);
    const card = screen.getByTestId("topic-card");
    expect((card as HTMLElement).style.borderLeft).toContain("rgb(161, 98, 7)");
  });

  test("informational topic (score 0-29) has green left border", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 22, urgency: "informational" })} />);
    const card = screen.getByTestId("topic-card");
    expect((card as HTMLElement).style.borderLeft).toContain("rgb(21, 128, 61)");
  });

  // AC1: Exact boundary scores
  test("score exactly 80 uses breaking (red) border", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 80, urgency: "breaking" })} />);
    const card = screen.getByTestId("topic-card");
    expect((card as HTMLElement).style.borderLeft).toContain("rgb(220, 38, 38)");
  });

  test("score exactly 60 uses critical (orange) border", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 60, urgency: "critical" })} />);
    const card = screen.getByTestId("topic-card");
    expect((card as HTMLElement).style.borderLeft).toContain("rgb(194, 65, 12)");
  });

  test("score exactly 30 uses moderate (yellow) border", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 30, urgency: "moderate" })} />);
    const card = screen.getByTestId("topic-card");
    expect((card as HTMLElement).style.borderLeft).toContain("rgb(161, 98, 7)");
  });

  // AC2: Inline SeverityGauge
  test("renders SeverityGauge in compact mode", () => {
    render(<TopicCard topic={makeTopic()} />);
    expect(screen.getByTestId("gauge-bar")).toBeInTheDocument();
  });

  // AC3: Truncated insight sentence
  test("renders impactSummary when present", () => {
    render(<TopicCard topic={makeTopic({ impactSummary: "Sea ice at record lows" })} />);
    expect(screen.getByTestId("impact-summary")).toBeInTheDocument();
    expect(screen.getByTestId("impact-summary").textContent).toBe("Sea ice at record lows");
  });

  test("truncates impactSummary over 120 chars to word boundary with ellipsis", () => {
    const longSummary = "Global temperatures have risen dramatically causing widespread damage to ecosystems and biodiversity across all continents including many endangered species";
    render(<TopicCard topic={makeTopic({ impactSummary: longSummary })} />);
    const el = screen.getByTestId("impact-summary");
    expect(el.textContent!.endsWith("...")).toBe(true);
    expect(el.textContent!.length).toBeLessThanOrEqual(123);
  });

  test("omits insight line when impactSummary is null", () => {
    render(<TopicCard topic={makeTopic({ impactSummary: null })} />);
    expect(screen.queryByTestId("impact-summary")).not.toBeInTheDocument();
  });

  test("omits insight line when impactSummary is empty string", () => {
    render(<TopicCard topic={makeTopic({ impactSummary: "" })} />);
    expect(screen.queryByTestId("impact-summary")).not.toBeInTheDocument();
  });

  test("omits insight line when impactSummary is whitespace-only", () => {
    render(<TopicCard topic={makeTopic({ impactSummary: "   " })} />);
    expect(screen.queryByTestId("impact-summary")).not.toBeInTheDocument();
  });

  // AC4: Relative timestamp
  test("renders updated timestamp", () => {
    render(<TopicCard topic={makeTopic({ updatedAt: "2026-02-22T06:00:00Z" })} />);
    const ts = screen.getByTestId("updated-at");
    expect(ts).toBeInTheDocument();
    expect(ts.textContent).toMatch(/^Updated .+ ago$/);
  });
});
