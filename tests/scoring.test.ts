import {
  validateScore,
  computeOverallScore,
  deriveUrgency,
  detectAnomaly,
  scoreToLevel,
  LEVEL_RANGES,
  DIMENSION_WEIGHTS,
} from "../src/lib/scoring";

describe("scoring.ts", () => {
  describe("LEVEL_RANGES constant", () => {
    it("should define all four severity levels with correct ranges", () => {
      expect(LEVEL_RANGES).toEqual({
        MINIMAL: [0, 25],
        MODERATE: [26, 50],
        SIGNIFICANT: [51, 75],
        SEVERE: [76, 100],
      });
    });
  });

  describe("DIMENSION_WEIGHTS constant", () => {
    it("should define weights that sum to 1.0", () => {
      const sum = DIMENSION_WEIGHTS.eco + DIMENSION_WEIGHTS.health + DIMENSION_WEIGHTS.econ;
      expect(sum).toBe(1.0);
    });

    it("should prioritize eco > health > econ", () => {
      expect(DIMENSION_WEIGHTS.eco).toBe(0.4);
      expect(DIMENSION_WEIGHTS.health).toBe(0.35);
      expect(DIMENSION_WEIGHTS.econ).toBe(0.25);
    });
  });

  describe("validateScore()", () => {
    describe("valid scores within level ranges", () => {
      it("should not clamp MINIMAL score of 15", () => {
        const result = validateScore("MINIMAL", 15);
        expect(result).toEqual({ level: "MINIMAL", score: 15, clamped: false });
      });

      it("should not clamp SEVERE score of 100", () => {
        const result = validateScore("SEVERE", 100);
        expect(result).toEqual({ level: "SEVERE", score: 100, clamped: false });
      });

      it("should not clamp MODERATE score of 40", () => {
        const result = validateScore("MODERATE", 40);
        expect(result).toEqual({ level: "MODERATE", score: 40, clamped: false });
      });

      it("should not clamp SIGNIFICANT score of 65", () => {
        const result = validateScore("SIGNIFICANT", 65);
        expect(result).toEqual({ level: "SIGNIFICANT", score: 65, clamped: false });
      });
    });

    describe("clamping out-of-range scores", () => {
      it("should clamp MINIMAL score of 30 to 25", () => {
        const result = validateScore("MINIMAL", 30);
        expect(result).toEqual({ level: "MINIMAL", score: 25, clamped: true });
      });

      it("should clamp SEVERE score of 50 to 76", () => {
        const result = validateScore("SEVERE", 50);
        expect(result).toEqual({ level: "SEVERE", score: 76, clamped: true });
      });

      it("should clamp MODERATE score of 75 to 50", () => {
        const result = validateScore("MODERATE", 75);
        expect(result).toEqual({ level: "MODERATE", score: 50, clamped: true });
      });

      it("should clamp SIGNIFICANT score of 25 to 51", () => {
        const result = validateScore("SIGNIFICANT", 25);
        expect(result).toEqual({ level: "SIGNIFICANT", score: 51, clamped: true });
      });
    });

    describe("boundary conditions", () => {
      it("should accept score of 0 with MINIMAL", () => {
        const result = validateScore("MINIMAL", 0);
        expect(result).toEqual({ level: "MINIMAL", score: 0, clamped: false });
      });

      it("should accept score of 25 with MINIMAL (upper boundary)", () => {
        const result = validateScore("MINIMAL", 25);
        expect(result).toEqual({ level: "MINIMAL", score: 25, clamped: false });
      });

      it("should accept score of 26 with MODERATE (lower boundary)", () => {
        const result = validateScore("MODERATE", 26);
        expect(result).toEqual({ level: "MODERATE", score: 26, clamped: false });
      });

      it("should accept score of 51 with SIGNIFICANT (lower boundary)", () => {
        const result = validateScore("SIGNIFICANT", 51);
        expect(result).toEqual({ level: "SIGNIFICANT", score: 51, clamped: false });
      });

      it("should accept score of 76 with SEVERE (lower boundary)", () => {
        const result = validateScore("SEVERE", 76);
        expect(result).toEqual({ level: "SEVERE", score: 76, clamped: false });
      });
    });

    describe("INSUFFICIENT_DATA handling", () => {
      it("should return INSUFFICIENT_DATA level with -1 score", () => {
        const result = validateScore("INSUFFICIENT_DATA", -1);
        expect(result).toEqual({ level: "INSUFFICIENT_DATA", score: -1, clamped: false });
      });

      it("should handle -1 score with any level as INSUFFICIENT_DATA", () => {
        const result = validateScore("SEVERE", -1);
        expect(result).toEqual({ level: "INSUFFICIENT_DATA", score: -1, clamped: false });
      });

      it("should handle INSUFFICIENT_DATA level with any score as -1", () => {
        const result = validateScore("INSUFFICIENT_DATA", 50);
        expect(result).toEqual({ level: "INSUFFICIENT_DATA", score: -1, clamped: false });
      });

      it("should treat undefined score as INSUFFICIENT_DATA (LLM omitted field)", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = validateScore("MODERATE", undefined as any);
        expect(result).toEqual({ level: "INSUFFICIENT_DATA", score: -1, clamped: true });
      });

      it("should treat NaN score as INSUFFICIENT_DATA", () => {
        const result = validateScore("MODERATE", NaN);
        expect(result).toEqual({ level: "INSUFFICIENT_DATA", score: -1, clamped: true });
      });
    });

    describe("unknown level handling", () => {
      it("should fall back to MODERATE for unknown level", () => {
        const result = validateScore("UNKNOWN", 35);
        expect(result.level).toBe("MODERATE");
        expect(result.score).toBe(35); // Already in MODERATE range
        expect(result.clamped).toBe(true); // Marked as clamped due to fallback
      });

      it("should clamp score when falling back to MODERATE", () => {
        const result = validateScore("UNKNOWN", 80);
        expect(result).toEqual({ level: "MODERATE", score: 50, clamped: true });
      });
    });
  });

  describe("computeOverallScore()", () => {
    it("should compute weighted average for all valid dimensions", () => {
      // Health=50 (35%), Eco=60 (40%), Econ=40 (25%)
      // = 50*0.35 + 60*0.40 + 40*0.25 = 17.5 + 24 + 10 = 51.5 → 52
      const result = computeOverallScore(50, 60, 40);
      expect(result).toBe(52);
    });

    it("should exclude INSUFFICIENT_DATA dimension and renormalize weights", () => {
      // Eco = -1 (excluded), Health=50 (35%), Econ=40 (25%)
      // Renormalized weights: health = 35/(35+25) = 0.583, econ = 25/(35+25) = 0.417
      // = 50*0.583 + 40*0.417 = 29.15 + 16.68 = 45.83 → 46
      const result = computeOverallScore(50, -1, 40);
      expect(result).toBe(46);
    });

    it("should handle single valid dimension", () => {
      // Only health valid, gets 100% weight
      const result = computeOverallScore(70, -1, -1);
      expect(result).toBe(70);
    });

    it("should return 50 when all dimensions are INSUFFICIENT_DATA", () => {
      const result = computeOverallScore(-1, -1, -1);
      expect(result).toBe(50);
    });

    it("should compute correctly for all SEVERE (100, 100, 100)", () => {
      const result = computeOverallScore(100, 100, 100);
      expect(result).toBe(100);
    });

    it("should compute correctly for all MINIMAL (0, 0, 0)", () => {
      const result = computeOverallScore(0, 0, 0);
      expect(result).toBe(0);
    });

    it("should prioritize eco dimension when only it is high", () => {
      // Eco=100 (40%), health=0 (35%), econ=0 (25%)
      // = 0 + 100*0.40 + 0 = 40
      const result = computeOverallScore(0, 100, 0);
      expect(result).toBe(40);
    });

    it("should round to nearest integer", () => {
      // Health=33 (35%), Eco=33 (40%), Econ=33 (25%)
      // = 33*0.35 + 33*0.40 + 33*0.25 = 11.55 + 13.2 + 8.25 = 33
      const result = computeOverallScore(33, 33, 33);
      expect(result).toBe(33);
    });
  });

  describe("deriveUrgency()", () => {
    it("should return 'breaking' for score 80", () => {
      expect(deriveUrgency(80)).toBe("breaking");
    });

    it("should return 'breaking' for score 100", () => {
      expect(deriveUrgency(100)).toBe("breaking");
    });

    it("should return 'critical' for score 60", () => {
      expect(deriveUrgency(60)).toBe("critical");
    });

    it("should return 'critical' for score 79", () => {
      expect(deriveUrgency(79)).toBe("critical");
    });

    it("should return 'moderate' for score 30", () => {
      expect(deriveUrgency(30)).toBe("moderate");
    });

    it("should return 'moderate' for score 59", () => {
      expect(deriveUrgency(59)).toBe("moderate");
    });

    it("should return 'informational' for score 29", () => {
      expect(deriveUrgency(29)).toBe("informational");
    });

    it("should return 'informational' for score 0", () => {
      expect(deriveUrgency(0)).toBe("informational");
    });
  });

  describe("detectAnomaly()", () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("should detect anomaly for 25pt jump", () => {
      const result = detectAnomaly(40, 65, "Test Topic", "eco");
      expect(result).toBe(false); // 25pt is NOT > 25
    });

    it("should detect anomaly for 26pt jump", () => {
      const result = detectAnomaly(40, 66, "Test Topic", "eco");
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("ANOMALY DETECTED")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test Topic")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("eco")
      );
    });

    it("should detect anomaly for 30pt jump", () => {
      const result = detectAnomaly(20, 50, "Amazon Deforestation", "health");
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should not detect anomaly for 24pt jump", () => {
      const result = detectAnomaly(40, 64, "Test Topic", "eco");
      expect(result).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should not detect anomaly for 0→0 (no change)", () => {
      const result = detectAnomaly(50, 50, "Test Topic", "eco");
      expect(result).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should skip detection when previous score is null", () => {
      const result = detectAnomaly(null as any, 70, "New Topic", "eco");
      expect(result).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should skip detection when previous score is -1 (INSUFFICIENT_DATA)", () => {
      const result = detectAnomaly(-1, 70, "Test Topic", "eco");
      expect(result).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should skip detection when new score is -1 (INSUFFICIENT_DATA)", () => {
      const result = detectAnomaly(50, -1, "Test Topic", "eco");
      expect(result).toBe(false);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should detect downward anomaly (50 → 20)", () => {
      const result = detectAnomaly(50, 20, "Test Topic", "econ");
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("30 points")
      );
    });
  });

  describe("scoreToLevel()", () => {
    it("should map 15 to MINIMAL", () => {
      expect(scoreToLevel(15)).toBe("MINIMAL");
    });

    it("should map 0 to MINIMAL", () => {
      expect(scoreToLevel(0)).toBe("MINIMAL");
    });

    it("should map 25 to MINIMAL (boundary)", () => {
      expect(scoreToLevel(25)).toBe("MINIMAL");
    });

    it("should map 40 to MODERATE", () => {
      expect(scoreToLevel(40)).toBe("MODERATE");
    });

    it("should map 26 to MODERATE (boundary)", () => {
      expect(scoreToLevel(26)).toBe("MODERATE");
    });

    it("should map 50 to MODERATE (boundary)", () => {
      expect(scoreToLevel(50)).toBe("MODERATE");
    });

    it("should map 65 to SIGNIFICANT", () => {
      expect(scoreToLevel(65)).toBe("SIGNIFICANT");
    });

    it("should map 51 to SIGNIFICANT (boundary)", () => {
      expect(scoreToLevel(51)).toBe("SIGNIFICANT");
    });

    it("should map 75 to SIGNIFICANT (boundary)", () => {
      expect(scoreToLevel(75)).toBe("SIGNIFICANT");
    });

    it("should map 90 to SEVERE", () => {
      expect(scoreToLevel(90)).toBe("SEVERE");
    });

    it("should map 76 to SEVERE (boundary)", () => {
      expect(scoreToLevel(76)).toBe("SEVERE");
    });

    it("should map 100 to SEVERE (boundary)", () => {
      expect(scoreToLevel(100)).toBe("SEVERE");
    });

    it("should map -1 to INSUFFICIENT_DATA", () => {
      expect(scoreToLevel(-1)).toBe("INSUFFICIENT_DATA");
    });

    it("should fall back to MODERATE for out-of-range score (105)", () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      expect(scoreToLevel(105)).toBe("MODERATE");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("out of range")
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
