import { severityColor } from "../src/lib/utils";

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
