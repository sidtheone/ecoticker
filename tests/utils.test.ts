import { changeDirectionColor, formatChange, scoreToUrgency, severityColor, truncateToWord, relativeTime, topicAbbreviation } from "../src/lib/utils";

describe("severityColor", () => {
  describe("return shape", () => {
    test("returns object with all required fields", () => {
      const result = severityColor(50);
      expect(result).toHaveProperty("badge");
      expect(result).toHaveProperty("gauge");
      expect(result).toHaveProperty("border");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("sparkline");
      expect(result).toHaveProperty("change");
    });

    test("all color fields are hex strings", () => {
      const result = severityColor(50);
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      expect(result.badge).toMatch(hexPattern);
      expect(result.gauge).toMatch(hexPattern);
      expect(result.border).toMatch(hexPattern);
      expect(result.sparkline).toMatch(hexPattern);
    });
  });

  describe("Breaking (80-100)", () => {
    test("score 80 returns breaking", () => {
      const result = severityColor(80);
      expect(result.text).toBe("Breaking");
      expect(result.badge).toBe("#dc2626");
      expect(result.gauge).toBe("#991b1b");
    });

    test("score 100 returns breaking", () => {
      const result = severityColor(100);
      expect(result.text).toBe("Breaking");
      expect(result.badge).toBe("#dc2626");
    });
  });

  describe("Critical (60-79)", () => {
    test("score 60 returns critical", () => {
      const result = severityColor(60);
      expect(result.text).toBe("Critical");
      expect(result.badge).toBe("#c2410c");
      expect(result.gauge).toBe("#9a3412");
    });

    test("score 79 returns critical", () => {
      const result = severityColor(79);
      expect(result.text).toBe("Critical");
    });
  });

  describe("Moderate (30-59)", () => {
    test("score 30 returns moderate", () => {
      const result = severityColor(30);
      expect(result.text).toBe("Moderate");
      expect(result.badge).toBe("#a16207");
      expect(result.gauge).toBe("#854d0e");
    });

    test("score 59 returns moderate", () => {
      const result = severityColor(59);
      expect(result.text).toBe("Moderate");
    });
  });

  describe("Informational (0-29)", () => {
    test("score 0 returns informational", () => {
      const result = severityColor(0);
      expect(result.text).toBe("Informational");
      expect(result.badge).toBe("#15803d");
      expect(result.gauge).toBe("#166534");
    });

    test("score 29 returns informational", () => {
      const result = severityColor(29);
      expect(result.text).toBe("Informational");
    });
  });

  describe("boundary scores", () => {
    test("score 29 is informational, 30 is moderate", () => {
      expect(severityColor(29).text).toBe("Informational");
      expect(severityColor(30).text).toBe("Moderate");
    });

    test("score 59 is moderate, 60 is critical", () => {
      expect(severityColor(59).text).toBe("Moderate");
      expect(severityColor(60).text).toBe("Critical");
    });

    test("score 79 is critical, 80 is breaking", () => {
      expect(severityColor(79).text).toBe("Critical");
      expect(severityColor(80).text).toBe("Breaking");
    });
  });

  describe("edge cases", () => {
    test("negative score treated as informational", () => {
      expect(severityColor(-1).text).toBe("Informational");
    });

    test("score above 100 treated as breaking", () => {
      expect(severityColor(150).text).toBe("Breaking");
    });
  });
});

describe("changeDirectionColor", () => {
  test("positive change (worsening) is red", () => {
    expect(changeDirectionColor(10)).toBe("text-red-400");
  });

  test("negative change (improving) is green", () => {
    expect(changeDirectionColor(-5)).toBe("text-green-400");
  });

  test("zero change is gray", () => {
    expect(changeDirectionColor(0)).toBe("text-gray-400");
  });
});

describe("formatChange", () => {
  test("positive shows + and up arrow", () => {
    expect(formatChange(13)).toBe("+13 ▲");
  });

  test("negative shows number and down arrow", () => {
    expect(formatChange(-5)).toBe("-5 ▼");
  });

  test("zero shows dash", () => {
    expect(formatChange(0)).toBe("0 ─");
  });
});

describe("scoreToUrgency", () => {
  test("80-100 is breaking", () => {
    expect(scoreToUrgency(80)).toBe("breaking");
    expect(scoreToUrgency(100)).toBe("breaking");
  });

  test("60-79 is critical", () => {
    expect(scoreToUrgency(60)).toBe("critical");
    expect(scoreToUrgency(79)).toBe("critical");
  });

  test("30-59 is moderate", () => {
    expect(scoreToUrgency(30)).toBe("moderate");
    expect(scoreToUrgency(59)).toBe("moderate");
  });

  test("0-29 is informational", () => {
    expect(scoreToUrgency(0)).toBe("informational");
    expect(scoreToUrgency(29)).toBe("informational");
  });
});

