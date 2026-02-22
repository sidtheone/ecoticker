/**
 * TDD tests for Story 7-2: HeroSection component
 * Tests rendering modes (dramatic/calm), share button, toast, and fallback
 */
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Topic } from "@/lib/types";

// Mock SeverityGauge
jest.mock("@/components/SeverityGauge", () => {
  return function MockSeverityGauge(props: { score: number; compact?: boolean }) {
    return <div data-testid="severity-gauge" data-score={props.score} />;
  };
});

// Mock UrgencyBadge
jest.mock("@/components/UrgencyBadge", () => {
  return function MockUrgencyBadge({ score }: { score: number }) {
    return <span data-testid="urgency-badge" data-score={score} />;
  };
});

// Mock next/link
jest.mock("next/link", () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Import after mocks
import HeroSection from "@/components/HeroSection";

const makeTopic = (overrides: Partial<Topic> = {}): Topic => ({
  id: 1, name: "Arctic Ice", slug: "arctic-ice", category: "climate",
  region: null, currentScore: 50, previousScore: 50, change: 0,
  urgency: "moderate", impactSummary: null, imageUrl: null,
  articleCount: 3, healthScore: 50, ecoScore: 50, econScore: 50,
  scoreReasoning: null, hidden: false, sparkline: [], updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("HeroSection component", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("AC1: Hero topic display", () => {
    test("renders the hero topic name", () => {
      const topic = makeTopic({ name: "Amazon Fires" });
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByText("Amazon Fires")).toBeInTheDocument();
    });

    test("renders the hero topic score", () => {
      const topic = makeTopic({ currentScore: 85 });
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByText("85")).toBeInTheDocument();
    });

    test("renders UrgencyBadge", () => {
      const topic = makeTopic({ currentScore: 85 });
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByTestId("urgency-badge")).toBeInTheDocument();
    });

    test("renders SeverityGauge", () => {
      const topic = makeTopic({ currentScore: 85 });
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByTestId("severity-gauge")).toBeInTheDocument();
    });

    test("renders insight sentence via computeHeadline", () => {
      const topic = makeTopic({ name: "Amazon Fires", currentScore: 85, previousScore: 55 });
      render(<HeroSection heroTopic={topic} />);
      // computeHeadline([topic]) should produce "Amazon Fires reached BREAKING"
      expect(screen.getByTestId("insight-headline")).toHaveTextContent("Amazon Fires reached BREAKING");
    });
  });

  describe("AC2: Dramatic mode (score >= 30)", () => {
    test("score uses 40px font size", () => {
      const topic = makeTopic({ currentScore: 75 });
      render(<HeroSection heroTopic={topic} />);
      const scoreEl = screen.getByTestId("hero-score");
      expect(scoreEl.className).toMatch(/font-mono/);
      expect(scoreEl.className).toContain("text-[40px]");
    });

  });

  describe("AC3: Calm mode (score < 30)", () => {
    test("score uses 28px font size", () => {
      const topic = makeTopic({ currentScore: 15 });
      render(<HeroSection heroTopic={topic} />);
      const scoreEl = screen.getByTestId("hero-score");
      expect(scoreEl.className).toMatch(/font-mono/);
      expect(scoreEl.className).toContain("text-[28px]");
    });

    test("stable calm topic shows calm fallback insight", () => {
      const topic = makeTopic({ currentScore: 15, previousScore: 15, change: 0 });
      render(<HeroSection heroTopic={topic} />);
      // When all topics are stable and low, should show stable message
      expect(screen.getByTestId("insight-headline")).toHaveTextContent("All topics stable today");
    });
  });

  describe("AC4: Share button", () => {
    test("renders share button", () => {
      const topic = makeTopic();
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    });

    test("copies topic URL to clipboard on click", async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const topic = makeTopic({ slug: "amazon-fires" });
      render(<HeroSection heroTopic={topic} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /share/i }));
      });

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/topic/amazon-fires")
      );
    });

    test("shows toast after successful copy", async () => {
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
      });

      const topic = makeTopic();
      render(<HeroSection heroTopic={topic} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /share/i }));
      });

      expect(screen.getByText("Link copied!")).toBeInTheDocument();
    });

    test("toast auto-dismisses after 3 seconds", async () => {
      jest.useFakeTimers();
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
      });

      const topic = makeTopic();
      render(<HeroSection heroTopic={topic} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /share/i }));
      });

      expect(screen.getByText("Link copied!")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(screen.queryByText("Link copied!")).not.toBeInTheDocument();

      jest.useRealTimers();
    });

    test("clipboard failure does not show toast", async () => {
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn().mockRejectedValue(new Error("Permission denied")) },
      });

      const topic = makeTopic();
      render(<HeroSection heroTopic={topic} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /share/i }));
      });

      expect(screen.queryByText("Link copied!")).not.toBeInTheDocument();
    });
  });

  describe("AC5: Empty/null hero topic fallback", () => {
    test("renders fallback when heroTopic is null", () => {
      render(<HeroSection heroTopic={null} />);
      expect(screen.getByText("Environmental News Impact Tracker")).toBeInTheDocument();
      expect(screen.getByText("EcoTicker")).toBeInTheDocument();
      expect(screen.queryByTestId("severity-gauge")).not.toBeInTheDocument();
      expect(screen.queryByTestId("urgency-badge")).not.toBeInTheDocument();
    });
  });

  describe("Action bar", () => {
    test("renders relative time ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const topic = makeTopic({ updatedAt: twoHoursAgo });
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByText(/2h ago/)).toBeInTheDocument();
    });

    test("renders 'just now' for recent updates", () => {
      const topic = makeTopic({ updatedAt: new Date().toISOString() });
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByText(/just now/)).toBeInTheDocument();
    });

    test("renders days ago for old updates", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      const topic = makeTopic({ updatedAt: threeDaysAgo });
      render(<HeroSection heroTopic={topic} />);
      expect(screen.getByText(/3d ago/)).toBeInTheDocument();
    });
  });
});
