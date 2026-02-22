/**
 * TDD tests for Story 7-2: Hero topic selection via weighted score
 * Tests computeHeroScore pure function and topic selection logic
 */
import type { Topic } from "@/lib/types";

import { computeHeroScore, selectHeroTopic } from "@/lib/utils";

const makeTopic = (overrides: Partial<Topic> = {}): Topic => ({
  id: 1, name: "Arctic Ice", slug: "arctic-ice", category: "climate",
  region: null, currentScore: 50, previousScore: 50, change: 0,
  urgency: "moderate", impactSummary: null, imageUrl: null,
  articleCount: 3, healthScore: 50, ecoScore: 50, econScore: 50,
  scoreReasoning: null, hidden: false, sparkline: [], updatedAt: "2026-02-22T12:00:00Z",
  ...overrides,
});

describe("computeHeroScore", () => {

  test("stable topic: heroScore equals 60% of currentScore", () => {
    const topic = makeTopic({ currentScore: 80, previousScore: 80 });
    expect(computeHeroScore(topic)).toBe(48); // 80*0.6 + 0*0.4
  });

  test("rising topic: momentum adds to score", () => {
    const topic = makeTopic({ currentScore: 80, previousScore: 40 });
    expect(computeHeroScore(topic)).toBe(64); // 80*0.6 + 40*0.4
  });

  test("falling topic: absolute change still adds momentum", () => {
    const topic = makeTopic({ currentScore: 30, previousScore: 70 });
    expect(computeHeroScore(topic)).toBe(34); // 30*0.6 + 40*0.4
  });

  test("zero score topic returns 0", () => {
    const topic = makeTopic({ currentScore: 0, previousScore: 0 });
    expect(computeHeroScore(topic)).toBe(0);
  });

  test("max score topic: 100*0.6 + 0*0.4 = 60", () => {
    const topic = makeTopic({ currentScore: 100, previousScore: 100 });
    expect(computeHeroScore(topic)).toBe(60);
  });

  test("max momentum: 100*0.6 + 100*0.4 = 100", () => {
    const topic = makeTopic({ currentScore: 100, previousScore: 0 });
    expect(computeHeroScore(topic)).toBe(100);
  });
});

describe("selectHeroTopic", () => {
  test("empty array returns null", () => {
    expect(selectHeroTopic([])).toBeNull();
  });

  test("single topic is selected", () => {
    const topic = makeTopic();
    expect(selectHeroTopic([topic])).toBe(topic);
  });

  test("higher heroScore wins", () => {
    const a = makeTopic({ id: 1, name: "A", currentScore: 80, previousScore: 40 }); // 64
    const b = makeTopic({ id: 2, name: "B", currentScore: 50, previousScore: 50 }); // 30
    expect(selectHeroTopic([b, a])?.name).toBe("A");
  });

  test("tie-breaker: most recent updatedAt wins", () => {
    const a = makeTopic({ id: 1, name: "A", currentScore: 50, previousScore: 50, updatedAt: "2026-02-22T10:00:00Z" });
    const b = makeTopic({ id: 2, name: "B", currentScore: 50, previousScore: 50, updatedAt: "2026-02-22T14:00:00Z" });
    expect(selectHeroTopic([a, b])?.name).toBe("B");
  });

  test("second tie-breaker: highest currentScore wins", () => {
    const a = makeTopic({ id: 1, name: "A", currentScore: 60, previousScore: 60, updatedAt: "2026-02-22T12:00:00Z" });
    const b = makeTopic({ id: 2, name: "B", currentScore: 50, previousScore: 40, updatedAt: "2026-02-22T12:00:00Z" });
    // A: 60*0.6 + 0*0.4 = 36, B: 50*0.6 + 10*0.4 = 34 — A wins on heroScore
    expect(selectHeroTopic([b, a])?.name).toBe("A");
  });

  test("equal heroScore and updatedAt: highest currentScore wins", () => {
    // Need identical heroScore and updatedAt but different currentScore
    // A: current=60, prev=60 → hero=36. B: current=70, prev=85 → hero=70*0.6+15*0.4=42+6=48 — not equal
    // Craft: A: current=80, prev=80 → hero=48. B: current=60, prev=30 → hero=36+12=48. Same heroScore!
    const a = makeTopic({ id: 1, name: "A", currentScore: 80, previousScore: 80, updatedAt: "2026-02-22T12:00:00Z" });
    const b = makeTopic({ id: 2, name: "B", currentScore: 60, previousScore: 30, updatedAt: "2026-02-22T12:00:00Z" });
    // Both heroScore=48, same updatedAt → highest currentScore (80) wins
    expect(selectHeroTopic([b, a])?.name).toBe("A");
  });
});
