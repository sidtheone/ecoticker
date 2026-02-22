import "@testing-library/jest-dom";
import type { Topic } from "@/lib/types";
import { computeHeadline, urgencyRank } from "@/lib/utils";

const makeTopic = (overrides: Partial<Topic> = {}): Topic => ({
  id: 1, name: "Arctic Ice", slug: "arctic-ice", category: "climate",
  region: null, currentScore: 50, previousScore: 50, change: 0,
  urgency: "moderate", impactSummary: null, imageUrl: null,
  articleCount: 3, healthScore: 50, ecoScore: 50, econScore: 50,
  scoreReasoning: null, hidden: false, sparkline: [], updatedAt: "2026-02-17",
  ...overrides,
});

describe("urgencyRank", () => {
  test("returns ranks in ascending order", () => {
    expect(urgencyRank("informational")).toBe(0);
    expect(urgencyRank("moderate")).toBe(1);
    expect(urgencyRank("critical")).toBe(2);
    expect(urgencyRank("breaking")).toBe(3);
  });
});

describe("computeHeadline", () => {
  test("empty topics returns fallback", () => {
    expect(computeHeadline([])).toBe("Environmental News Impact Tracker");
  });

  test("single escalation: topic crossed from moderate to breaking", () => {
    const topics = [makeTopic({ name: "Amazon Fires", currentScore: 85, previousScore: 55 })];
    expect(computeHeadline(topics)).toBe("Amazon Fires reached BREAKING");
  });

  test("multiple escalations: picks highest scorer", () => {
    const topics = [
      makeTopic({ id: 1, name: "Topic A", currentScore: 65, previousScore: 25 }), // informational → critical
      makeTopic({ id: 2, name: "Topic B", currentScore: 85, previousScore: 55 }), // moderate → breaking
    ];
    expect(computeHeadline(topics)).toBe("2 topics escalated — Topic B reached BREAKING");
  });

  test("de-escalation only: no escalations present", () => {
    const topics = [
      makeTopic({ name: "Delhi Air", currentScore: 40, previousScore: 85 }), // breaking → moderate
    ];
    expect(computeHeadline(topics)).toBe("Delhi Air improved to MODERATE");
  });

  test("large move without level change", () => {
    const topics = [
      makeTopic({ name: "Coral Bleach", currentScore: 50, previousScore: 35, change: 15 }),
    ];
    expect(computeHeadline(topics)).toBe("Biggest move: Coral Bleach +15");
  });

  test("large negative move without level change", () => {
    const topics = [
      makeTopic({ name: "Coral Bleach", currentScore: 35, previousScore: 50, change: -15 }),
    ];
    expect(computeHeadline(topics)).toBe("Biggest move: Coral Bleach -15");
  });

  test("all stable: every topic change <= 5", () => {
    const topics = [
      makeTopic({ id: 1, name: "A", change: 2 }),
      makeTopic({ id: 2, name: "B", change: -3 }),
      makeTopic({ id: 3, name: "C", change: 0 }),
    ];
    expect(computeHeadline(topics)).toBe("All topics stable today");
  });

  test("fallback: changes 6-10 with no level transitions", () => {
    const topics = [
      makeTopic({ currentScore: 45, previousScore: 37, change: 8 }),
    ];
    expect(computeHeadline(topics)).toBe("Environmental News Impact Tracker");
  });

  test("escalation takes priority over de-escalation", () => {
    const topics = [
      makeTopic({ id: 1, name: "Escalated", currentScore: 85, previousScore: 55 }),
      makeTopic({ id: 2, name: "Deescalated", currentScore: 40, previousScore: 85 }),
    ];
    // 1 escalation + 1 de-escalation → single escalation rule wins
    expect(computeHeadline(topics)).toBe("Escalated reached BREAKING");
  });
});