describe("truncateToWord", () => {
  test("returns text unchanged when under maxLen", () => {
    expect(truncateToWord("Short text", 120)).toBe("Short text");
  });

  test("returns text unchanged when exactly at maxLen", () => {
    const text = "a".repeat(120);
    expect(truncateToWord(text, 120)).toBe(text);
  });

  test("truncates at last word boundary before maxLen and appends ellipsis", () => {
    const text = "The quick brown fox jumps over the lazy dog and then some more words here yes";
    const result = truncateToWord(text, 40);
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(43); // 40 chars + "..."
    // Must end at a word boundary (no partial word before "...")
    const withoutEllipsis = result.slice(0, -3);
    expect(withoutEllipsis).toBe(withoutEllipsis.trimEnd());
    expect(text.startsWith(withoutEllipsis)).toBe(true);
  });

  test("truncates at 120 chars for typical impact summary", () => {
    const text = "Global temperatures have risen by 1.5 degrees Celsius above pre-industrial levels, causing widespread disruption to ecosystems worldwide.";
    const result = truncateToWord(text, 120);
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(123);
  });

  test("truncates single word longer than maxLen at character boundary", () => {
    const longWord = "supercalifragilisticexpialidocious";
    const result = truncateToWord(longWord, 10);
    expect(result).toBe("supercalif...");
    expect(result.endsWith("...")).toBe(true);
  });

  test("returns empty string unchanged", () => {
    expect(truncateToWord("", 120)).toBe("");
  });

  test("handles maxLen of 0 defensively", () => {
    const result = truncateToWord("hello world", 0);
    expect(result).toBe("...");
  });

  test("text with exactly one word under maxLen returns unchanged", () => {
    expect(truncateToWord("hello", 10)).toBe("hello");
  });

  test("text with exactly one word over maxLen truncates at char boundary", () => {
    const result = truncateToWord("hello", 3);
    expect(result).toBe("hel...");
  });
});

describe("relativeTime", () => {
  const BASE_NOW = new Date("2026-02-22T12:00:00Z").getTime();

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(BASE_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns 'just now' for timestamps under 1 minute ago", () => {
    const date = new Date(BASE_NOW - 30 * 1000).toISOString(); // 30s ago
    expect(relativeTime(date)).toBe("just now");
  });

  test("returns minutes ago for timestamps 1-59 minutes ago", () => {
    const date = new Date(BASE_NOW - 5 * 60 * 1000).toISOString(); // 5 min ago
    expect(relativeTime(date)).toBe("5m ago");
  });

  test("returns 1m ago for exactly 1 minute ago", () => {
    const date = new Date(BASE_NOW - 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("1m ago");
  });

  test("returns 59m ago for 59 minutes ago", () => {
    const date = new Date(BASE_NOW - 59 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("59m ago");
  });

  test("returns hours ago for timestamps 1-23 hours ago", () => {
    const date = new Date(BASE_NOW - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    expect(relativeTime(date)).toBe("3h ago");
  });

  test("returns 1h ago for exactly 1 hour ago", () => {
    const date = new Date(BASE_NOW - 60 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("1h ago");
  });

  test("returns days ago for timestamps 1+ days ago", () => {
    const date = new Date(BASE_NOW - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2d ago
    expect(relativeTime(date)).toBe("2d ago");
  });

  test("returns 1d ago for exactly 24 hours ago", () => {
    const date = new Date(BASE_NOW - 24 * 60 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("1d ago");
  });

  test("returns 'unknown' for invalid date string", () => {
    expect(relativeTime("not-a-date")).toBe("unknown");
    expect(relativeTime("garbage")).toBe("unknown");
  });

  test("returns 'unknown' for empty string input", () => {
    expect(relativeTime("")).toBe("unknown");
  });

  test("returns 'just now' for future date (clock skew)", () => {
    const futureDate = new Date(BASE_NOW + 5 * 60 * 1000).toISOString(); // 5 min in future
    expect(relativeTime(futureDate)).toBe("just now");
  });
});

describe("topicAbbreviation", () => {
  test("multi-word: first 4 chars + last 3 chars", () => {
    expect(topicAbbreviation("Amazon Deforestation Acceleration")).toBe("AMAZ-ACC");
  });

  test("two words: first 4 + last 3", () => {
    expect(topicAbbreviation("Delhi Air")).toBe("DELH-AIR");
  });

  test("single word: up to 8 chars uppercase", () => {
    expect(topicAbbreviation("Climate")).toBe("CLIMATE");
  });

  test("single long word: truncated to 8 chars", () => {
    expect(topicAbbreviation("Deforestation")).toBe("DEFOREST");
  });

  test("empty string returns empty", () => {
    expect(topicAbbreviation("")).toBe("");
  });

  test("three words uses first and last", () => {
    expect(topicAbbreviation("Delhi Air Quality")).toBe("DELH-QUA");
  });
});
