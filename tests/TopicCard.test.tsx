import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TopicCard from "@/components/TopicCard";
import type { Topic } from "@/lib/types";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

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
    expect(score.className).toContain("text-red-500");
  });

  test("renders score with orange for critical (60-79)", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 65, urgency: "critical" })} />);
    const score = screen.getByTestId("score");
    expect(score.className).toContain("text-orange-500");
  });

  test("renders score with yellow for moderate (30-59)", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 45, urgency: "moderate" })} />);
    const score = screen.getByTestId("score");
    expect(score.className).toContain("text-yellow-500");
  });

  test("renders score with green for informational (<30)", () => {
    render(<TopicCard topic={makeTopic({ currentScore: 22, urgency: "informational" })} />);
    const score = screen.getByTestId("score");
    expect(score.className).toContain("text-green-500");
  });

  test("renders positive change in red with up arrow", () => {
    render(<TopicCard topic={makeTopic({ change: 6 })} />);
    const change = screen.getByTestId("change");
    expect(change.textContent).toBe("+6 ▲");
    expect(change.className).toContain("text-red-400");
  });

  test("renders negative change in green with down arrow", () => {
    render(<TopicCard topic={makeTopic({ change: -7 })} />);
    const change = screen.getByTestId("change");
    expect(change.textContent).toBe("-7 ▼");
    expect(change.className).toContain("text-green-400");
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

  test("links to topic detail page", () => {
    render(<TopicCard topic={makeTopic()} />);
    const link = screen.getByTestId("topic-card");
    expect(link.getAttribute("href")).toBe("/topic/arctic-ice-decline");
  });
});
